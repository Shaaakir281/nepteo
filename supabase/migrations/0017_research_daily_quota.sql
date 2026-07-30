-- Quota quotidien atomique des appels de recherche web payants.
--
-- `research_runs` reste exclusivement le cache par sujet. Ce compteur séparé
-- mémorise chaque réservation, y compris les recherches forcées et les appels
-- fournisseur qui échouent ensuite.
create table public.research_daily_usage (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  usage_date date not null,
  reserved_calls integer not null check (reserved_calls >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, usage_date)
);

alter table public.research_daily_usage enable row level security;

-- Le compteur n'est ni une donnée produit ni un cache lisible par le client.
-- Seule la RPC ci-dessous est exposée au service role.
revoke all on table public.research_daily_usage
  from public, anon, authenticated, service_role;

-- Reprise prudente de l'usage historique. `research_started` est append-only et
-- était écrit avant chaque appel externe : c'est la meilleure source disponible.
insert into public.research_daily_usage (
  organization_id,
  usage_date,
  reserved_calls,
  updated_at
)
select
  organization_id,
  (created_at at time zone 'UTC')::date,
  count(*)::integer,
  max(created_at)
from public.journal
where event = 'research_started'
group by organization_id, (created_at at time zone 'UTC')::date;

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
    or p_daily_limit is null
    or p_daily_limit < 1
    or p_daily_limit > 10000
  then
    raise exception using
      errcode = '22023',
      message = 'invalid research quota reservation';
  end if;

  -- Même verrou que `change_execution_control` (UPDATE organizations) :
  -- pause gagnante => refus ; réservation gagnante => claim payé durable.
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
    where usage.reserved_calls < p_daily_limit
  returning reserved_calls into v_used;

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
  'Atomically reserves one paid web-research call for an organization and UTC day.';

-- La readiness de la nouvelle révision exige désormais cette primitive.
do $$
begin
  update public.app_schema_version
  set version = greatest(version, 17),
      updated_at = now()
  where id = 1;

  if not found then
    raise exception using
      errcode = '55000',
      message = '0017_research_daily_quota requires the schema readiness marker';
  end if;
end
$$;
