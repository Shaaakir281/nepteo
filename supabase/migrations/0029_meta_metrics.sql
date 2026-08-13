-- META-METRICS — photographie Meta Ads quotidienne, complète et lecture seule.
-- La lecture fournisseur reste hors transaction. Ces RPC appliquent ensuite
-- soit une photographie entière, soit un échec explicite, avec un journal
-- unique. Aucune fonction de mutation Ads n'est introduite.

do $meta_metrics_precondition$
begin
  if to_regclass('public.app_schema_version') is null
    or not exists (
      select 1 from public.app_schema_version where id = 1 and version >= 28
    ) then
    raise exception using
      errcode = '55000',
      message = '0029 meta metrics requires schema version 28';
  end if;
  if to_regclass('public.ad_metrics') is null
    or to_regclass('public.connectors') is null
    or to_regclass('public.journal') is null then
    raise exception using
      errcode = '55000',
      message = '0029 meta metrics requires connector and campaign foundations';
  end if;
end;
$meta_metrics_precondition$;

alter table public.ad_metrics
  alter column conversions drop not null,
  alter column conversions drop default,
  alter column revenue drop not null,
  alter column revenue drop default,
  add column connector_id uuid references public.connectors(id) on delete set null,
  add column account_id text,
  add column currency text,
  add column account_timezone text,
  add column attribution_model text,
  add column attribution_windows text[] not null default '{}',
  add column metric_provenance text not null default 'legacy_unverified',
  add column outcome_provenance text,
  add column data_quality text not null default 'unverified',
  add column observation_from date,
  add column observation_to date;

update public.ad_metrics
set
  outcome_provenance = case
    when campaign_id like 'demo:%' then 'demo'
    else 'legacy_unverified'
  end,
  data_quality = case
    when campaign_id like 'demo:%' then 'complete'
    else 'unverified'
  end;

alter table public.ad_metrics
  add constraint ad_metrics_account_id_format_chk
    check (account_id is null or account_id ~ '^act_[0-9]{1,32}$'),
  add constraint ad_metrics_currency_format_chk
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  add constraint ad_metrics_metric_provenance_chk
    check (metric_provenance in ('provider_reported', 'verified_downstream', 'demo', 'legacy_unverified')),
  add constraint ad_metrics_outcome_provenance_chk
    check (outcome_provenance is null or outcome_provenance in ('verified_downstream', 'demo', 'legacy_unverified')),
  add constraint ad_metrics_data_quality_chk
    check (data_quality in ('complete', 'stale', 'partial', 'unavailable', 'unverified')),
  add constraint ad_metrics_observation_window_chk
    check (
      (observation_from is null and observation_to is null)
      or (observation_from is not null and observation_to is not null and observation_from <= observation_to)
    ),
  add constraint ad_metrics_verified_outcomes_chk
    check (
      (conversions is null and revenue is null and outcome_provenance is null)
      or outcome_provenance is not null
    );

alter table public.ad_metrics
  drop constraint if exists ad_metrics_organization_id_provider_campaign_id_date_key;

create unique index ad_metrics_legacy_identity_uidx
  on public.ad_metrics (organization_id, provider, campaign_id, date)
  where account_id is null;

create unique index ad_metrics_provider_identity_uidx
  on public.ad_metrics (organization_id, provider, account_id, campaign_id, date)
  where account_id is not null;

create table public.ad_metric_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null references public.connectors(id) on delete cascade,
  provider text not null check (provider = 'meta_ads'),
  account_id text not null check (account_id ~ '^act_[0-9]{1,32}$'),
  idempotency_key text not null check (length(idempotency_key) between 20 and 200),
  snapshot_hash text check (snapshot_hash is null or snapshot_hash ~ '^[a-f0-9]{64}$'),
  quality text not null check (quality in ('complete', 'partial', 'unavailable')),
  applied boolean not null default false,
  error_code text,
  observation_from date,
  observation_to date,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  account_timezone text,
  campaign_count integer not null default 0 check (campaign_count between 0 and 500),
  metric_count integer not null default 0 check (metric_count between 0 and 5000),
  result_count integer not null default 0 check (result_count between 0 and 500000),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (
    (quality = 'complete' and applied and error_code is null and observation_from is not null and observation_to is not null)
    or (quality in ('partial', 'unavailable') and not applied and error_code is not null)
  )
);

alter table public.ad_metrics
  add column sync_run_id uuid references public.ad_metric_sync_runs(id) on delete set null;

alter table public.ad_metrics
  add constraint ad_metrics_id_organization_key unique (id, organization_id);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null references public.connectors(id) on delete cascade,
  provider text not null check (provider = 'meta_ads'),
  account_id text not null check (account_id ~ '^act_[0-9]{1,32}$'),
  campaign_id text not null check (campaign_id ~ '^[0-9]{1,32}$'),
  campaign_name text not null check (length(campaign_name) between 1 and 200),
  effective_status text not null check (length(effective_status) between 1 and 40),
  configured_status text not null check (length(configured_status) between 1 and 40),
  objective text check (objective is null or length(objective) between 1 and 80),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  account_timezone text not null check (length(account_timezone) between 1 and 80),
  sync_run_id uuid not null references public.ad_metric_sync_runs(id) on delete cascade,
  synced_at timestamptz not null,
  unique (organization_id, provider, account_id, campaign_id)
);

create table public.ad_metric_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_metric_id uuid not null,
  result_type text not null check (result_type ~ '^[A-Za-z0-9_.:-]{1,160}$'),
  result_value numeric(18,6) not null check (result_value >= 0),
  result_source text not null check (result_source in ('provider_reported', 'verified_downstream')),
  attribution_model text not null check (length(attribution_model) between 1 and 80),
  attribution_windows text[] not null default '{}',
  sync_run_id uuid not null references public.ad_metric_sync_runs(id) on delete cascade,
  synced_at timestamptz not null,
  foreign key (ad_metric_id, organization_id)
    references public.ad_metrics(id, organization_id) on delete cascade,
  unique (ad_metric_id, result_type, attribution_model, attribution_windows)
);

create index ad_metric_sync_runs_org_idx
  on public.ad_metric_sync_runs (organization_id, provider, completed_at desc);
create index ad_campaigns_org_idx
  on public.ad_campaigns (organization_id, provider, account_id, campaign_id);
create index ad_metric_results_org_idx
  on public.ad_metric_results (organization_id, result_type, synced_at desc);
create index ad_metrics_meta_window_idx
  on public.ad_metrics (organization_id, provider, account_id, date desc)
  where account_id is not null;

alter table public.ad_metric_sync_runs enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_metric_results enable row level security;

create policy ad_metric_sync_runs_select on public.ad_metric_sync_runs
  for select using (
    public.has_org_role(organization_id, array['admin', 'marketing', 'direction', 'lecture'])
  );
create policy ad_campaigns_select on public.ad_campaigns
  for select using (
    public.has_org_role(organization_id, array['admin', 'marketing', 'direction', 'lecture'])
  );
create policy ad_metric_results_select on public.ad_metric_results
  for select using (
    public.has_org_role(organization_id, array['admin', 'marketing', 'direction', 'lecture'])
  );

revoke all on table public.ad_metric_sync_runs, public.ad_campaigns, public.ad_metric_results
  from public, anon, authenticated;
grant select on table public.ad_metric_sync_runs, public.ad_campaigns, public.ad_metric_results
  to authenticated;
grant all on table public.ad_metric_sync_runs, public.ad_campaigns, public.ad_metric_results
  to service_role;

create or replace function public.apply_meta_metrics_snapshot(
  p_organization_id uuid,
  p_connector_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_started_at timestamptz,
  p_snapshot jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_connector public.connectors%rowtype;
  v_existing public.ad_metric_sync_runs%rowtype;
  v_run_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_account jsonb;
  v_account_id text;
  v_currency text;
  v_timezone text;
  v_from date;
  v_to date;
  v_campaigns jsonb;
  v_rows jsonb;
  v_campaign jsonb;
  v_row jsonb;
  v_result jsonb;
  v_metric_id uuid;
  v_campaign_count integer;
  v_metric_count integer;
  v_result_count integer;
  v_snapshot_hash text;
  v_state jsonb;
begin
  if p_started_at is null or p_started_at > v_now + interval '1 minute'
    or p_started_at < v_now - interval '30 minutes' then
    raise exception using errcode = '22023', message = 'invalid meta metrics start time';
  end if;
  if not exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_id
      and m.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'meta metrics actor forbidden';
  end if;

  select * into v_connector
  from public.connectors
  where id = p_connector_id and organization_id = p_organization_id
  for update;
  if not found or v_connector.provider <> 'meta_ads'
    or v_connector.encrypted_credentials is null
    or coalesce(v_connector.config #>> '{connection,consented_at}', '') = ''
    or coalesce(v_connector.config #>> '{connection,paused_at}', '') <> '' then
    raise exception using errcode = '55000', message = 'meta metrics connector unavailable';
  end if;

  select * into v_existing
  from public.ad_metric_sync_runs
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'replayed', true,
      'run_id', v_existing.id,
      'metrics', v_existing.metric_count,
      'results', v_existing.result_count
    );
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_snapshot ->> 'version' is distinct from '2'
    or p_snapshot ->> 'provider' is distinct from 'meta_ads'
    or p_snapshot ->> 'quality' is distinct from 'complete'
    or jsonb_typeof(p_snapshot -> 'account') is distinct from 'object'
    or jsonb_typeof(p_snapshot -> 'campaigns') is distinct from 'array'
    or jsonb_typeof(p_snapshot -> 'rows') is distinct from 'array'
    or p_snapshot #>> '{attribution,model}' is distinct from 'requested_windows'
    or p_snapshot #> '{attribution,windows}' is distinct from '["7d_click", "1d_view"]'::jsonb then
    raise exception using errcode = '22023', message = 'invalid meta metrics snapshot';
  end if;

  v_account := p_snapshot -> 'account';
  v_account_id := v_account ->> 'id';
  v_currency := v_account ->> 'currency';
  v_timezone := v_account ->> 'timezone';
  v_from := (p_snapshot ->> 'observation_from')::date;
  v_to := (p_snapshot ->> 'observation_to')::date;
  v_campaigns := p_snapshot -> 'campaigns';
  v_rows := p_snapshot -> 'rows';
  v_campaign_count := jsonb_array_length(v_campaigns);
  v_metric_count := jsonb_array_length(v_rows);

  if coalesce(v_account_id, '') !~ '^act_[0-9]{1,32}$'
    or v_account_id is distinct from v_connector.config #>> '{meta_ad_account,id}'
    or coalesce(v_currency, '') !~ '^[A-Z]{3}$'
    or v_currency is distinct from v_connector.config #>> '{meta_ad_account,currency}'
    or coalesce(length(v_timezone), 0) not between 1 and 80
    or v_from is null
    or v_to is null
    or v_timezone is distinct from v_connector.config #>> '{meta_ad_account,timezone}'
    or v_from > v_to
    or v_to - v_from + 1 not in (7, 14, 30)
    or v_campaign_count > 500
    or v_metric_count > 5000 then
    raise exception using errcode = '22023', message = 'meta metrics snapshot outside contract';
  end if;

  if exists (
    select 1 from public.ad_metric_sync_runs r
    where r.organization_id = p_organization_id
      and r.connector_id = p_connector_id
      and r.account_id = v_account_id
      and r.observation_from = v_from
      and r.observation_to = v_to
      and r.quality = 'complete'
      and r.started_at > p_started_at
  ) then
    raise exception using errcode = 'PT409', message = 'stale snapshot';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_campaigns) c(value)
    where jsonb_typeof(c.value) is distinct from 'object'
      or coalesce(c.value ->> 'id', '') !~ '^[0-9]{1,32}$'
      or length(coalesce(c.value ->> 'name', '')) not between 1 and 200
      or length(coalesce(c.value ->> 'status', '')) not between 1 and 40
      or length(coalesce(c.value ->> 'configured_status', '')) not between 1 and 40
      or not (c.value ? 'objective')
      or (
        c.value -> 'objective' <> 'null'::jsonb
        and length(coalesce(c.value ->> 'objective', '')) not between 1 and 80
      )
  ) or exists (
    select 1 from (
      select c.value ->> 'id' id, count(*) count
      from jsonb_array_elements(v_campaigns) c(value)
      group by c.value ->> 'id'
    ) duplicates where duplicates.count > 1
  ) then
    raise exception using errcode = '22023', message = 'invalid meta campaigns snapshot';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) r(value)
    where jsonb_typeof(r.value) is distinct from 'object'
      or coalesce(r.value ->> 'campaign_id', '') !~ '^[0-9]{1,32}$'
      or length(coalesce(r.value ->> 'campaign_name', '')) not between 1 and 200
      or coalesce(r.value ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or (r.value ->> 'date')::date < v_from
      or (r.value ->> 'date')::date > v_to
      or jsonb_typeof(r.value -> 'impressions') is distinct from 'number'
      or (r.value ->> 'impressions')::numeric < 0
      or (r.value ->> 'impressions')::numeric > 2147483647
      or (r.value ->> 'impressions')::numeric <> trunc((r.value ->> 'impressions')::numeric)
      or jsonb_typeof(r.value -> 'clicks') is distinct from 'number'
      or (r.value ->> 'clicks')::numeric < 0
      or (r.value ->> 'clicks')::numeric > 2147483647
      or (r.value ->> 'clicks')::numeric <> trunc((r.value ->> 'clicks')::numeric)
      or jsonb_typeof(r.value -> 'spend') is distinct from 'number'
      or (r.value ->> 'spend')::numeric < 0
      or (r.value ->> 'spend')::numeric > 9999999999.99
      or (r.value ->> 'spend')::numeric <> round((r.value ->> 'spend')::numeric, 2)
      or jsonb_typeof(r.value -> 'results') is distinct from 'array'
      or jsonb_array_length(r.value -> 'results') > 100
      or not exists (
        select 1 from jsonb_array_elements(v_campaigns) c(value)
        where c.value ->> 'id' = r.value ->> 'campaign_id'
          and c.value ->> 'name' = r.value ->> 'campaign_name'
      )
  ) or exists (
    select 1 from (
      select r.value ->> 'campaign_id' campaign_id, r.value ->> 'date' metric_date, count(*) count
      from jsonb_array_elements(v_rows) r(value)
      group by r.value ->> 'campaign_id', r.value ->> 'date'
    ) duplicates where duplicates.count > 1
  ) then
    raise exception using errcode = '22023', message = 'invalid meta metric rows';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) r(value)
    cross join lateral jsonb_array_elements(r.value -> 'results') result(value)
    where jsonb_typeof(result.value) is distinct from 'object'
      or coalesce(result.value ->> 'type', '') !~ '^[A-Za-z0-9_.:-]{1,160}$'
      or result.value ->> 'source' is distinct from 'provider_reported'
      or jsonb_typeof(result.value -> 'value') is distinct from 'number'
      or (result.value ->> 'value')::numeric < 0
      or (result.value ->> 'value')::numeric > 999999999999
      or (result.value ->> 'value')::numeric <> round((result.value ->> 'value')::numeric, 6)
  ) or exists (
    select 1 from (
      select
        r.value ->> 'campaign_id' campaign_id,
        r.value ->> 'date' metric_date,
        result.value ->> 'type' result_type,
        count(*) count
      from jsonb_array_elements(v_rows) r(value)
      cross join lateral jsonb_array_elements(r.value -> 'results') result(value)
      group by r.value ->> 'campaign_id', r.value ->> 'date', result.value ->> 'type'
    ) duplicates where duplicates.count > 1
  ) then
    raise exception using errcode = '22023', message = 'invalid meta metric results';
  end if;

  select count(*)::integer into v_result_count
  from jsonb_array_elements(v_rows) r(value)
  cross join lateral jsonb_array_elements(r.value -> 'results') result(value);
  v_snapshot_hash := substring(p_idempotency_key from '([a-f0-9]{64})$');

  insert into public.ad_metric_sync_runs (
    id, organization_id, connector_id, provider, account_id, idempotency_key,
    snapshot_hash, quality, applied, observation_from, observation_to, currency,
    account_timezone, campaign_count, metric_count, result_count, started_at,
    completed_at
  ) values (
    v_run_id, p_organization_id, p_connector_id, 'meta_ads', v_account_id,
    p_idempotency_key, v_snapshot_hash, 'complete', true, v_from, v_to,
    v_currency, v_timezone, v_campaign_count, v_metric_count, v_result_count,
    p_started_at, v_now
  );

  delete from public.ad_campaigns
  where organization_id = p_organization_id
    and provider = 'meta_ads'
    and connector_id = p_connector_id
    and account_id = v_account_id;

  for v_campaign in select value from jsonb_array_elements(v_campaigns)
  loop
    insert into public.ad_campaigns (
      organization_id, connector_id, provider, account_id, campaign_id,
      campaign_name, effective_status, configured_status, objective, currency,
      account_timezone, sync_run_id, synced_at
    ) values (
      p_organization_id, p_connector_id, 'meta_ads', v_account_id,
      v_campaign ->> 'id', v_campaign ->> 'name', v_campaign ->> 'status',
      v_campaign ->> 'configured_status', nullif(v_campaign ->> 'objective', ''),
      v_currency, v_timezone, v_run_id, v_now
    );
  end loop;

  delete from public.ad_metrics
  where organization_id = p_organization_id
    and provider = 'meta_ads'
    and connector_id = p_connector_id
    and account_id = v_account_id
    and date between v_from and v_to;

  for v_row in select value from jsonb_array_elements(v_rows)
  loop
    insert into public.ad_metrics (
      organization_id, provider, connector_id, account_id, campaign_id,
      campaign_name, date, impressions, clicks, spend, conversions, revenue,
      currency, account_timezone, attribution_model, attribution_windows,
      metric_provenance, outcome_provenance, data_quality, observation_from,
      observation_to, sync_run_id, synced_at
    ) values (
      p_organization_id, 'meta_ads', p_connector_id, v_account_id,
      v_row ->> 'campaign_id', v_row ->> 'campaign_name', (v_row ->> 'date')::date,
      (v_row ->> 'impressions')::integer, (v_row ->> 'clicks')::integer,
      (v_row ->> 'spend')::numeric, null, null, v_currency, v_timezone,
      'requested_windows', array['7d_click', '1d_view'], 'provider_reported',
      null, 'complete', v_from, v_to, v_run_id, v_now
    ) returning id into v_metric_id;

    for v_result in select value from jsonb_array_elements(v_row -> 'results')
    loop
      insert into public.ad_metric_results (
        organization_id, ad_metric_id, result_type, result_value, result_source,
        attribution_model, attribution_windows, sync_run_id, synced_at
      ) values (
        p_organization_id, v_metric_id, v_result ->> 'type',
        (v_result ->> 'value')::numeric, 'provider_reported',
        'requested_windows', array['7d_click', '1d_view'], v_run_id, v_now
      );
    end loop;
  end loop;

  v_state := jsonb_build_object(
    'version', 1,
    'quality', 'complete',
    'account_id', v_account_id,
    'observation_from', v_from,
    'observation_to', v_to,
    'currency', v_currency,
    'timezone', v_timezone,
    'campaign_count', v_campaign_count,
    'row_count', v_metric_count,
    'result_count', v_result_count,
    'completed_at', v_now
  );
  update public.connectors
  set
    status = 'connected',
    config = jsonb_set(
      jsonb_set(
        config - 'meta_insights_snapshot',
        '{meta_metrics_state}',
        v_state,
        true
      ),
      '{connection}',
      coalesce(config -> 'connection', '{}'::jsonb) || jsonb_build_object(
        'verified_source_at', coalesce(config #>> '{connection,verified_source_at}', v_now::text),
        'last_read_at', v_now,
        'last_read_status', 'ok'
      ) - 'last_error_code',
      true
    )
  where id = p_connector_id;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'meta_ads_metrics_snapshot_applied',
    'user',
    p_actor_id,
    jsonb_build_object(
      'provider', 'meta_ads',
      'account_id', v_account_id,
      'quality', 'complete',
      'observation_from', v_from,
      'observation_to', v_to,
      'currency', v_currency,
      'timezone', v_timezone,
      'campaign_count', v_campaign_count,
      'metric_count', v_metric_count,
      'result_count', v_result_count,
      'sync_run_id', v_run_id
    )
  );

  return jsonb_build_object(
    'replayed', false,
    'run_id', v_run_id,
    'metrics', v_metric_count,
    'results', v_result_count
  );
end;
$function$;

create or replace function public.record_meta_metrics_failure(
  p_organization_id uuid,
  p_connector_id uuid,
  p_actor_id uuid,
  p_account_id text,
  p_idempotency_key text,
  p_started_at timestamptz,
  p_quality text,
  p_error_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_connector public.connectors%rowtype;
  v_existing public.ad_metric_sync_runs%rowtype;
  v_run_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_state jsonb;
begin
  if p_quality not in ('partial', 'unavailable')
    or p_error_code not in (
      'timeout', 'provider_error', 'invalid_response', 'partial_response',
      'snapshot_too_large', 'account_changed', 'currency_mismatch',
      'persistence_failed', 'persistence_ambiguous', 'stale_snapshot'
    )
    or p_account_id !~ '^act_[0-9]{1,32}$'
    or p_started_at is null then
    raise exception using errcode = '22023', message = 'invalid meta metrics failure';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_id
      and m.role in ('admin', 'marketing', 'direction')
  ) then
    raise exception using errcode = '42501', message = 'meta metrics actor forbidden';
  end if;
  select * into v_connector
  from public.connectors
  where id = p_connector_id and organization_id = p_organization_id
  for update;
  if not found or v_connector.provider <> 'meta_ads'
    or p_account_id is distinct from v_connector.config #>> '{meta_ad_account,id}' then
    raise exception using errcode = '55000', message = 'meta metrics connector unavailable';
  end if;
  select * into v_existing
  from public.ad_metric_sync_runs
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('replayed', true, 'run_id', v_existing.id);
  end if;

  insert into public.ad_metric_sync_runs (
    id, organization_id, connector_id, provider, account_id, idempotency_key,
    quality, applied, error_code, started_at, completed_at
  ) values (
    v_run_id, p_organization_id, p_connector_id, 'meta_ads', p_account_id,
    p_idempotency_key, p_quality, false, p_error_code, p_started_at, v_now
  );

  v_state := jsonb_build_object(
    'version', 1,
    'quality', p_quality,
    'account_id', p_account_id,
    'completed_at', v_now,
    'error_code', p_error_code
  );
  update public.connectors
  set
    status = 'error',
    config = jsonb_set(
      jsonb_set(config, '{meta_metrics_state}', v_state, true),
      '{connection}',
      coalesce(config -> 'connection', '{}'::jsonb) || jsonb_build_object(
        'last_read_at', v_now,
        'last_read_status', 'error',
        'last_error_code', 'read_failed'
      ),
      true
    )
  where id = p_connector_id;

  insert into public.journal (
    organization_id, event, actor, actor_id, payload
  ) values (
    p_organization_id,
    'meta_ads_metrics_sync_failed',
    'user',
    p_actor_id,
    jsonb_build_object(
      'provider', 'meta_ads',
      'account_id', p_account_id,
      'quality', p_quality,
      'error_code', p_error_code,
      'sync_run_id', v_run_id
    )
  );
  return jsonb_build_object('replayed', false, 'run_id', v_run_id);
end;
$function$;

revoke execute on function public.apply_meta_metrics_snapshot(uuid, uuid, uuid, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_meta_metrics_snapshot(uuid, uuid, uuid, text, timestamptz, jsonb)
  to service_role;
revoke execute on function public.record_meta_metrics_failure(uuid, uuid, uuid, text, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.record_meta_metrics_failure(uuid, uuid, uuid, text, text, timestamptz, text, text)
  to service_role;

do $meta_metrics_postconditions$
begin
  if to_regclass('public.ad_metric_sync_runs') is null
    or to_regclass('public.ad_campaigns') is null
    or to_regclass('public.ad_metric_results') is null
    or to_regprocedure('public.apply_meta_metrics_snapshot(uuid,uuid,uuid,text,timestamp with time zone,jsonb)') is null
    or to_regprocedure('public.record_meta_metrics_failure(uuid,uuid,uuid,text,text,timestamp with time zone,text,text)') is null then
    raise exception using errcode = '55000', message = '0029 meta metrics postconditions failed';
  end if;
end;
$meta_metrics_postconditions$;

update public.app_schema_version
set version = greatest(version, 29), updated_at = now()
where id = 1;

do $meta_metrics_readiness_postcondition$
begin
  if not exists (
    select 1 from public.app_schema_version where id = 1 and version >= 29
  ) then
    raise exception using errcode = '55000', message = '0029 meta metrics did not certify schema version 29';
  end if;
end;
$meta_metrics_readiness_postcondition$;
