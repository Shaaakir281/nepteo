-- CAMP-1 : studio de proposition arbitrable, toujours non exécutable.
--
-- La fonction v2 distingue l'intention éditable du snapshot serveur. Un rejeu
-- de la même intention reste donc idempotent même si les métriques ont évolué.

do $campaign_studio_prerequisites$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 25
  ) then
    raise exception using errcode = '55000',
      message = '0026 campaign studio requires schema version 25';
  end if;
  if to_regclass('public.research_runs') is null then
    raise exception using errcode = '55000',
      message = '0026 campaign studio requires research_runs';
  end if;
end
$campaign_studio_prerequisites$;

alter table public.research_runs
  drop constraint if exists research_runs_kind_check;
alter table public.research_runs
  add constraint research_runs_kind_check
  check (kind in (
    'company_profile', 'prospect_company', 'website_preview',
    'campaign_competition'
  ));

create or replace function public.propose_campaign_studio_action(
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
  v_intent jsonb;
  v_brief jsonb;
  v_plan jsonb;
  v_intent_studio jsonb;
  v_studio jsonb;
  v_adsets jsonb;
  v_snapshot_adsets jsonb;
  v_hooks jsonb;
  v_selected jsonb;
  v_variants jsonb;
  v_formats jsonb;
  v_daily_budget numeric;
  v_duration integer;
  v_success_threshold numeric;
  v_total_budget numeric;
  v_allocation_total integer := 0;
  v_adset_budget_total numeric := 0;
  v_adset_count integer;
  v_hook_count integer;
  v_expected_formats jsonb;
  v_item jsonb;
  v_snapshot_item jsonb;
  v_index integer;
  v_budget numeric;
  v_allocation integer;
begin
  if p_organization_id is null
    or p_actor_id is null
    or p_request_key is null
    or char_length(btrim(coalesce(p_title, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_finding, ''))) not between 1 and 2000
    or char_length(btrim(coalesce(p_rationale, ''))) not between 1 and 2000
    or coalesce(cardinality(p_data_sources), 0) not between 1 and 10
    or exists (
      select 1 from unnest(p_data_sources) as source(value)
      where char_length(btrim(coalesce(source.value, ''))) not between 1 and 300
    )
    or char_length(btrim(coalesce(p_expected_impact, ''))) not between 1 and 1000
    or p_confidence is null or p_confidence < 0 or p_confidence > 1
    or jsonb_typeof(p_payload) is distinct from 'object'
  then
    raise exception using errcode = '22023', message = 'invalid campaign studio proposal';
  end if;

  if not exists (
    select 1 from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'campaign proposal forbidden';
  end if;

  v_intent := p_payload -> 'intent';
  v_brief := p_payload -> 'brief';
  v_plan := p_payload -> 'plan';
  v_studio := p_payload -> 'studio';
  v_intent_studio := v_intent -> 'studio';
  v_adsets := v_intent_studio -> 'adSets';
  v_snapshot_adsets := v_studio -> 'adSets';
  v_hooks := v_intent_studio -> 'hooks';
  v_selected := v_intent_studio -> 'selectedHookIndices';
  v_variants := p_payload -> 'variants';
  v_formats := v_studio -> 'expectedFormats';

  if p_payload ->> 'proposalVersion' is distinct from '2'
    or p_payload ->> 'execution' is distinct from 'not_available_camp_1'
    or jsonb_typeof(v_intent) is distinct from 'object'
    or v_intent ->> 'proposalVersion' is distinct from '2'
    or jsonb_typeof(v_brief) is distinct from 'object'
    or v_intent -> 'brief' is distinct from v_brief
    or jsonb_typeof(v_plan) is distinct from 'object'
    or jsonb_typeof(v_intent_studio) is distinct from 'object'
    or jsonb_typeof(v_studio) is distinct from 'object'
    or jsonb_typeof(v_adsets) is distinct from 'array'
    or jsonb_typeof(v_snapshot_adsets) is distinct from 'array'
    or jsonb_typeof(v_hooks) is distinct from 'array'
    or jsonb_typeof(v_selected) is distinct from 'array'
    or jsonb_typeof(v_variants) is distinct from 'array'
    or jsonb_typeof(v_formats) is distinct from 'array'
    or jsonb_typeof(p_payload -> 'evidence') is distinct from 'object'
    or jsonb_typeof(p_payload -> 'projection') is distinct from 'object'
    or (p_payload ? 'demo' and jsonb_typeof(p_payload -> 'demo') is distinct from 'boolean')
    or v_intent_studio ->> 'proposalVersion' is distinct from '2'
    or v_studio ->> 'proposalVersion' is distinct from '2'
  then
    raise exception using errcode = '22023', message = 'invalid campaign studio payload shape';
  end if;

  if not (v_brief ?& array[
      'objective', 'campaignType', 'audience', 'offer', 'hypothesis',
      'channel', 'dailyBudget', 'durationDays', 'primaryMetric',
      'successThreshold', 'context'
    ])
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
    or not (v_plan ?& array[
      'totalBudget', 'durationDays', 'dailyCap', 'costPerContact',
      'contactsMin', 'contactsMax', 'confidence', 'stopCostPerContact'
    ])
    or jsonb_typeof(v_plan -> 'totalBudget') is distinct from 'number'
    or jsonb_typeof(v_plan -> 'durationDays') is distinct from 'number'
    or jsonb_typeof(v_plan -> 'dailyCap') is distinct from 'number'
    or jsonb_typeof(v_plan -> 'costPerContact') not in ('number', 'null')
    or jsonb_typeof(v_plan -> 'contactsMin') not in ('number', 'null')
    or jsonb_typeof(v_plan -> 'contactsMax') not in ('number', 'null')
    or jsonb_typeof(v_plan -> 'confidence') not in ('number', 'null')
    or jsonb_typeof(v_plan -> 'stopCostPerContact') not in ('number', 'null')
    or v_brief ->> 'objective' not in (
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
  then
    raise exception using errcode = '22023', message = 'campaign studio brief is invalid';
  end if;

  begin
    v_daily_budget := (v_brief ->> 'dailyBudget')::numeric;
    v_duration := (v_brief ->> 'durationDays')::integer;
    v_success_threshold := (v_brief ->> 'successThreshold')::numeric;
    v_total_budget := (v_plan ->> 'totalBudget')::numeric;
  exception when others then
    raise exception using errcode = '22023', message = 'campaign studio numerics are invalid';
  end;

  if v_daily_budget < 5 or v_daily_budget > 1000
    or v_daily_budget <> round(v_daily_budget, 2)
    or v_duration not in (7, 14, 30)
    or v_success_threshold < 0.1 or v_success_threshold > 100000
    or v_success_threshold <> round(v_success_threshold, 2)
    or (v_brief ->> 'primaryMetric' not in ('conversion_rate', 'roas') and v_success_threshold < 1)
    or (v_brief ->> 'primaryMetric' = 'conversion_rate' and v_success_threshold > 100)
    or (v_brief ->> 'primaryMetric' = 'roas' and v_success_threshold > 20)
    or v_total_budget <> round(v_daily_budget * v_duration, 2)
    or (v_plan ->> 'durationDays')::integer <> v_duration
    or (v_plan ->> 'dailyCap')::numeric <> v_daily_budget
    or p_confidence is distinct from coalesce((v_plan ->> 'confidence')::numeric, 0)
  then
    raise exception using errcode = '22023', message = 'campaign studio plan was not recalculated';
  end if;

  v_adset_count := jsonb_array_length(v_adsets);
  v_hook_count := jsonb_array_length(v_hooks);
  if v_adset_count not between 1 and 5
    or jsonb_array_length(v_snapshot_adsets) <> v_adset_count
    or v_hook_count not between 2 and 6
    or v_studio -> 'hooks' is distinct from v_hooks
    or v_studio -> 'selectedHookIndices' is distinct from v_selected
    or jsonb_array_length(v_selected) not between 1 and v_hook_count
  then
    raise exception using errcode = '22023', message = 'campaign studio cardinality is invalid';
  end if;

  if exists (
      select 1 from jsonb_array_elements(v_hooks) as hook(value)
      where jsonb_typeof(hook.value) is distinct from 'string'
    )
    or exists (
      select 1 from jsonb_array_elements_text(v_hooks) as hook(value)
      where char_length(btrim(hook.value)) not between 10 and 500
    )
    or (
      select count(*) from jsonb_array_elements_text(v_hooks)
    ) <> (
      select count(distinct lower(btrim(hook.value)))
      from jsonb_array_elements_text(v_hooks) as hook(value)
    )
    or exists (
      select 1 from jsonb_array_elements(v_selected) as selected(value)
      where jsonb_typeof(selected.value) <> 'number'
        or selected.value::text !~ '^[0-9]+$'
        or selected.value::text::integer < 0
        or selected.value::text::integer >= v_hook_count
    )
    or (
      select count(*) from jsonb_array_elements(v_selected)
    ) <> (
      select count(distinct selected.value::text::integer)
      from jsonb_array_elements(v_selected) as selected(value)
    )
  then
    raise exception using errcode = '22023', message = 'campaign studio hooks are invalid';
  end if;

  if jsonb_array_length(v_variants) <> jsonb_array_length(v_selected)
    or v_variants is distinct from (
      select jsonb_agg(v_hooks -> (selected.value::text::integer) order by selected.ordinality)
      from jsonb_array_elements(v_selected) with ordinality
        as selected(value, ordinality)
    )
  then
    raise exception using errcode = '22023',
      message = 'campaign studio selected variants are inconsistent';
  end if;

  for v_item, v_index in
    select item.value, item.ordinality::integer - 1
    from jsonb_array_elements(v_adsets) with ordinality as item(value, ordinality)
  loop
    v_snapshot_item := v_snapshot_adsets -> v_index;
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_snapshot_item) is distinct from 'object'
      or not (v_item ?& array[
        'id', 'name', 'objective', 'audience', 'hypothesis',
        'strategy', 'allocationBps'
      ])
      or not (v_snapshot_item ?& array[
        'id', 'name', 'objective', 'audience', 'hypothesis', 'strategy',
        'allocationBps', 'allocationPercent', 'budgetCents', 'budget'
      ])
      or jsonb_typeof(v_item -> 'id') is distinct from 'string'
      or jsonb_typeof(v_item -> 'name') is distinct from 'string'
      or jsonb_typeof(v_item -> 'objective') is distinct from 'string'
      or jsonb_typeof(v_item -> 'audience') is distinct from 'string'
      or jsonb_typeof(v_item -> 'hypothesis') is distinct from 'string'
      or jsonb_typeof(v_item -> 'strategy') is distinct from 'string'
      or jsonb_typeof(v_snapshot_item -> 'allocationPercent') is distinct from 'number'
      or jsonb_typeof(v_snapshot_item -> 'budgetCents') is distinct from 'number'
      or jsonb_typeof(v_snapshot_item -> 'budget') is distinct from 'number'
      or char_length(v_item ->> 'id') not between 3 and 64
      or (v_item ->> 'id') !~ '^[a-z0-9][a-z0-9_-]{2,63}$'
      or char_length(v_item ->> 'name') not between 3 and 100
      or v_item ->> 'objective' not in (
        'offer_sales', 'new_customers', 'trials', 'appointments',
        'retargeting', 'awareness', 'nurturing', 'reactivation'
      )
      or char_length(v_item ->> 'audience') not between 3 and 500
      or char_length(v_item ->> 'hypothesis') not between 10 and 1000
      or v_item ->> 'strategy' not in (
        'brief_audience', 'high_intent_visitors', 'recent_trials',
        'broad_signals', 'social_engagers', 'video_viewers'
      )
      or jsonb_typeof(v_item -> 'allocationBps') is distinct from 'number'
      or (v_item ->> 'allocationBps') !~ '^[0-9]+$'
      or (v_snapshot_item - 'allocationPercent' - 'budgetCents' - 'budget') is distinct from v_item
    then
      raise exception using errcode = '22023', message = 'campaign studio adset is invalid';
    end if;
    begin
      v_allocation := (v_item ->> 'allocationBps')::integer;
      v_budget := (v_snapshot_item ->> 'budget')::numeric;
    exception when others then
      raise exception using errcode = '22023', message = 'campaign studio adset numerics are invalid';
    end;
    if v_allocation not between 1 and 10000
      or v_budget <> round(v_budget, 2)
      or (v_snapshot_item ->> 'budgetCents')::integer is distinct from round(v_budget * 100)
      or (v_snapshot_item ->> 'allocationPercent')::numeric is distinct from v_allocation / 100.0
    then
      raise exception using errcode = '22023', message = 'campaign studio adset budget is invalid';
    end if;
    v_allocation_total := v_allocation_total + v_allocation;
    v_adset_budget_total := v_adset_budget_total + v_budget;
  end loop;

  if v_allocation_total is distinct from 10000
    or round(v_adset_budget_total, 2) is distinct from v_total_budget
    or (
      select count(*) from jsonb_array_elements(v_adsets)
    ) <> (
      select count(distinct item.value ->> 'id') from jsonb_array_elements(v_adsets) as item(value)
    )
    or exists (
      with shares as (
        select
          item.ordinality::integer - 1 as item_index,
          item.value ->> 'id' as item_id,
          floor(
            round(v_total_budget * 100)::bigint
              * (item.value ->> 'allocationBps')::integer
              / 10000.0
          )::integer as base_cents,
          mod(
            round(v_total_budget * 100)::bigint
              * (item.value ->> 'allocationBps')::integer,
            10000
          ) as remainder
        from jsonb_array_elements(v_adsets) with ordinality
          as item(value, ordinality)
      ), ranked as (
        select
          shares.*,
          row_number() over (order by remainder desc, item_id asc)::integer as remainder_rank,
          sum(base_cents) over ()::integer as base_total,
          round(v_total_budget * 100)::integer as total_cents
        from shares
      )
      select 1 from ranked
      where (v_snapshot_adsets -> item_index ->> 'budgetCents')::integer
        is distinct from base_cents + case
          when remainder_rank <= total_cents - base_total then 1 else 0
        end
    )
  then
    raise exception using errcode = '22023', message = 'campaign studio allocation total is invalid';
  end if;

  v_expected_formats := case v_brief ->> 'channel'
    when 'meta' then '[{"value":"feed","label":"Fil d''actualité"},{"value":"story","label":"Story"}]'::jsonb
    when 'google' then '[{"value":"responsive_ad","label":"Annonce responsive"}]'::jsonb
    when 'linkedin' then '[{"value":"sponsored_content","label":"Contenu sponsorisé"}]'::jsonb
  end;
  if v_formats is distinct from v_expected_formats then
    raise exception using errcode = '22023', message = 'campaign studio formats were not server-derived';
  end if;

  insert into public.actions (
    organization_id, kind, title, finding, rationale, data_sources,
    expected_impact, confidence, risk, status, proposal_request_key, payload
  ) values (
    p_organization_id, 'launch_campaign', btrim(p_title), btrim(p_finding),
    btrim(p_rationale), p_data_sources, btrim(p_expected_impact), p_confidence,
    'medium', 'proposed', p_request_key, p_payload
  )
  on conflict (organization_id, proposal_request_key)
    where proposal_request_key is not null
    do nothing
  returning id into v_action_id;

  if v_action_id is null then
    select * into v_existing from public.actions as action
    where action.organization_id = p_organization_id
      and action.proposal_request_key = p_request_key;
    if not found then
      raise exception using errcode = '40001',
        message = 'campaign proposal idempotency state unavailable';
    end if;
    if v_existing.kind <> 'launch_campaign'
      or v_existing.payload -> 'intent' is distinct from v_intent
    then
      raise exception using errcode = '23505',
        message = 'campaign proposal idempotency intent conflict';
    end if;
    return jsonb_build_object('created', false, 'action_id', v_existing.id);
  end if;

  insert into public.journal (
    organization_id, action_id, event, actor, actor_id, payload
  ) values (
    p_organization_id, v_action_id, 'action_proposed', 'agent', p_actor_id,
    jsonb_build_object(
      'kind', 'launch_campaign', 'title', btrim(p_title),
      'request_key', p_request_key,
      'proposal_version', 2,
      'demo', coalesce((p_payload ->> 'demo')::boolean, false)
    )
  );

  return jsonb_build_object('created', true, 'action_id', v_action_id);
end;
$$;

revoke execute on function public.propose_campaign_studio_action(
  uuid, uuid, uuid, text, text, text, text[], text, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.propose_campaign_studio_action(
  uuid, uuid, uuid, text, text, text, text[], text, numeric, jsonb
) to service_role;

comment on function public.propose_campaign_studio_action(
  uuid, uuid, uuid, text, text, text, text[], text, numeric, jsonb
) is
  'CAMP-1: atomically creates one non-executable proposal and journal; replays compare canonical intent only.';

do $campaign_studio_postconditions$
declare
  v_kind_check text;
begin
  select pg_get_constraintdef(constraint_def.oid)
    into v_kind_check
    from pg_constraint as constraint_def
    where constraint_def.conrelid = 'public.research_runs'::regclass
      and constraint_def.conname = 'research_runs_kind_check';
  if v_kind_check not like '%campaign_competition%'
    or to_regprocedure(
      'public.propose_campaign_studio_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)'
    ) is null
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.propose_campaign_studio_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.propose_campaign_studio_action(uuid,uuid,uuid,text,text,text,text[],text,numeric,jsonb)',
      'EXECUTE'
    )
  then
    raise exception using errcode = '55000',
      message = '0026 campaign studio postconditions failed';
  end if;
end
$campaign_studio_postconditions$;

update public.app_schema_version
set version = greatest(version, 26), updated_at = now()
where id = 1;

do $campaign_studio_readiness$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 26
  ) then
    raise exception using errcode = '55000',
      message = '0026 campaign studio did not certify schema version 26';
  end if;
end
$campaign_studio_readiness$;
