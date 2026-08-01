-- Laboratoire d'enrichissement web isolé de la fiche entreprise.
--
-- - nouveau kind/cache `website_preview`, sans écriture dans company_memory ;
-- - lecture service-role non mutante du quota du jour ;
-- - index de purge pour la rétention applicative de 30 jours.

do $website_preview_prerequisites$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 21
  ) then
    raise exception using
      errcode = '55000',
      message = '0022 website preview requires schema version 21';
  end if;

  if to_regclass('public.research_runs') is null
    or to_regclass('public.research_daily_usage') is null
  then
    raise exception using
      errcode = '55000',
      message = '0022 website preview requires research tables';
  end if;
end
$website_preview_prerequisites$;

alter table public.research_runs
  drop constraint if exists research_runs_kind_check;

alter table public.research_runs
  add constraint research_runs_kind_check
  check (kind in ('company_profile', 'prospect_company', 'website_preview'));

create index research_runs_website_preview_expiry
  on public.research_runs (created_at)
  where kind = 'website_preview';

create or replace function public.read_research_usage(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage_date date := (statement_timestamp() at time zone 'UTC')::date;
  v_used integer;
begin
  if p_organization_id is null then
    raise exception using
      errcode = '22023',
      message = 'invalid research usage organization';
  end if;

  perform 1
  from public.organizations as organization
  where organization.id = p_organization_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'research usage organization not found';
  end if;

  select usage.reserved_calls
    into v_used
    from public.research_daily_usage as usage
    where usage.organization_id = p_organization_id
      and usage.usage_date = v_usage_date;

  return jsonb_build_object(
    'used', coalesce(v_used, 0),
    'usage_date', v_usage_date
  );
end;
$$;

revoke execute on function public.read_research_usage(uuid)
  from public, anon, authenticated;
grant execute on function public.read_research_usage(uuid)
  to service_role;

comment on function public.read_research_usage(uuid) is
  'Reads today UTC paid web-research reservations without reserving a call.';

do $website_preview_postconditions$
declare
  v_kind_check text;
begin
  select pg_catalog.pg_get_constraintdef(constraint_def.oid)
    into v_kind_check
    from pg_catalog.pg_constraint as constraint_def
    where constraint_def.conrelid = 'public.research_runs'::regclass
      and constraint_def.conname = 'research_runs_kind_check'
      and constraint_def.contype = 'c';

  if v_kind_check is null
    or v_kind_check not like '%company_profile%'
    or v_kind_check not like '%prospect_company%'
    or v_kind_check not like '%website_preview%'
  then
    raise exception using
      errcode = '55000',
      message = '0022 website preview kind constraint is incomplete';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_def
    where table_def.oid = 'public.research_runs'::regclass
      and table_def.relrowsecurity
  )
    or not exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'research_runs'
        and policyname = 'research_runs_select'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%has_org_role%'
        and coalesce(qual, '') like '%lecture%'
        and coalesce(qual, '') not like '%commercial%'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0022 website preview found unsafe research RLS';
  end if;

  if pg_catalog.has_function_privilege(
      'authenticated',
      'public.read_research_usage(uuid)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.read_research_usage(uuid)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.read_research_usage(uuid)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0022 website preview found unsafe quota-read privileges';
  end if;
end
$website_preview_postconditions$;

update public.app_schema_version
set version = greatest(version, 22),
    updated_at = now()
where id = 1
  and version >= 21;

do $website_preview_readiness_postcondition$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 22
  ) then
    raise exception using
      errcode = '55000',
      message = '0022 website preview did not certify schema version 22';
  end if;
end
$website_preview_readiness_postcondition$;
