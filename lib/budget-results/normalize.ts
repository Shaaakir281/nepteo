import {
  attribution,
  currency,
  identityMatches,
  isoDate,
  isoTimestamp,
  isRecord,
  nonEmptyText,
  nonNegativeInteger,
  scaledInteger,
  timezone,
} from "./primitives.ts";
import type {
  BuildBudgetResultsInput,
  NormalizedAction,
  NormalizedCampaign,
  NormalizedLink,
  NormalizedMetric,
  NormalizedProviderBudget,
  NormalizedResult,
  NormalizedRun,
  NormalizeResult,
} from "./types.ts";

function normalizeProviderBudget(
  row: Record<string, unknown>,
): NormalizedProviderBudget | null | false {
  const values = [
    row.provider_budget_amount,
    row.provider_budget_kind,
    row.provider_budget_currency,
    row.provider_budget_source,
  ];
  if (values.every((value) => value === null || value === undefined)) return null;
  const amountCents = scaledInteger(values[0], 2);
  const normalizedCurrency = currency(values[2]);
  if (
    amountCents === null ||
    (values[1] !== "daily" && values[1] !== "lifetime") ||
    !normalizedCurrency ||
    values[3] !== "provider_reported"
  ) return false;
  return {
    amount: amountCents / 100,
    kind: values[1],
    currency: normalizedCurrency,
    source: "provider_reported",
  };
}

function normalizeRuns(
  values: unknown[],
  organizationId: string,
  accountId: string,
): NormalizedRun[] | NormalizeResult {
  const runs: NormalizedRun[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || !identityMatches(value, organizationId, accountId)) {
      return { ok: false, state: "incompatible", reason: "sync_run_identity_mismatch" };
    }
    const id = nonEmptyText(value.id);
    const completedAt = isoTimestamp(value.completed_at);
    const quality = value.quality;
    const applied = value.applied;
    const errorCode = value.error_code === null ? null : nonEmptyText(value.error_code, 80);
    const from = value.observation_from === null ? null : isoDate(value.observation_from);
    const to = value.observation_to === null ? null : isoDate(value.observation_to);
    const runCurrency = value.currency === null ? null : currency(value.currency);
    const runTimezone = value.account_timezone === null ? null : timezone(value.account_timezone);
    const campaignCount = nonNegativeInteger(value.campaign_count);
    const metricCount = nonNegativeInteger(value.metric_count);
    const resultCount = nonNegativeInteger(value.result_count);
    if (
      !id || ids.has(id) || !completedAt ||
      (quality !== "complete" && quality !== "partial" && quality !== "unavailable") ||
      typeof applied !== "boolean" || campaignCount === null || metricCount === null ||
      resultCount === null
    ) {
      return { ok: false, state: "incompatible", reason: "invalid_sync_run" };
    }
    if (
      quality === "complete"
        ? !applied || errorCode !== null || !from || !to || from > to || !runCurrency || !runTimezone
        : applied || !errorCode
    ) {
      return { ok: false, state: "incompatible", reason: "invalid_sync_run_state" };
    }
    ids.add(id);
    runs.push({
      id,
      quality,
      applied,
      errorCode,
      from,
      to,
      currency: runCurrency,
      timezone: runTimezone,
      campaignCount,
      metricCount,
      resultCount,
      completedAt,
    });
  }
  return runs;
}

function normalizeCampaigns(
  values: unknown[],
  organizationId: string,
  accountId: string,
): NormalizedCampaign[] | NormalizeResult {
  const campaigns: NormalizedCampaign[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || !identityMatches(value, organizationId, accountId)) {
      return { ok: false, state: "incompatible", reason: "campaign_identity_mismatch" };
    }
    const campaignId = nonEmptyText(value.campaign_id, 40);
    const campaignName = nonEmptyText(value.campaign_name, 200);
    const configuredStatus = nonEmptyText(value.configured_status, 40);
    const effectiveStatus = nonEmptyText(value.effective_status, 40);
    const objective = value.objective === null ? null : nonEmptyText(value.objective, 80);
    const rowCurrency = currency(value.currency);
    const rowTimezone = timezone(value.account_timezone);
    const syncRunId = nonEmptyText(value.sync_run_id);
    const syncedAt = isoTimestamp(value.synced_at);
    const providerBudget = normalizeProviderBudget(value);
    if (
      !campaignId || ids.has(campaignId) || !campaignName || !configuredStatus ||
      !effectiveStatus || (value.objective !== null && !objective) || !rowCurrency ||
      !rowTimezone || !syncRunId || !syncedAt || providerBudget === false
    ) {
      return { ok: false, state: "incompatible", reason: "invalid_campaign_row" };
    }
    ids.add(campaignId);
    campaigns.push({
      campaignId,
      campaignName,
      configuredStatus,
      effectiveStatus,
      objective,
      currency: rowCurrency,
      timezone: rowTimezone,
      syncRunId,
      syncedAt,
      providerBudget,
    });
  }
  return campaigns;
}

function normalizeMetrics(
  values: unknown[],
  organizationId: string,
  accountId: string,
): NormalizedMetric[] | NormalizeResult {
  const metrics: NormalizedMetric[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || !identityMatches(value, organizationId, accountId)) {
      return { ok: false, state: "incompatible", reason: "metric_identity_mismatch" };
    }
    const id = nonEmptyText(value.id);
    const campaignId = nonEmptyText(value.campaign_id, 40);
    const date = isoDate(value.date);
    const spendCents = scaledInteger(value.spend, 2);
    const rowCurrency = currency(value.currency);
    const rowTimezone = timezone(value.account_timezone);
    const rowAttribution = attribution(value.attribution_model, value.attribution_windows);
    const quality = value.data_quality;
    const from = isoDate(value.observation_from);
    const to = isoDate(value.observation_to);
    const syncRunId = nonEmptyText(value.sync_run_id);
    const syncedAt = isoTimestamp(value.synced_at);
    if (
      !id || ids.has(id) || !campaignId || !date || spendCents === null ||
      !rowCurrency || !rowTimezone || !rowAttribution ||
      (quality !== "complete" && quality !== "stale") || !from || !to ||
      from > date || date > to || !syncRunId || !syncedAt ||
      value.metric_provenance !== "provider_reported"
    ) {
      return { ok: false, state: "incompatible", reason: "invalid_metric_row" };
    }
    ids.add(id);
    metrics.push({
      id,
      campaignId,
      date,
      spendCents,
      currency: rowCurrency,
      timezone: rowTimezone,
      attribution: rowAttribution,
      quality,
      from,
      to,
      syncRunId,
      syncedAt,
    });
  }
  return metrics;
}

function normalizeResults(values: unknown[], organizationId: string): NormalizedResult[] | NormalizeResult {
  const results: NormalizedResult[] = [];
  const keys = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || value.organization_id !== organizationId) {
      return { ok: false, state: "incompatible", reason: "result_identity_mismatch" };
    }
    const metricId = nonEmptyText(value.ad_metric_id);
    const resultType = nonEmptyText(value.result_type, 160);
    const valueMicros = scaledInteger(value.result_value, 6);
    const rowAttribution = attribution(value.attribution_model, value.attribution_windows);
    const syncRunId = nonEmptyText(value.sync_run_id);
    const syncedAt = isoTimestamp(value.synced_at);
    if (
      !metricId || !resultType || !/^[A-Za-z0-9_.:-]+$/.test(resultType) ||
      valueMicros === null || value.result_source !== "provider_reported" ||
      !rowAttribution || !syncRunId || !syncedAt
    ) {
      return { ok: false, state: "incompatible", reason: "invalid_result_row" };
    }
    const key = `${metricId}:${resultType}:${rowAttribution.model}:${rowAttribution.windows.join(",")}`;
    if (keys.has(key)) {
      return { ok: false, state: "incompatible", reason: "duplicate_result_row" };
    }
    keys.add(key);
    results.push({ metricId, resultType, valueMicros, attribution: rowAttribution, syncRunId, syncedAt });
  }
  return results;
}

function normalizeActions(values: unknown[], organizationId: string): NormalizedAction[] | NormalizeResult {
  const actions: NormalizedAction[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || value.organization_id !== organizationId) {
      return { ok: false, state: "incompatible", reason: "planned_action_identity_mismatch" };
    }
    const id = nonEmptyText(value.id);
    const kind = nonEmptyText(value.kind, 100);
    const status = nonEmptyText(value.status, 40);
    if (!id || ids.has(id) || !kind || !status || !isRecord(value.payload)) {
      return { ok: false, state: "incompatible", reason: "invalid_planned_action" };
    }
    ids.add(id);
    actions.push({ id, kind, status, payload: value.payload });
  }
  return actions;
}

function normalizeLinks(
  values: unknown[],
  organizationId: string,
  accountId: string,
): NormalizedLink[] | NormalizeResult {
  const links: NormalizedLink[] = [];
  const campaignIds = new Set<string>();
  const actionIds = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || !identityMatches(value, organizationId, accountId)) {
      return { ok: false, state: "incompatible", reason: "budget_link_identity_mismatch" };
    }
    const campaignId = nonEmptyText(value.campaign_id, 40);
    const actionId = nonEmptyText(value.action_id);
    const linkCurrency = currency(value.planned_currency);
    const from = isoDate(value.planned_from);
    const to = isoDate(value.planned_to);
    if (
      !campaignId || !actionId || !linkCurrency || !from || !to || from > to ||
      campaignIds.has(campaignId) || actionIds.has(actionId)
    ) {
      return { ok: false, state: "incompatible", reason: "ambiguous_budget_link" };
    }
    campaignIds.add(campaignId);
    actionIds.add(actionId);
    links.push({ campaignId, actionId, currency: linkCurrency, period: { from, to } });
  }
  return links;
}

function failed<T>(value: T[] | NormalizeResult): value is NormalizeResult {
  return !Array.isArray(value);
}

export function normalizeInput(input: BuildBudgetResultsInput): NormalizeResult {
  const organizationId = nonEmptyText(input.organizationId, 200);
  const accountId = nonEmptyText(input.accountId, 40);
  const asOfIso = isoTimestamp(input.asOf);
  if (!organizationId || !accountId || !/^act_\d{1,32}$/.test(accountId) || !asOfIso) {
    return { ok: false, state: "error", reason: "invalid_request_context" };
  }
  const collections = [
    input.campaigns,
    input.metrics,
    input.results,
    input.syncRuns,
    input.plannedActions,
    input.budgetLinks,
  ];
  if (collections.some((value) => !Array.isArray(value))) {
    return { ok: false, state: "error", reason: "source_read_unavailable" };
  }
  const runs = normalizeRuns(input.syncRuns as unknown[], organizationId, accountId);
  if (failed(runs)) return runs;
  const campaigns = normalizeCampaigns(input.campaigns as unknown[], organizationId, accountId);
  if (failed(campaigns)) return campaigns;
  const metrics = normalizeMetrics(input.metrics as unknown[], organizationId, accountId);
  if (failed(metrics)) return metrics;
  const results = normalizeResults(input.results as unknown[], organizationId);
  if (failed(results)) return results;
  const actions = normalizeActions(input.plannedActions as unknown[], organizationId);
  if (failed(actions)) return actions;
  const links = normalizeLinks(input.budgetLinks as unknown[], organizationId, accountId);
  if (failed(links)) return links;
  return {
    ok: true,
    value: { asOf: new Date(asOfIso), runs, campaigns, metrics, results, actions, links },
  };
}
