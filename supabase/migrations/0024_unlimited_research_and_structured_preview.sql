-- I3 : compteur de recherche sans plafond et sortie website_preview fiable.
--
-- Le compteur quotidien et le verrou d'organisation sont conservés : chaque
-- appel payant reste réservé atomiquement et la pause reste prioritaire.
-- `p_daily_limit = null` signifie seulement qu'aucun plafond budgétaire ne
-- bloque l'utilisateur. Une limite entière reste supportée pour une éventuelle
-- politique future explicite.

do $unlimited_research_prerequisites$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 23
  ) then
    raise exception using
      errcode = '55000',
      message = '0024 unlimited research requires schema version 23';
  end if;

  if to_regclass('public.research_daily_usage') is null
    or to_regclass('public.organizations') is null
  then
    raise exception using
      errcode = '55000',
      message = '0024 unlimited research requires research usage tables';
  end if;
end
$unlimited_research_prerequisites$;

create or replace function public.reserve_research_call(
  p_organization_id uuid,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage_date date := (statement_timestamp() at time zone 'UTC')::date;
  v_paused boolean;
  v_used integer;
begin
  if p_organization_id is null
    or (
      p_daily_limit is not null
      and (p_daily_limit < 1 or p_daily_limit > 10000)
    )
  then
    raise exception using
      errcode = '22023',
      message = 'invalid research quota reservation';
  end if;

  -- Même verrou que `change_execution_control` : une pause gagnante interdit
  -- l'appel ; une réservation gagnante est comptée avant toute dépense réseau.
  select organization.execution_paused
    into v_paused
    from public.organizations as organization
    where organization.id = p_organization_id
    for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'research quota organization not found';
  end if;

  if v_paused then
    select usage.reserved_calls
      into v_used
      from public.research_daily_usage as usage
      where usage.organization_id = p_organization_id
        and usage.usage_date = v_usage_date;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'paused',
      'used', coalesce(v_used, 0)
    );
  end if;

  insert into public.research_daily_usage as usage (
    organization_id,
    usage_date,
    reserved_calls,
    updated_at
  )
  values (p_organization_id, v_usage_date, 1, statement_timestamp())
  on conflict (organization_id, usage_date)
  do update
    set reserved_calls = usage.reserved_calls + 1,
        updated_at = statement_timestamp()
    where p_daily_limit is null
      or usage.reserved_calls < p_daily_limit
  returning reserved_calls into v_used;

  -- Cette branche ne peut être atteinte en mode sans limite. Elle préserve le
  -- contrat de la RPC si une limite explicite est réintroduite plus tard.
  if v_used is null then
    select usage.reserved_calls
      into v_used
      from public.research_daily_usage as usage
      where usage.organization_id = p_organization_id
        and usage.usage_date = v_usage_date;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_cap',
      'used', coalesce(v_used, p_daily_limit)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'used', v_used
  );
end;
$$;

revoke execute on function public.reserve_research_call(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_research_call(uuid, integer)
  to service_role;

comment on function public.reserve_research_call(uuid, integer) is
  'Atomically records one paid web-research call; a null limit never blocks usage.';

do $unlimited_research_postconditions$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.reserve_research_call(uuid,integer)'::regprocedure
  ) into v_definition;

  if v_definition is null
    or v_definition not like '%p_daily_limit is null%'
    or v_definition not like '%for update%'
  then
    raise exception using
      errcode = '55000',
      message = '0024 unlimited research function is incomplete';
  end if;

  if pg_catalog.has_function_privilege(
      'authenticated',
      'public.reserve_research_call(uuid,integer)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.reserve_research_call(uuid,integer)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.reserve_research_call(uuid,integer)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '55000',
      message = '0024 unlimited research found unsafe privileges';
  end if;
end
$unlimited_research_postconditions$;

update public.app_schema_version
set version = greatest(version, 24),
    updated_at = now()
where id = 1
  and version >= 23;

do $unlimited_research_readiness$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1
      and version >= 24
  ) then
    raise exception using
      errcode = '55000',
      message = '0024 unlimited research did not certify schema version 24';
  end if;
end
$unlimited_research_readiness$;
