import { plannedBudgetFor, plannedVsActualFor } from "./budgets.ts";
import { normalizeInput } from "./normalize.ts";
import { dateInTimezone, sameAttribution, shiftDate } from "./primitives.ts";
import {
  BUDGET_RESULTS_STALE_AFTER_MS,
  BUDGET_RESULTS_WINDOWS,
  type BudgetResultsCampaign,
  type BudgetResultsSnapshot,
  type BudgetResultsState,
  type BuildBudgetResultsInput,
} from "./types.ts";
import { buildWindow, coverageFor } from "./windows.ts";

function emptySnapshot(
  state: BudgetResultsState,
  counts: BudgetResultsSnapshot["provenance"],
): BudgetResultsSnapshot {
  return { state, account: null, windows: [], campaigns: [], provenance: counts };
}

/** Builds a complete presentation model without I/O or mutations. */
export function buildBudgetResults(input: BuildBudgetResultsInput): BudgetResultsSnapshot {
  const counts = {
    campaignRows: Array.isArray(input.campaigns) ? input.campaigns.length : 0,
    metricRows: Array.isArray(input.metrics) ? input.metrics.length : 0,
    resultRows: Array.isArray(input.results) ? input.results.length : 0,
    syncRunRows: Array.isArray(input.syncRuns) ? input.syncRuns.length : 0,
    plannedActionRows: Array.isArray(input.plannedActions) ? input.plannedActions.length : 0,
    budgetLinkRows: Array.isArray(input.budgetLinks) ? input.budgetLinks.length : 0,
  };
  const normalized = normalizeInput(input);
  if (!normalized.ok) {
    return emptySnapshot({
      kind: normalized.state,
      reason: normalized.reason,
      lastCompleteAt: null,
    }, counts);
  }
  const { asOf, runs, campaigns, metrics, results, actions, links } = normalized.value;
  if (runs.length === 0) {
    return emptySnapshot({ kind: "missing", reason: "no_sync_run", lastCompleteAt: null }, counts);
  }
  const orderedRuns = [...runs].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt) || right.id.localeCompare(left.id)
  );
  const latestRun = orderedRuns[0];
  const completeRuns = orderedRuns.filter((run) => run.quality === "complete" && run.applied);
  const latestComplete = completeRuns[0] ?? null;
  if (!latestComplete) {
    const kind = latestRun.quality === "partial" ? "partial" : "error";
    return emptySnapshot({
      kind,
      reason: latestRun.errorCode ?? (kind === "partial" ? "partial_snapshot" : "provider_read_failed"),
      lastCompleteAt: null,
    }, counts);
  }

  const runById = new Map(runs.map((run) => [run.id, run]));
  if (
    latestComplete.currency === null || latestComplete.timezone === null ||
    campaigns.some((row) =>
      row.syncRunId !== latestComplete.id || row.currency !== latestComplete.currency ||
      row.timezone !== latestComplete.timezone ||
      row.providerBudget !== null && row.providerBudget.currency !== row.currency
    ) ||
    campaigns.length !== latestComplete.campaignCount ||
    metrics.some((row) => {
      const run = runById.get(row.syncRunId);
      return !run || run.quality !== "complete" || !run.applied ||
        row.currency !== latestComplete.currency || row.timezone !== latestComplete.timezone ||
        run.from === null || run.to === null || row.date < run.from || row.date > run.to;
    })
  ) {
    return emptySnapshot({
      kind: "incompatible",
      reason: "campaign_metric_scope_mismatch",
      lastCompleteAt: latestComplete.completedAt,
    }, counts);
  }

  const metricById = new Map(metrics.map((metric) => [metric.id, metric]));
  if (
    metrics.filter((row) => row.syncRunId === latestComplete.id).length !== latestComplete.metricCount ||
    results.filter((row) => row.syncRunId === latestComplete.id).length !== latestComplete.resultCount ||
    results.some((row) => {
      const metric = metricById.get(row.metricId);
      return !metric || row.syncRunId !== metric.syncRunId ||
        !sameAttribution(row.attribution, metric.attribution);
    })
  ) {
    return emptySnapshot({
      kind: "incompatible",
      reason: "metric_result_scope_mismatch",
      lastCompleteAt: latestComplete.completedAt,
    }, counts);
  }
  const commonAttribution = metrics[0]?.attribution ?? null;
  if (commonAttribution && metrics.some((row) => !sameAttribution(row.attribution, commonAttribution))) {
    return emptySnapshot({
      kind: "incompatible",
      reason: "mixed_attribution",
      lastCompleteAt: latestComplete.completedAt,
    }, counts);
  }

  const account = {
    accountId: input.accountId,
    currency: latestComplete.currency,
    timezone: latestComplete.timezone,
  };
  const today = dateInTimezone(asOf, account.timezone);
  const freshnessMs = asOf.getTime() - Date.parse(latestComplete.completedAt);
  if (freshnessMs < -60_000) {
    return emptySnapshot({
      kind: "incompatible",
      reason: "future_sync_timestamp",
      lastCompleteAt: latestComplete.completedAt,
    }, counts);
  }
  const freshnessHours = Math.max(0, Math.round((freshnessMs / 3_600_000) * 10) / 10);

  if (latestRun.id !== latestComplete.id) {
    const state = latestRun.quality === "partial" ? "partial" : "error";
    return {
      state: {
        kind: state,
        reason: latestRun.errorCode ?? (state === "partial" ? "partial_snapshot" : "provider_read_failed"),
        lastCompleteAt: latestComplete.completedAt,
      },
      account: {
        provider: "meta_ads",
        ...account,
        attribution: commonAttribution,
        lastCompleteAt: latestComplete.completedAt,
        freshnessHours,
      },
      windows: BUDGET_RESULTS_WINDOWS.map((days) =>
        buildWindow(days, today, metrics, results, completeRuns, account, null)
      ),
      campaigns: [],
      provenance: counts,
    };
  }

  if (latestComplete.campaignCount === 0) {
    return {
      state: { kind: "empty", reason: "empty_account", lastCompleteAt: latestComplete.completedAt },
      account: {
        provider: "meta_ads",
        ...account,
        attribution: commonAttribution,
        lastCompleteAt: latestComplete.completedAt,
        freshnessHours,
      },
      windows: BUDGET_RESULTS_WINDOWS.map((days) =>
        buildWindow(days, today, metrics, results, completeRuns, account, null)
      ),
      campaigns: [],
      provenance: counts,
    };
  }
  if (metrics.length === 0) {
    return {
      state: { kind: "missing", reason: "no_metric_rows", lastCompleteAt: latestComplete.completedAt },
      account: {
        provider: "meta_ads",
        ...account,
        attribution: null,
        lastCompleteAt: latestComplete.completedAt,
        freshnessHours,
      },
      windows: BUDGET_RESULTS_WINDOWS.map((days) =>
        buildWindow(days, today, metrics, results, completeRuns, account, null)
      ),
      campaigns: [],
      provenance: counts,
    };
  }

  const currentThirty = { from: shiftDate(today, -29), to: today };
  const currentThirtyCoverage = coverageFor(currentThirty, completeRuns);
  const stale = freshnessMs > BUDGET_RESULTS_STALE_AFTER_MS ||
    metrics.some((row) => row.quality === "stale");
  const state: BudgetResultsState = stale
    ? { kind: "stale", reason: "last_complete_snapshot_over_48h", lastCompleteAt: latestComplete.completedAt }
    : currentThirtyCoverage !== "complete"
      ? {
          kind: "partial",
          reason: "current_30_day_window_incomplete",
          lastCompleteAt: latestComplete.completedAt,
        }
      : { kind: "ready", reason: "complete_snapshot", lastCompleteAt: latestComplete.completedAt };

  const campaignModels: BudgetResultsCampaign[] = [];
  for (const campaign of [...campaigns].sort((left, right) =>
    left.campaignId.localeCompare(right.campaignId) || left.campaignName.localeCompare(right.campaignName)
  )) {
    const plannedBudget = plannedBudgetFor(campaign, actions, links);
    if (plannedBudget === false) {
      return emptySnapshot({
        kind: "incompatible",
        reason: "invalid_explicit_budget_link",
        lastCompleteAt: latestComplete.completedAt,
      }, counts);
    }
    campaignModels.push({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      configuredStatus: campaign.configuredStatus,
      effectiveStatus: campaign.effectiveStatus,
      objective: campaign.objective,
      plannedBudget,
      providerBudget: campaign.providerBudget
        ? { status: "available", ...campaign.providerBudget, observedAt: campaign.syncedAt }
        : { status: "unavailable", value: null, reason: "not_provided" },
      plannedVsActual: plannedVsActualFor(
        plannedBudget,
        campaign.campaignId,
        metrics,
        results,
        completeRuns,
        account,
      ),
      windows: BUDGET_RESULTS_WINDOWS.map((days) =>
        buildWindow(days, today, metrics, results, completeRuns, account, campaign.campaignId)
      ),
    });
  }

  return {
    state,
    account: {
      provider: "meta_ads",
      ...account,
      attribution: commonAttribution
        ? { ...commonAttribution, windows: [...commonAttribution.windows] }
        : null,
      lastCompleteAt: latestComplete.completedAt,
      freshnessHours,
    },
    windows: BUDGET_RESULTS_WINDOWS.map((days) =>
      buildWindow(days, today, metrics, results, completeRuns, account, null)
    ),
    campaigns: campaignModels,
    provenance: counts,
  };
}
