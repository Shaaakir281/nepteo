-- CAMP-0 : proposition de campagne idempotente et atomique.
--
-- Cette migration n'ajoute aucun chemin d'exécution. Elle sépare la clé de
-- soumission d'une proposition de `actions.idempotency_key`, réservée au claim
-- d'exécution, puis crée action + journal dans une seule transaction.

do $campaign_proposal_prerequisites$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1 and version >= 24
  ) then
    raise exception using errcode = '55000',
      message = '0025 campaign proposals requires schema version 24';
  end if;

  if to_regclass('public.actions') is null
    or to_regclass('public.journal') is null
    or to_regclass('public.memberships') is null
  then
    raise exception using errcode = '55000',
      message = '0025 campaign proposals requires actions, journal and memberships';
  end if;
end
$campaign_proposal_prerequisites$;

alter table public.actions
  add column if not exists proposal_request_key uuid;

create unique index if not exists actions_campaign_proposal_request_uidx
  on public.actions (organization_id, proposal_request_key)
  where proposal_request_key is not null;

create or replace function public.propose_campaign_action(
  p_organization_id uuid,
  p_actor_id uuid,
  p_request_key uuid,
  p_title text,
  p_finding text,
  p_rationale text,
  p_data_sources text[],
  p_expected_impact text,
  p_confidence numeric,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_id uuid;
  v_existing public.actions%rowtype;
  v_brief jsonb;
  v_plan jsonb;
  v_variants jsonb;
  v_daily_budget numeric;
  v_duration integer;
  v_success_threshold numeric;
  v_total_budget numeric;
begin
  if p_organization_id is null
    or p_actor_id is null
    or p_request_key is null
    or char_length(btrim(coalesce(p_title, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_finding, ''))) not between 1 and 2000
    or char_length(btrim(coalesce(p_rationale, ''))) not between 1 and 2000
    or coalesce(cardinality(p_data_sources), 0) not between 1 and 10
    or char_length(btrim(coalesce(p_expected_impact, ''))) not between 1 and 1000
    or p_confidence is null
    or p_confidence < 0
    or p_confidence > 1
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception using errcode = '22023',
      message = 'invalid campaign proposal';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501',
      message = 'campaign proposal forbidden';
  end if;

  v_brief := p_payload -> 'brief';
  v_plan := p_payload -> 'plan';
  v_variants := p_payload -> 'variants';

  if jsonb_typeof(v_brief) is distinct from 'object'
    or jsonb_typeof(v_plan) is distinct from 'object'
    or jsonb_typeof(v_variants) is distinct from 'array'
    or not (v_brief ?& array[
      'objective', 'campaignType', 'audience', 'offer', 'hypothesis',
      'channel', 'dailyBudget', 'durationDays', 'primaryMetric',
      'successThreshold', 'context'
    ])
    or not (v_plan ?& array['totalBudget', 'durationDays', 'dailyCap'])
    or jsonb_typeof(v_brief -> 'objective') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'campaignType') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'audience') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'offer') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'hypothesis') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'channel') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'dailyBudget') is distinct from 'number'
    or jsonb_typeof(v_brief -> 'durationDays') is distinct from 'number'
    or jsonb_typeof(v_brief -> 'primaryMetric') is distinct from 'string'
    or jsonb_typeof(v_brief -> 'successThreshold') is distinct from 'number'
    or jsonb_typeof(v_brief -> 'context') is distinct from 'string'
    or jsonb_typeof(v_plan -> 'totalBudget') is distinct from 'number'
    or jsonb_typeof(v_plan -> 'durationDays') is distinct from 'number'
    or jsonb_typeof(v_plan -> 'dailyCap') is distinct from 'number'
    or jsonb_array_length(v_variants) <> 2
    or jsonb_typeof(v_variants -> 0) is distinct from 'string'
    or jsonb_typeof(v_variants -> 1) is distinct from 'string'
    or p_payload ->> 'execution' is distinct from 'not_available_camp_0'
  then
    raise exception using errcode = '22023',
      message = 'invalid campaign proposal payload';
  end if;

  if v_brief ->> 'objective' not in (
      'offer_sales', 'new_customers', 'trials', 'appointments',
      'retargeting', 'awareness', 'nurturing', 'reactivation'
    )
    or v_brief ->> 'campaignType' not in (
      'awareness', 'acquisition', 'consideration', 'conversion',
      'retargeting', 'nurturing', 'reactivation'
    )
    or v_brief ->> 'channel' not in ('meta', 'google', 'linkedin')
    or v_brief ->> 'primaryMetric' not in (
      'contacts', 'appointments', 'trials', 'sales', 'conversion_rate', 'roas'
    )
    or char_length(v_brief ->> 'audience') not between 3 and 500
    or char_length(v_brief ->> 'offer') not between 3 and 500
    or char_length(v_brief ->> 'hypothesis') not between 10 and 1000
    or char_length(coalesce(v_brief ->> 'context', '')) > 2000
    or char_length(v_variants ->> 0) not between 10 and 500
    or char_length(v_variants ->> 1) not between 10 and 500
  then
    raise exception using errcode = '22023',
      message = 'campaign proposal is outside allowed lists or text bounds';
  end if;

  begin
    v_daily_budget := (v_brief ->> 'dailyBudget')::numeric;
    v_duration := (v_brief ->> 'durationDays')::integer;
    v_success_threshold := (v_brief ->> 'successThreshold')::numeric;
    v_total_budget := (v_plan ->> 'totalBudget')::numeric;
  exception when others then
    raise exception using errcode = '22023',
      message = 'campaign proposal contains invalid numeric values';
  end;

  if v_daily_budget < 5
    or v_daily_budget > 1000
    or v_daily_budget <> round(v_daily_budget, 2)
    or v_duration not in (7, 14, 30)
    or v_success_threshold < 0.1
    or v_success_threshold > 100000
    or v_success_threshold <> round(v_success_threshold, 2)
    or (
      v_brief ->> 'primaryMetric' not in ('conversion_rate', 'roas')
      and v_success_threshold < 1
    )
    or (v_brief ->> 'primaryMetric' = 'conversion_rate' and v_success_threshold > 100)
    or (v_brief ->> 'primaryMetric' = 'roas' and v_success_threshold > 20)
    or v_total_budget <> round(v_daily_budget * v_duration, 2)
    or (v_plan ->> 'durationDays')::integer <> v_duration
    or (v_plan ->> 'dailyCap')::numeric <> v_daily_budget
  then
    raise exception using errcode = '22023',
      message = 'campaign proposal is outside numeric bounds or was not recalculated';
  end if;

  insert into public.actions (
    organization_id,
    kind,
    title,
    finding,
    rationale,
    data_sources,
    expected_impact,
    confidence,
    risk,
    status,
    proposal_request_key,
    payload
  )
  values (
    p_organization_id,
    'launch_campaign',
    btrim(p_title),
    btrim(p_finding),
    btrim(p_rationale),
    p_data_sources,
    btrim(p_expected_impact),
    p_confidence,
    'medium',
    'proposed',
    p_request_key,
    p_payload
  )
  on conflict (organization_id, proposal_request_key)
    where proposal_request_key is not null
    do nothing
  returning id into v_action_id;

  if v_action_id is null then
    select *
      into v_existing
      from public.actions as action
      where action.organization_id = p_organization_id
        and action.proposal_request_key = p_request_key;

    if not found then
      raise exception using errcode = '40001',
        message = 'campaign proposal idempotency state unavailable';
    end if;

    if v_existing.kind <> 'launch_campaign'
      or v_existing.title is distinct from btrim(p_title)
      or v_existing.finding is distinct from btrim(p_finding)
      or v_existing.rationale is distinct from btrim(p_rationale)
      or v_existing.data_sources is distinct from p_data_sources
      or v_existing.expected_impact is distinct from btrim(p_expected_impact)
      or v_existing.confidence is distinct from p_confidence
      or v_existing.risk <> 'medium'
      or v_existing.payload is distinct from p_payload
    then
      raise exception using errcode = '23505',
        message = 'campaign proposal idempotency payload conflict';
    end if;

    return jsonb_build_object(
      'created', false,
      'action_id', v_existing.id
    );
  end if;

  insert into public.journal (
    organization_id,
    action_id,
    event,
    actor,
    actor_id,
    payload
  )
  values (
    p_organization_id,
    v_action_id,
    'action_proposed',
    'agent',
    p_actor_id,
    jsonb_build_object(
      'kind', 'launch_campaign',
      'title', btrim(p_title),
      'request_key', p_request_key,
      'demo', coalesce((p_payload ->> 'demo')::boolean, false)
    )
  );

  return jsonb_build_object(
    'created', true,
    'action_id', v_action_id
  );
end;
$$;

revoke execute on function public.propose_campaign_action(
  uuid, uuid, uuid, text, text, text, text[], text, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.propose_campaign_action(
  uuid, uuid, uuid, text, text, text, text[], text, numeric, jsonb
) to service_role;

comment on column public.actions.proposal_request_key is
  'CAMP-0 request key for atomic idempotent proposal creation; distinct from execution claims.';
comment on function public.propose_campaign_action(
  uuid, uuid, uuid, text, text, text, text[], text, numeric, jsonb
) is
  'Atomically creates one non-executable campaign proposal and its journal entry.';

do $campaign_proposal_postconditions$
begin
  if to_regprocedure(
    'public.propose_campaign_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)'
  ) is null then
    raise exception using errcode = '55000',
      message = '0025 campaign proposal function is incomplete';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'actions'
      and indexname = 'actions_campaign_proposal_request_uidx'
  ) then
    raise exception using errcode = '55000',
      message = '0025 campaign proposal idempotency index is missing';
  end if;

  if pg_catalog.has_function_privilege(
      'public',
      'public.propose_campaign_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.propose_campaign_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.propose_campaign_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.propose_campaign_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)',
      'EXECUTE'
    )
  then
    raise exception using errcode = '55000',
      message = '0025 campaign proposal found unsafe function privileges';
  end if;
end
$campaign_proposal_postconditions$;

update public.app_schema_version
set version = greatest(version, 25),
    updated_at = now()
where id = 1;

do $campaign_proposal_readiness$
begin
  if not exists (
    select 1
    from public.app_schema_version
    where id = 1 and version >= 25
  ) then
    raise exception using errcode = '55000',
      message = '0025 campaign proposals did not certify schema version 25';
  end if;
end
$campaign_proposal_readiness$;
