-- Marqueur de compatibilité utilisé par GET /api/ready.
--
-- La version est un minimum requis par le code, pas une égalité stricte :
-- une révision applicative compatible avec la version 16 accepte donc les
-- migrations additives 17 et suivantes.
--
-- Avant de certifier cette version, vérifier les invariants critiques des
-- migrations 0012 à 0015. Un objet absent ou permissif interrompt la migration :
-- aucune table ni ligne de readiness ne doit alors être créée.
do $readiness_prerequisites$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prospects'
      and column_name = 'last_contact_at'
      and data_type = 'date'
      and is_nullable = 'YES'
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite missing: prospects.last_contact_at date';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_def
    where constraint_def.conrelid = 'public.memberships'::regclass
      and constraint_def.conname = 'memberships_user_id_unique'
      and constraint_def.contype = 'u'
      and pg_catalog.pg_get_constraintdef(constraint_def.oid) = 'UNIQUE (user_id)'
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite missing: one organization per user';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_def
    where table_def.oid = 'public.company_memory'::regclass
      and table_def.relrowsecurity
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite missing: company_memory RLS';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'company_memory'
      and policyname = 'company_memory_select'
      and cmd = 'SELECT'
      and coalesce(qual, '') like '%has_org_role%'
      and coalesce(qual, '') like '%lecture%'
      and coalesce(qual, '') not like '%commercial%'
      and coalesce(qual, '') like '%section%'
      and coalesce(qual, '') like '%__%'
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite missing: company_memory fail-closed read policy';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'company_memory'
      and (
        policyname = 'memory_all'
        or cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      )
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite violated: company_memory client write policy';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.has_org_role(uuid,text[])', true),
        ('public.is_financial_action_kind(text)', false),
        ('public.is_commercial_safe_action_kind(text)', false),
        ('public.is_financial_journal_event(text)', false),
        ('public.is_commercial_safe_journal_event(text)', false),
        ('public.is_financial_connector_ref(text,text)', false),
        ('public.is_financial_action(uuid,uuid)', true),
        ('public.is_commercial_safe_action(uuid,uuid)', true)
    ) as expected(signature, requires_security_definer)
    left join pg_catalog.pg_proc as function_def
      on function_def.oid = pg_catalog.to_regprocedure(expected.signature)
    where function_def.oid is null
      or function_def.prokind <> 'f'
      or (
        expected.requires_security_definer
        and not function_def.prosecdef
      )
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite missing: financial boundary functions';
  end if;

  if exists (
    select 1
    from (
      values
        ('ad_metrics', 'ad_metrics_select'),
        ('revenue_events', 'revenue_select'),
        ('research_runs', 'research_runs_select'),
        ('briefings', 'briefings_select'),
        ('actions', 'actions_select'),
        ('journal', 'journal_select'),
        ('outbox_messages', 'outbox_select'),
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
      message = '0016 readiness prerequisite missing: financial select policies';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'ad_metrics',
        'revenue_events',
        'research_runs',
        'briefings',
        'company_memory',
        'actions',
        'journal',
        'outbox_messages'
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
      message = '0016 readiness prerequisite violated: commercial derived-data policy';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'connectors'
      and policyname = 'connectors_select'
      and coalesce(qual, '') like '%commercial%'
      and coalesce(qual, '') like '%ads%'
      and coalesce(qual, '') like '%payments%'
  ) then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite violated: connector financial policy';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'prospects'
      and grantee = 'PUBLIC'
      and privilege_type = 'SELECT'
  )
    or pg_catalog.has_table_privilege(
      'anon',
      'public.prospects',
      'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.prospects',
      'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role',
      'public.prospects',
      'SELECT'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite violated: prospects table privileges';
  end if;

  if exists (
    select 1
    from unnest(
      array[
        'id',
        'organization_id',
        'connector_id',
        'external_id',
        'name',
        'email',
        'company',
        'stage',
        'source',
        'synced_at',
        'last_contact_at'
      ]
    ) as allowed(column_name)
    where not pg_catalog.has_column_privilege(
      'authenticated',
      'public.prospects',
      allowed.column_name,
      'SELECT'
    )
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
    or pg_catalog.has_any_column_privilege(
      'anon',
      'public.prospects',
      'SELECT'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0016 readiness prerequisite violated: prospects column privileges';
  end if;
end
$readiness_prerequisites$;

create table public.app_schema_version (
  id smallint primary key check (id = 1),
  version integer not null check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.app_schema_version enable row level security;

revoke all on table public.app_schema_version from public, anon, authenticated;
grant select on table public.app_schema_version to service_role;

insert into public.app_schema_version (id, version)
values (1, 16);

comment on table public.app_schema_version is
  'Singleton schema compatibility marker for the application readiness check.';
