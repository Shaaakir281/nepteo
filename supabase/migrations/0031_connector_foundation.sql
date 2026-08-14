-- Fondation transactionnelle des connecteurs réels.
--
-- Les appels fournisseur restent hors transaction. Une révision optimiste
-- empêche ensuite une lecture ancienne d'écraser une configuration plus
-- récente. Chaque application locale du résultat partage une transaction avec
-- son état connecteur et son unique événement de journal.

do $connector_foundation_prerequisites$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1 from public.app_schema_version where id = 1 and version >= 30
    )
  then
    raise exception using
      errcode = '55000',
      message = '0031 connector foundation requires schema version 30';
  end if;

  if to_regclass('public.connectors') is null
    or to_regclass('public.prospects') is null
    or to_regclass('public.journal') is null
  then
    raise exception using
      errcode = '55000',
      message = '0031 connector foundation requires connector tables';
  end if;
end
$connector_foundation_prerequisites$;

-- Le staging partagé possède déjà cette colonne sous une ancienne version de
-- migration. La créer seulement lorsqu'elle manque, puis refuser toute forme
-- incompatible au lieu de la réécrire silencieusement.
do $connector_foundation_revision$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'connectors'
      and column_name = 'revision'
  ) then
    alter table public.connectors
      add column revision bigint not null default 0
      check (revision >= 0);
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'connectors'
      and column_name = 'revision'
      and data_type = 'bigint'
      and is_nullable = 'NO'
      and column_default is not null
      and regexp_replace(column_default, '[^0-9-]', '', 'g') = '0'
  )
    or not exists (
      select 1
      from pg_constraint as connector_constraint
      join pg_class as connector_table
        on connector_table.oid = connector_constraint.conrelid
      join pg_namespace as connector_schema
        on connector_schema.oid = connector_table.relnamespace
      where connector_schema.nspname = 'public'
        and connector_table.relname = 'connectors'
        and connector_constraint.contype = 'c'
        and pg_get_constraintdef(connector_constraint.oid)
          ~ 'revision[[:space:]]*>=[[:space:]]*0'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0031 connector foundation found an incompatible revision column';
  end if;
end
$connector_foundation_revision$;

comment on column public.connectors.revision is
  'Optimistic connector version. Every atomic connector transition increments it.';

-- La variante staging 0029 nettoyait ici prospects.raw. La réconciliation
-- canonique ne réécrit aucune donnée métier existante ; la minimisation des
-- prochains snapshots reste assurée dans apply_connector_snapshot.

create or replace function public.assert_connector_mutation_allowed(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'connector organization not found';
  end if;

  if exists (
    select 1 from public.company_memory as memory
    where memory.organization_id = p_organization_id
      and memory.section = '__demo_backup'
  )
    or exists (
      select 1 from public.connectors as connector
      where connector.organization_id = p_organization_id
        and connector.provider = 'demo'
        and connector.config @> '{"demo": true}'::jsonb
    )
    or exists (
      select 1 from public.prospects as prospect
      where prospect.organization_id = p_organization_id
        and prospect.source = 'demo'
    )
  then
    raise exception using errcode = '55000', message = 'connector mutation blocked by an active demo scenario';
  end if;
end;
$$;

create or replace function public.authorize_connector(
  p_organization_id uuid,
  p_type text,
  p_provider text,
  p_encrypted_credentials text,
  p_config jsonb,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connector_id uuid;
  v_revision bigint;
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_type is null
    or p_type not in ('crm','analytics','ads','email','payments','files')
    or p_provider is null
    or p_provider !~ '^[a-z0-9_]{1,80}$'
    or nullif(p_encrypted_credentials, '') is null
    or length(p_encrypted_credentials) > 65536
    or p_config is null
    or jsonb_typeof(p_config) <> 'object'
    or p_config ?| array['access_token','refresh_token','client_secret','encrypted_credentials']
    or octet_length(p_config::text) > 262144
    or p_actor_id is null
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector authorization';
  end if;

  select connector.id, connector.revision
    into v_connector_id, v_revision
  from public.connectors as connector
  where connector.organization_id = p_organization_id
    and connector.provider = p_provider
  for update;

  if found then
    update public.connectors
    set type = p_type,
        status = 'disconnected',
        encrypted_credentials = p_encrypted_credentials,
        config = p_config,
        revision = revision + 1
    where id = v_connector_id
    returning revision into v_revision;
  else
    insert into public.connectors (
      organization_id, type, provider, status,
      encrypted_credentials, config, revision
    ) values (
      p_organization_id, p_type, p_provider, 'disconnected',
      p_encrypted_credentials, p_config, 1
    )
    returning id, revision into v_connector_id, v_revision;
  end if;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id, 'connector_authorized', 'user', p_actor_id, p_payload
  );

  return jsonb_build_object('connector_id', v_connector_id, 'revision', v_revision);
end;
$$;

create or replace function public.commit_connector_transition(
  p_organization_id uuid,
  p_connector_id uuid,
  p_expected_revision bigint,
  p_status text,
  p_config jsonb,
  p_event text,
  p_actor text,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_expected_revision is null or p_expected_revision < 0
    or p_status is null
    or p_status not in ('connected','disconnected','error')
    or p_event is null
    or p_event not in (
      'connector_configured', 'connector_paused', 'connector_resumed',
      'meta_ads_accounts_listed', 'meta_ads_account_selected',
      'meta_ads_metrics_read'
    )
    or p_actor is null
    or p_actor not in ('user','agent')
    or (p_actor = 'user' and p_actor_id is null)
    or p_config is null
    or jsonb_typeof(p_config) <> 'object'
    or p_config ?| array['access_token','refresh_token','client_secret','encrypted_credentials']
    or octet_length(p_config::text) > 262144
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector transition';
  end if;

  select connector.revision into v_revision
  from public.connectors as connector
  where connector.id = p_connector_id
    and connector.organization_id = p_organization_id
  for update;
  if not found or v_revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'connector configuration changed';
  end if;

  update public.connectors
  set status = p_status,
      config = p_config,
      revision = revision + 1
  where id = p_connector_id
    and organization_id = p_organization_id
  returning revision into v_revision;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id, p_event, p_actor, p_actor_id, p_payload
  );
  return jsonb_build_object('revision', v_revision);
end;
$$;

create or replace function public.persist_connector_credentials(
  p_organization_id uuid,
  p_connector_id uuid,
  p_expected_revision bigint,
  p_encrypted_credentials text,
  p_actor text,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_expected_revision is null or p_expected_revision < 0
    or nullif(p_encrypted_credentials, '') is null
    or length(p_encrypted_credentials) > 65536
    or p_actor is null
    or p_actor not in ('user','agent')
    or (p_actor = 'user' and p_actor_id is null)
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector credentials';
  end if;

  select connector.revision into v_revision
  from public.connectors as connector
  where connector.id = p_connector_id
    and connector.organization_id = p_organization_id
  for update;
  if not found or v_revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'connector configuration changed';
  end if;

  update public.connectors
  set encrypted_credentials = p_encrypted_credentials,
      revision = revision + 1
  where id = p_connector_id
    and organization_id = p_organization_id
  returning revision into v_revision;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id, 'connector_credentials_refreshed', p_actor, p_actor_id, p_payload
  );
  return jsonb_build_object('revision', v_revision);
end;
$$;

create or replace function public.apply_connector_snapshot(
  p_organization_id uuid,
  p_connector_id uuid,
  p_expected_revision bigint,
  p_provider text,
  p_rows jsonb,
  p_config jsonb,
  p_actor text,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_revision bigint;
  v_count integer;
  v_deleted integer;
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_expected_revision is null or p_expected_revision < 0
    or p_provider is null
    or p_provider not in ('google_sheets','notion')
    or p_rows is null
    or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) > 5000
    or p_config is null
    or jsonb_typeof(p_config) <> 'object'
    or p_config ?| array['access_token','refresh_token','client_secret','encrypted_credentials']
    or octet_length(p_config::text) > 262144
    or p_actor is null
    or p_actor not in ('user','agent')
    or (p_actor = 'user' and p_actor_id is null)
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector snapshot';
  end if;

  select connector.revision into v_revision
  from public.connectors as connector
  where connector.id = p_connector_id
    and connector.organization_id = p_organization_id
    and connector.provider = p_provider
    and connector.encrypted_credentials is not null
  for update;
  if not found or v_revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'connector configuration changed';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as source(item)
    where jsonb_typeof(source.item) <> 'object'
      or source.item - array[
        'external_id','name','email','company','stage','notes','last_contact_at','raw'
      ]::text[] <> '{}'::jsonb
      or nullif(source.item ->> 'external_id', '') is null
      or length(source.item ->> 'external_id') > 512
      or (
        nullif(btrim(source.item ->> 'name'), '') is null
        and nullif(btrim(source.item ->> 'email'), '') is null
      )
      or exists (
        select 1 from jsonb_each(source.item) as field(key, value)
        where field.key in ('name','email','company','stage','notes','last_contact_at')
          and jsonb_typeof(field.value) not in ('string','null')
      )
      or length(coalesce(source.item ->> 'name', '')) > 200
      or length(coalesce(source.item ->> 'email', '')) > 320
      or length(coalesce(source.item ->> 'company', '')) > 200
      or length(coalesce(source.item ->> 'stage', '')) > 120
      or length(coalesce(source.item ->> 'notes', '')) > 2000
      or (
        nullif(source.item ->> 'last_contact_at', '') is not null
        and source.item ->> 'last_contact_at' !~ '^\d{4}-\d{2}-\d{2}$'
      )
      or coalesce(jsonb_typeof(source.item -> 'raw'), 'null') <> 'object'
      or source.item -> 'raw' <> '{}'::jsonb
  ) then
    raise exception using errcode = '22023', message = 'invalid connector prospect row';
  end if;

  if (
    select count(*) <> count(distinct source.item ->> 'external_id')
    from jsonb_array_elements(p_rows) as source(item)
  ) then
    raise exception using errcode = '23505', message = 'duplicate connector prospect identity';
  end if;

  insert into public.prospects (
    organization_id, connector_id, external_id, name, email, company,
    stage, notes, last_contact_at, source, raw, synced_at
  )
  select
    p_organization_id,
    p_connector_id,
    source.item ->> 'external_id',
    nullif(source.item ->> 'name', ''),
    nullif(source.item ->> 'email', ''),
    nullif(source.item ->> 'company', ''),
    nullif(source.item ->> 'stage', ''),
    nullif(source.item ->> 'notes', ''),
    nullif(source.item ->> 'last_contact_at', '')::date,
    p_provider,
    '{}'::jsonb,
    v_now
  from jsonb_array_elements(p_rows) as source(item)
  on conflict (connector_id, external_id) do update
  set organization_id = excluded.organization_id,
      name = excluded.name,
      email = excluded.email,
      company = excluded.company,
      stage = excluded.stage,
      notes = excluded.notes,
      last_contact_at = excluded.last_contact_at,
      source = excluded.source,
      raw = '{}'::jsonb,
      synced_at = excluded.synced_at;

  delete from public.prospects as prospect
  where prospect.organization_id = p_organization_id
    and prospect.connector_id = p_connector_id
    and prospect.source = p_provider
    and not exists (
      select 1 from jsonb_array_elements(p_rows) as source(item)
      where source.item ->> 'external_id' = prospect.external_id
    );
  get diagnostics v_deleted = row_count;

  -- Chaque proposition prospect est calculée sur la cohorte canonique
  -- multi-source : tout remplacement de source invalide ces propositions.
  delete from public.actions as action
  where action.organization_id = p_organization_id
    and action.status = 'proposed'
    and exists (
      select 1 from unnest(action.data_sources) as source(label)
      where lower(source.label) like 'prospects (%'
    );
  delete from public.briefings where organization_id = p_organization_id;

  v_count := jsonb_array_length(p_rows);
  update public.connectors
  set status = 'connected',
      config = p_config,
      revision = revision + 1
  where id = p_connector_id
    and organization_id = p_organization_id
  returning revision into v_revision;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'connector_synced',
    p_actor,
    p_actor_id,
    p_payload || jsonb_build_object('count', v_count, 'removed', v_deleted)
  );
  return jsonb_build_object(
    'count', v_count, 'removed', v_deleted, 'revision', v_revision
  );
end;
$$;

create or replace function public.record_connector_sync_failure(
  p_organization_id uuid,
  p_connector_id uuid,
  p_expected_revision bigint,
  p_config jsonb,
  p_error_code text,
  p_actor text,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_expected_revision is null or p_expected_revision < 0
    or p_error_code is null
    or p_error_code not in (
    'token_expired','token_revoked','rate_limited','source_missing',
    'permission_denied','snapshot_too_large','timeout','invalid_response',
    'persistence_failed','configuration_changed','read_failed'
  )
    or p_actor is null
    or p_actor not in ('user','agent')
    or (p_actor = 'user' and p_actor_id is null)
    or p_config is null
    or jsonb_typeof(p_config) <> 'object'
    or p_config ?| array['access_token','refresh_token','client_secret','encrypted_credentials']
    or octet_length(p_config::text) > 262144
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector failure';
  end if;

  select connector.revision into v_revision
  from public.connectors as connector
  where connector.id = p_connector_id
    and connector.organization_id = p_organization_id
  for update;
  if not found or v_revision <> p_expected_revision then
    return jsonb_build_object('recorded', false);
  end if;

  update public.connectors
  set status = 'error',
      config = p_config,
      revision = revision + 1
  where id = p_connector_id
    and organization_id = p_organization_id
  returning revision into v_revision;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'connector_sync_failed',
    p_actor,
    p_actor_id,
    p_payload || jsonb_build_object('error_code', p_error_code)
  );
  return jsonb_build_object('recorded', true, 'revision', v_revision);
end;
$$;

create or replace function public.begin_connector_revocation(
  p_organization_id uuid,
  p_connector_id uuid,
  p_expected_revision bigint,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_now timestamptz := now();
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_expected_revision is null or p_expected_revision < 0
    or p_actor_id is null
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector revocation';
  end if;

  select connector.revision into v_revision
  from public.connectors as connector
  where connector.id = p_connector_id
    and connector.organization_id = p_organization_id
    and connector.encrypted_credentials is not null
  for update;
  if not found or v_revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'connector configuration changed';
  end if;

  update public.connectors
  set status = 'error',
      config = jsonb_set(
        config,
        '{revocation}',
        jsonb_build_object('status', 'pending', 'started_at', v_now),
        true
      ),
      revision = revision + 1
  where id = p_connector_id
    and organization_id = p_organization_id
  returning revision into v_revision;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'connector_revocation_started',
    'user',
    p_actor_id,
    p_payload
  );
  return jsonb_build_object('revision', v_revision);
end;
$$;

create or replace function public.finish_connector_revocation(
  p_organization_id uuid,
  p_connector_id uuid,
  p_expected_revision bigint,
  p_result text,
  p_actor_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
  v_now timestamptz := now();
begin
  perform public.assert_connector_mutation_allowed(p_organization_id);
  if p_expected_revision is null or p_expected_revision < 0
    or p_result is null
    or p_result not in ('revoked','unknown')
    or p_actor_id is null
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768
  then
    raise exception using errcode = '22023', message = 'invalid connector revocation result';
  end if;

  select connector.revision into v_revision
  from public.connectors as connector
  where connector.id = p_connector_id
    and connector.organization_id = p_organization_id
  for update;
  if not found or v_revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'connector configuration changed';
  end if;

  update public.connectors
  set status = 'disconnected',
      encrypted_credentials = null,
      config = jsonb_set(
        config - 'connection',
        '{revocation}',
        jsonb_build_object(
          'status', p_result,
          'finished_at', v_now,
          'local_credentials_cleared', true
        ),
        true
      ),
      revision = revision + 1
  where id = p_connector_id
    and organization_id = p_organization_id
  returning revision into v_revision;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'connector_disconnected',
    'user',
    p_actor_id,
    p_payload || jsonb_build_object(
      'revocation', p_result,
      'local_credentials_cleared', true
    )
  );
  return jsonb_build_object('revision', v_revision, 'revocation', p_result);
end;
$$;

revoke all on function public.assert_connector_mutation_allowed(uuid)
  from public, anon, authenticated;
revoke all on function public.authorize_connector(uuid,text,text,text,jsonb,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.commit_connector_transition(uuid,uuid,bigint,text,jsonb,text,text,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.persist_connector_credentials(uuid,uuid,bigint,text,text,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.apply_connector_snapshot(uuid,uuid,bigint,text,jsonb,jsonb,text,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.record_connector_sync_failure(uuid,uuid,bigint,jsonb,text,text,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.begin_connector_revocation(uuid,uuid,bigint,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_connector_revocation(uuid,uuid,bigint,text,uuid,jsonb)
  from public, anon, authenticated;

grant execute on function public.assert_connector_mutation_allowed(uuid) to service_role;
grant execute on function public.authorize_connector(uuid,text,text,text,jsonb,uuid,jsonb) to service_role;
grant execute on function public.commit_connector_transition(uuid,uuid,bigint,text,jsonb,text,text,uuid,jsonb) to service_role;
grant execute on function public.persist_connector_credentials(uuid,uuid,bigint,text,text,uuid,jsonb) to service_role;
grant execute on function public.apply_connector_snapshot(uuid,uuid,bigint,text,jsonb,jsonb,text,uuid,jsonb) to service_role;
grant execute on function public.record_connector_sync_failure(uuid,uuid,bigint,jsonb,text,text,uuid,jsonb) to service_role;
grant execute on function public.begin_connector_revocation(uuid,uuid,bigint,uuid,jsonb) to service_role;
grant execute on function public.finish_connector_revocation(uuid,uuid,bigint,text,uuid,jsonb) to service_role;

do $connector_foundation_postconditions$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'connectors'
      and column_name = 'revision'
      and is_nullable = 'NO'
  )
    or to_regprocedure('public.authorize_connector(uuid,text,text,text,jsonb,uuid,jsonb)') is null
    or to_regprocedure('public.commit_connector_transition(uuid,uuid,bigint,text,jsonb,text,text,uuid,jsonb)') is null
    or to_regprocedure('public.persist_connector_credentials(uuid,uuid,bigint,text,text,uuid,jsonb)') is null
    or to_regprocedure('public.apply_connector_snapshot(uuid,uuid,bigint,text,jsonb,jsonb,text,uuid,jsonb)') is null
    or to_regprocedure('public.record_connector_sync_failure(uuid,uuid,bigint,jsonb,text,text,uuid,jsonb)') is null
    or to_regprocedure('public.begin_connector_revocation(uuid,uuid,bigint,uuid,jsonb)') is null
    or to_regprocedure('public.finish_connector_revocation(uuid,uuid,bigint,text,uuid,jsonb)') is null
  then
    raise exception using errcode = '55000', message = '0031 connector foundation postconditions failed';
  end if;
end
$connector_foundation_postconditions$;

update public.app_schema_version
set version = greatest(version, 31), updated_at = now()
where id = 1 and version >= 30;

do $connector_foundation_readiness_postcondition$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 31
  ) then
    raise exception using errcode = '55000', message = '0031 connector foundation did not certify schema version 31';
  end if;
end
$connector_foundation_readiness_postcondition$;
