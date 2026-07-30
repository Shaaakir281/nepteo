-- Rattrapage additif de la frontière RLS commerciale.
--
-- Les bases ayant déjà exécuté 0015/0016 ne rejouent pas ces fichiers après
-- leur durcissement. Cette migration réapplique donc les policies finales sans
-- recréer les helpers historiques, vérifie qu'aucune policy parallèle ne
-- rouvre les contenus libres/dérivés, puis relève le marqueur de schéma.

drop policy if exists memory_all on public.company_memory;
drop policy if exists company_memory_select on public.company_memory;
create policy company_memory_select
  on public.company_memory
  for select
  using (
    left(section, 2) <> '__'
    and public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists actions_select on public.actions;
create policy actions_select
  on public.actions
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists journal_select on public.journal;
create policy journal_select
  on public.journal
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists outbox_select on public.outbox_messages;
create policy outbox_select
  on public.outbox_messages
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists research_runs_select on public.research_runs;
create policy research_runs_select
  on public.research_runs
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists briefings_select on public.briefings;
create policy briefings_select
  on public.briefings
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists ad_metrics_select on public.ad_metrics;
create policy ad_metrics_select
  on public.ad_metrics
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists revenue_select on public.revenue_events;
create policy revenue_select
  on public.revenue_events
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
  );

drop policy if exists connectors_select on public.connectors;
create policy connectors_select
  on public.connectors
  for select
  using (
    public.has_org_role(
      organization_id,
      array['admin', 'marketing', 'direction', 'lecture']
    )
    or (
      public.has_org_role(organization_id, array['commercial'])
      and type not in ('ads', 'payments')
    )
  );

-- Réaffirme les contrats de colonnes : jamais de SELECT table complet pour un
-- JWT, uniquement les colonnes normalisées explicitement expurgées. Les
-- REVOKE colonne par colonne retirent aussi d'éventuels anciens grants de
-- colonnes, que le REVOKE table-level seul ne couvre pas.
revoke select on table public.organizations from public, anon, authenticated;
revoke select (
  id,
  name,
  activity,
  created_at,
  execution_paused,
  autonomy_level
) on table public.organizations from public, anon, authenticated;
grant select on table public.organizations to service_role;
grant select (
  id,
  name,
  created_at,
  execution_paused,
  autonomy_level
) on table public.organizations to authenticated;

revoke select on table public.connectors from public, anon, authenticated;
revoke select (
  id,
  organization_id,
  type,
  provider,
  status,
  encrypted_credentials,
  config,
  created_at
) on table public.connectors from public, anon, authenticated;
grant select on table public.connectors to service_role;
grant select (
  id,
  organization_id,
  type,
  provider,
  status,
  created_at
) on table public.connectors to authenticated;

revoke select on table public.prospects from public, anon, authenticated;
revoke select (
  id,
  organization_id,
  connector_id,
  external_id,
  name,
  email,
  company,
  stage,
  source,
  raw,
  synced_at,
  notes,
  note_internal,
  last_contact_at
)
  on table public.prospects
  from public, anon, authenticated;
grant select on table public.prospects to service_role;
grant select (
  id,
  organization_id,
  connector_id,
  external_id,
  name,
  email,
  company,
  stage,
  source,
  synced_at,
  last_contact_at
) on table public.prospects to authenticated;

-- Réapplique également la frontière privée du singleton de readiness. Une base
-- ayant déjà exécuté 0016 possède la table ; toute absence est donc un échec de
-- migration plutôt qu'une recréation silencieuse d'un schéma incomplet.
alter table public.app_schema_version enable row level security;
revoke all on table public.app_schema_version from public, anon, authenticated;
grant select on table public.app_schema_version to service_role;

-- Contrôle de postcondition : toute policy SELECT/ALL supplémentaire est
-- inspectée. Une ancienne policy is_member ou une nouvelle exception
-- commerciale fait échouer la migration avant le relèvement de version.
do $commercial_rls_postconditions$
begin
  if exists (
    select 1
    from (
      values
        ('company_memory', 'company_memory_select'),
        ('actions', 'actions_select'),
        ('journal', 'journal_select'),
        ('outbox_messages', 'outbox_select'),
        ('research_runs', 'research_runs_select'),
        ('briefings', 'briefings_select'),
        ('ad_metrics', 'ad_metrics_select'),
        ('revenue_events', 'revenue_select'),
        ('connectors', 'connectors_select')
    ) as expected(table_name, policy_name)
    left join pg_catalog.pg_policies as policy_def
      on policy_def.schemaname = 'public'
      and policy_def.tablename = expected.table_name
      and policy_def.policyname = expected.policy_name
      and policy_def.cmd = 'SELECT'
    where policy_def.policyname is null
  ) then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up missing expected policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'company_memory',
        'actions',
        'journal',
        'outbox_messages',
        'research_runs',
        'briefings',
        'ad_metrics',
        'revenue_events'
      )
      and cmd in ('SELECT', 'ALL')
      and (
        coalesce(qual, '') not like '%has_org_role%'
        or coalesce(qual, '') not like '%lecture%'
        or coalesce(qual, '') like '%commercial%'
        or (
          tablename = 'company_memory'
          and (
            coalesce(qual, '') not like '%section%'
            or coalesce(qual, '') not like '%__%'
          )
        )
      )
  ) then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found permissive derived-data policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'connectors'
      and cmd in ('SELECT', 'ALL')
      and (
        policyname <> 'connectors_select'
        or coalesce(qual, '') not like '%has_org_role%'
        or coalesce(qual, '') not like '%commercial%'
        or coalesce(qual, '') not like '%ads%'
        or coalesce(qual, '') not like '%payments%'
      )
  ) then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found permissive connector policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'company_memory'
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found client memory write policy';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.organizations',
    'SELECT'
  )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.organizations',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.organizations',
      'SELECT'
    )
    or pg_catalog.has_column_privilege(
      'authenticated',
      'public.organizations',
      'activity',
      'SELECT'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found unsafe organization privileges';
  end if;

  if exists (
    select 1
    from unnest(
      array['id', 'name', 'created_at', 'execution_paused', 'autonomy_level']
    ) as allowed(column_name)
    where not pg_catalog.has_column_privilege(
      'authenticated',
      'public.organizations',
      allowed.column_name,
      'SELECT'
    )
  ) then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up missing safe organization privileges';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.connectors',
    'SELECT'
  )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.connectors',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.connectors',
      'SELECT'
    )
    or exists (
      select 1
      from unnest(
        array['config', 'encrypted_credentials']
      ) as forbidden(column_name)
      where pg_catalog.has_column_privilege(
        'authenticated',
        'public.connectors',
        forbidden.column_name,
        'SELECT'
      )
    )
  then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found unsafe connector privileges';
  end if;

  if exists (
    select 1
    from unnest(
      array['id', 'organization_id', 'type', 'provider', 'status', 'created_at']
    ) as allowed(column_name)
    where not pg_catalog.has_column_privilege(
      'authenticated',
      'public.connectors',
      allowed.column_name,
      'SELECT'
    )
  ) then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up missing safe connector privileges';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.prospects',
    'SELECT'
  )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.prospects',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.prospects',
      'SELECT'
    )
    or exists (
      select 1
      from unnest(array['raw', 'notes', 'note_internal']) as forbidden(column_name)
      where pg_catalog.has_column_privilege(
        'authenticated',
        'public.prospects',
        forbidden.column_name,
        'SELECT'
      )
    )
  then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found unsafe prospect privileges';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_def
    where table_def.oid = 'public.app_schema_version'::regclass
      and table_def.relrowsecurity
  )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.app_schema_version',
      'SELECT'
    )
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.app_schema_version',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.app_schema_version',
      'SELECT'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0019 commercial RLS catch-up found unsafe readiness privileges';
  end if;
end
$commercial_rls_postconditions$;

insert into public.app_schema_version (id, version)
values (1, 19)
on conflict (id) do nothing;

update public.app_schema_version
set version = greatest(version, 19),
    updated_at = now();
