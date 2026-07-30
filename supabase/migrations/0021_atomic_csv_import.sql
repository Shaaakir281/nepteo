-- Import CSV atomique, minimisé et réversible.
--
-- Le connecteur manipule des données potentiellement réelles. Les prospects,
-- le remplacement de l'ancien lot, la configuration et le journal doivent donc
-- partager la même transaction PostgreSQL.

do $csv_import_prerequisites$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1
      from public.app_schema_version
      where id = 1
        and version >= 20
    )
  then
    raise exception using
      errcode = '55000',
      message = '0021 atomic CSV import requires schema version 20';
  end if;
end
$csv_import_prerequisites$;

create index if not exists prospects_org_source_idx
  on public.prospects (organization_id, source);

-- Une ligne prospect ne doit jamais pouvoir pointer vers le connecteur d'une
-- autre organisation. La FK historique sur connector_id seul ne prouvait pas
-- cet alignement et rendait une suppression en cascade dangereuse sur un état
-- préalablement corrompu.
alter table public.connectors
  add constraint connectors_id_organization_unique
  unique (id, organization_id);
alter table public.prospects
  add constraint prospects_connector_organization_fkey
  foreign key (connector_id, organization_id)
  references public.connectors(id, organization_id)
  on delete cascade;

create or replace function public.replace_csv_prospects(
  p_organization_id uuid,
  p_actor_id uuid,
  p_file_name text,
  p_file_fingerprint text,
  p_delimiter text,
  p_field_mapping jsonb,
  p_rows jsonb,
  p_ignored_rows integer,
  p_authorization_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connector_id uuid;
  v_imported integer;
  v_now timestamptz := statement_timestamp();
begin
  if p_organization_id is null
    or p_actor_id is null
    or p_file_name is null
    or length(p_file_name) not between 1 and 180
    or p_file_fingerprint is null
    or p_file_fingerprint !~ '^[0-9a-f]{24}$'
    or p_delimiter is null
    or p_delimiter not in (',', ';', 'tabulation')
    or p_field_mapping is null
    or jsonb_typeof(p_field_mapping) <> 'object'
    or p_rows is null
    or jsonb_typeof(p_rows) <> 'array'
    or p_ignored_rows is null
    or p_ignored_rows < 0
    or p_authorization_version <> 1
  then
    raise exception using
      errcode = '22023',
      message = 'invalid CSV import';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 5000 then
    raise exception using
      errcode = '22023',
      message = 'invalid CSV import row count';
  end if;

  if p_field_mapping - array[
      'name',
      'email',
      'company',
      'stage',
      'notes',
      'last_contact_at'
    ]::text[] <> '{}'::jsonb
    or exists (
      select 1
      from jsonb_each(p_field_mapping) as field(key, value)
      where jsonb_typeof(field.value) not in ('string', 'null')
        or (
          jsonb_typeof(field.value) = 'string'
          and length(field.value #>> '{}') not between 1 and 200
        )
    )
    or (
      coalesce(jsonb_typeof(p_field_mapping -> 'name'), 'null') <> 'string'
      and coalesce(jsonb_typeof(p_field_mapping -> 'email'), 'null') <> 'string'
    )
    or (
      select count(*) <> count(distinct field.value #>> '{}')
      from jsonb_each(p_field_mapping) as field(key, value)
      where field.value <> 'null'::jsonb
    )
  then
    raise exception using
      errcode = '22023',
      message = 'invalid CSV field mapping';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using
      errcode = '42501',
      message = 'CSV import forbidden';
  end if;

  perform 1
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;
  if not found then
    raise exception using
      errcode = '23503',
      message = 'CSV import organization not found';
  end if;

  if exists (
    select 1
    from public.company_memory as memory
    where memory.organization_id = p_organization_id
      and memory.section = '__demo_backup'
  )
    or exists (
      select 1
      from public.connectors as connector
      where connector.organization_id = p_organization_id
        and connector.provider = 'demo'
        and connector.config @> '{"demo": true}'::jsonb
    )
    or exists (
      select 1
      from public.prospects as prospect
      where prospect.organization_id = p_organization_id
        and prospect.source = 'demo'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'CSV import blocked by an active demo scenario';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as source(item)
    where jsonb_typeof(source.item) <> 'object'
      or source.item - array[
        'external_id',
        'name',
        'email',
        'company',
        'stage',
        'notes',
        'last_contact_at',
        'raw'
      ]::text[] <> '{}'::jsonb
      or coalesce(source.item ->> 'external_id', '')
        !~ '^csv:[0-9a-f]{24}:[0-9]+$'
      or (
        nullif(btrim(source.item ->> 'name'), '') is null
        and nullif(btrim(source.item ->> 'email'), '') is null
      )
      or exists (
        select 1
        from jsonb_each(source.item) as field(key, value)
        where field.key in (
          'name',
          'email',
          'company',
          'stage',
          'notes',
          'last_contact_at'
        )
          and jsonb_typeof(field.value) not in ('string', 'null')
      )
      or length(coalesce(source.item ->> 'name', '')) > 200
      or length(coalesce(source.item ->> 'email', '')) > 320
      or length(coalesce(source.item ->> 'company', '')) > 200
      or length(coalesce(source.item ->> 'stage', '')) > 120
      or length(coalesce(source.item ->> 'notes', '')) > 2000
      or length(coalesce(source.item ->> 'last_contact_at', '')) > 64
      or coalesce(jsonb_typeof(source.item -> 'raw'), 'null') <> 'object'
      or source.item -> 'raw' <> '{}'::jsonb
  )
  then
    raise exception using
      errcode = '22023',
      message = 'invalid CSV prospect row';
  end if;

  if (
    select count(*) <> count(distinct source.item ->> 'external_id')
    from jsonb_array_elements(p_rows) as source(item)
  )
  then
    raise exception using
      errcode = '23505',
      message = 'duplicate CSV prospect identity';
  end if;

  select connector.id
    into v_connector_id
    from public.connectors as connector
    where connector.organization_id = p_organization_id
      and connector.provider = 'csv'
    for update;

  if found then
    if exists (
      select 1
      from public.prospects as prospect
      where prospect.connector_id = v_connector_id
        and (
          prospect.organization_id is distinct from p_organization_id
          or prospect.source is distinct from 'csv'
        )
    )
    then
      raise exception using
        errcode = '55000',
        message = 'CSV connector contains non-CSV prospects';
    end if;
  else
    insert into public.connectors (
      organization_id,
      type,
      provider,
      status,
      encrypted_credentials,
      config
    )
    values (
      p_organization_id,
      'crm',
      'csv',
      'disconnected',
      null,
      '{}'::jsonb
    )
    returning id into v_connector_id;
  end if;

  insert into public.prospects (
    organization_id,
    connector_id,
    external_id,
    name,
    email,
    company,
    stage,
    notes,
    last_contact_at,
    source,
    raw,
    synced_at
  )
  select
    p_organization_id,
    v_connector_id,
    source.item ->> 'external_id',
    nullif(source.item ->> 'name', ''),
    nullif(source.item ->> 'email', ''),
    nullif(source.item ->> 'company', ''),
    nullif(source.item ->> 'stage', ''),
    nullif(source.item ->> 'notes', ''),
    nullif(source.item ->> 'last_contact_at', '')::date,
    'csv',
    source.item -> 'raw',
    v_now
  from jsonb_array_elements(p_rows) as source(item)
  on conflict (connector_id, external_id) do update
  set
    organization_id = excluded.organization_id,
    name = excluded.name,
    email = excluded.email,
    company = excluded.company,
    stage = excluded.stage,
    notes = excluded.notes,
    last_contact_at = excluded.last_contact_at,
    source = excluded.source,
    raw = excluded.raw,
    synced_at = excluded.synced_at;

  delete from public.prospects as prospect
  where prospect.organization_id = p_organization_id
    and prospect.connector_id = v_connector_id
    and prospect.source = 'csv'
    and not exists (
      select 1
      from jsonb_array_elements(p_rows) as source(item)
      where source.item ->> 'external_id' = prospect.external_id
    );

  -- Une proposition encore en attente dépend de l'ancienne cohorte. Elle est
  -- invalidée dans la même transaction ; les décisions déjà prises restent
  -- historiques et conservent leurs preuves minimisées.
  delete from public.actions as action
  where action.organization_id = p_organization_id
    and action.status = 'proposed'
    and exists (
      select 1
      from unnest(action.data_sources) as source(label)
      where lower(source.label) like '%csv%'
    );

  -- Le briefing est un cache dérivé de la cohorte précédente.
  delete from public.briefings
  where organization_id = p_organization_id;

  v_imported := jsonb_array_length(p_rows);

  update public.connectors
  set
    status = 'connected',
    encrypted_credentials = null,
    config = jsonb_build_object(
      'file_name', p_file_name,
      'file_fingerprint', p_file_fingerprint,
      'field_mapping', p_field_mapping,
      'delimiter', p_delimiter,
      'last_imported_at', v_now,
      'last_import_count', v_imported,
      'ignored_rows', p_ignored_rows,
      'data_authorization_version', p_authorization_version
    )
  where id = v_connector_id
    and organization_id = p_organization_id;

  insert into public.journal (
    organization_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    'connector_synced',
    'user',
    p_actor_id,
    jsonb_build_object(
      'provider', 'csv',
      'name', 'Fichier CSV',
      'count', v_imported,
      'ignored', p_ignored_rows,
      'mode', 'import',
      'file_name', p_file_name,
      'data_authorization_version', p_authorization_version
    )
  );

  return jsonb_build_object(
    'imported', v_imported,
    'ignored', p_ignored_rows,
    'connector_id', v_connector_id
  );
end;
$$;

create or replace function public.clear_csv_prospects(
  p_organization_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connector_id uuid;
  v_deleted integer;
begin
  if p_organization_id is null or p_actor_id is null then
    raise exception using
      errcode = '22023',
      message = 'invalid CSV removal';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using
      errcode = '42501',
      message = 'CSV removal forbidden';
  end if;

  perform 1
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;
  if not found then
    raise exception using
      errcode = '23503',
      message = 'CSV removal organization not found';
  end if;

  select connector.id
    into v_connector_id
    from public.connectors as connector
    where connector.organization_id = p_organization_id
      and connector.provider = 'csv'
    for update;

  if not found then
    return jsonb_build_object('cleared', false, 'reason', 'not_found');
  end if;

  if exists (
    select 1
    from public.prospects as prospect
    where prospect.connector_id = v_connector_id
      and (
        prospect.organization_id is distinct from p_organization_id
        or prospect.source is distinct from 'csv'
      )
  )
  then
    raise exception using
      errcode = '55000',
      message = 'CSV connector contains non-CSV prospects';
  end if;

  select count(*)::integer
    into v_deleted
    from public.prospects as prospect
    where prospect.organization_id = p_organization_id
      and prospect.connector_id = v_connector_id
      and prospect.source = 'csv';

  -- Le retrait d'une source réelle retire aussi les contenus dérivés mutables
  -- qui peuvent recopier noms, emails ou brouillons. Le journal append-only
  -- reste, séparément, la trace d'audit des opérations déjà réalisées.
  delete from public.actions as action
  where action.organization_id = p_organization_id
    and exists (
      select 1
      from unnest(action.data_sources) as source(label)
      where lower(source.label) like '%csv%'
    );

  delete from public.briefings
  where organization_id = p_organization_id;

  delete from public.connectors
  where id = v_connector_id
    and organization_id = p_organization_id;

  insert into public.journal (
    organization_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    'connector_disconnected',
    'user',
    p_actor_id,
    jsonb_build_object(
      'provider', 'csv',
      'name', 'Fichier CSV',
      'deleted_prospects', v_deleted,
      'mode', 'import_removal'
    )
  );

  return jsonb_build_object('cleared', true, 'deleted', v_deleted);
end;
$$;

revoke execute on function public.replace_csv_prospects(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.replace_csv_prospects(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  integer,
  integer
) to service_role;

revoke execute on function public.clear_csv_prospects(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.clear_csv_prospects(uuid, uuid)
  to service_role;

comment on function public.replace_csv_prospects(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  integer,
  integer
) is
  'Atomically replaces one organization CSV prospects and journals the import.';
comment on function public.clear_csv_prospects(uuid, uuid) is
  'Atomically removes one organization CSV connector and journals the removal.';

do $csv_import_postconditions$
begin
  if pg_catalog.has_function_privilege(
      'authenticated',
      'public.replace_csv_prospects(uuid,uuid,text,text,text,jsonb,jsonb,integer,integer)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.replace_csv_prospects(uuid,uuid,text,text,text,jsonb,jsonb,integer,integer)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.replace_csv_prospects(uuid,uuid,text,text,text,jsonb,jsonb,integer,integer)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.clear_csv_prospects(uuid,uuid)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.clear_csv_prospects(uuid,uuid)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.clear_csv_prospects(uuid,uuid)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0021 CSV functions found unsafe privileges';
  end if;
end
$csv_import_postconditions$;

update public.app_schema_version
set version = greatest(version, 21),
    updated_at = now()
where id = 1
  and version >= 20;

do $csv_import_readiness_postcondition$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 21
  ) then
    raise exception using
      errcode = '55000',
      message = '0021 atomic CSV import did not certify schema version 21';
  end if;
end
$csv_import_readiness_postcondition$;
