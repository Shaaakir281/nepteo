import { periodLength, shiftDate } from "./primitives.ts";
import type {
  BudgetResultsAttribution,
  BudgetResultsChange,
  BudgetResultsEvidence,
  BudgetResultsObservation,
  BudgetResultsPeriod,
  BudgetResultsPeriodMetrics,
  BudgetResultsResultSeries,
  BudgetResultsWindow,
  NormalizedMetric,
  NormalizedResult,
  NormalizedRun,
  WindowDays,
} from "./types.ts";

function periodsFor(days: WindowDays, today: string) {
  return {
    current: { from: shiftDate(today, -days + 1), to: today },
    previous: { from: shiftDate(today, -days * 2 + 1), to: shiftDate(today, -days) },
  };
}

export function coverageFor(
  period: BudgetResultsPeriod,
  completeRuns: readonly NormalizedRun[],
): "complete" | "partial" | "missing" {
  let cursor = period.from;
  let coveredDays = 0;
  while (cursor <= period.to) {
    if (completeRuns.some((run) => run.from! <= cursor && run.to! >= cursor)) coveredDays += 1;
    cursor = shiftDate(cursor, 1);
  }
  if (coveredDays === 0) return "missing";
  return coveredDays === periodLength(period) ? "complete" : "partial";
}

function evidenceFor(
  period: BudgetResultsPeriod,
  metrics: readonly NormalizedMetric[],
  results: readonly NormalizedResult[],
  account: { accountId: string; currency: string; timezone: string },
  campaignId: string | null,
): BudgetResultsEvidence {
  const latest = [...metrics.map((row) => row.syncedAt), ...results.map((row) => row.syncedAt)]
    .sort()
    .at(-1) ?? null;
  return {
    provider: "meta_ads",
    accountId: account.accountId,
    campaignId,
    period,
    currency: account.currency,
    timezone: account.timezone,
    attribution: metrics[0]?.attribution ?? null,
    metricRows: metrics.length,
    resultRows: results.length,
    lastSyncedAt: latest,
    provenance: "provider_reported",
    quality: metrics.some((row) => row.quality === "stale") ? "stale" : "complete",
  };
}

function unavailableObservation(
  reason: Extract<BudgetResultsObservation, { status: "unavailable" }>["reason"],
  evidence: BudgetResultsEvidence | null,
): BudgetResultsObservation {
  return { status: "unavailable", value: null, reason, evidence };
}

export function buildPeriodMetrics(
  period: BudgetResultsPeriod,
  allMetrics: readonly NormalizedMetric[],
  allResults: readonly NormalizedResult[],
  completeRuns: readonly NormalizedRun[],
  account: { accountId: string; currency: string; timezone: string },
  campaignId: string | null,
): BudgetResultsPeriodMetrics {
  const coverage = coverageFor(period, completeRuns);
  const metrics = allMetrics.filter((row) =>
    (campaignId === null || row.campaignId === campaignId) &&
    row.date >= period.from && row.date <= period.to
  );
  const metricIds = new Set(metrics.map((row) => row.id));
  const results = allResults.filter((row) => metricIds.has(row.metricId));
  const evidence = evidenceFor(period, metrics, results, account, campaignId);
  const spend = coverage !== "complete"
    ? unavailableObservation("period_not_fully_covered", evidence)
    : metrics.length === 0
      ? unavailableObservation("spend_not_reported", evidence)
      : {
          status: "available" as const,
          value: metrics.reduce((sum, row) => sum + row.spendCents, 0) / 100,
          evidence,
        };

  if (coverage !== "complete") {
    return {
      period,
      coverage,
      spend,
      results: [],
      resultsState: { status: "unavailable", reason: "period_not_fully_covered" },
    };
  }

  const groups = new Map<string, {
    type: string;
    attribution: BudgetResultsAttribution;
    micros: number;
  }>();
  for (const row of results) {
    const key = `${row.resultType}:${row.attribution.model}:${row.attribution.windows.join(",")}`;
    const current = groups.get(key);
    if (current) current.micros += row.valueMicros;
    else groups.set(key, { type: row.resultType, attribution: row.attribution, micros: row.valueMicros });
  }
  const series = [...groups.values()]
    .sort((left, right) => left.type.localeCompare(right.type) ||
      left.attribution.model.localeCompare(right.attribution.model) ||
      left.attribution.windows.join(",").localeCompare(right.attribution.windows.join(",")))
    .map((group): BudgetResultsResultSeries => {
      const value = group.micros / 1_000_000;
      const costPerResult = value === 0
        ? unavailableObservation("zero_result", evidence)
        : spend.status === "available"
          ? {
              status: "available" as const,
              value: Math.round((spend.value / value) * 100) / 100,
              evidence,
            }
          : unavailableObservation(spend.reason, evidence);
      return {
        resultType: group.type,
        value,
        source: "provider_reported",
        attribution: { ...group.attribution, windows: [...group.attribution.windows] },
        costPerResult,
      };
    });
  return {
    period,
    coverage,
    spend,
    results: series,
    resultsState: series.length > 0
      ? { status: "available" }
      : { status: "unavailable", reason: "result_not_reported" },
  };
}

function changeFor(
  current: BudgetResultsObservation,
  previous: BudgetResultsObservation,
): BudgetResultsChange {
  if (current.status === "unavailable") {
    return {
      status: "unavailable",
      current: null,
      previous: previous.status === "available" ? previous.value : null,
      reason: "current_unavailable",
    };
  }
  if (previous.status === "unavailable") {
    return {
      status: "unavailable",
      current: current.value,
      previous: null,
      reason: "previous_unavailable",
    };
  }
  return {
    status: "available",
    current: current.value,
    previous: previous.value,
    absolute: Math.round((current.value - previous.value) * 1_000_000) / 1_000_000,
    relative: previous.value === 0
      ? null
      : Math.round(((current.value - previous.value) / previous.value) * 10_000) / 10_000,
    relativeReason: previous.value === 0 ? "zero_previous" : null,
  };
}

function resultObservation(
  series: BudgetResultsResultSeries | undefined,
  period: BudgetResultsPeriodMetrics,
): BudgetResultsObservation {
  if (series) {
    const evidence = series.costPerResult.evidence ?? period.spend.evidence;
    if (!evidence) return unavailableObservation("result_not_reported", null);
    return { status: "available", value: series.value, evidence };
  }
  return unavailableObservation(
    period.coverage === "complete" ? "result_not_reported" : "period_not_fully_covered",
    period.spend.evidence,
  );
}

export function buildWindow(
  days: WindowDays,
  today: string,
  metrics: readonly NormalizedMetric[],
  results: readonly NormalizedResult[],
  runs: readonly NormalizedRun[],
  account: { accountId: string; currency: string; timezone: string },
  campaignId: string | null,
): BudgetResultsWindow {
  const periods = periodsFor(days, today);
  const current = buildPeriodMetrics(periods.current, metrics, results, runs, account, campaignId);
  const previous = buildPeriodMetrics(periods.previous, metrics, results, runs, account, campaignId);
  const currentSeries = new Map(current.results.map((item) => [
    `${item.resultType}:${item.attribution.model}:${item.attribution.windows.join(",")}`,
    item,
  ]));
  const previousSeries = new Map(previous.results.map((item) => [
    `${item.resultType}:${item.attribution.model}:${item.attribution.windows.join(",")}`,
    item,
  ]));
  const keys = [...new Set([...currentSeries.keys(), ...previousSeries.keys()])].sort();
  return {
    days,
    current,
    previous,
    trend: {
      spend: changeFor(current.spend, previous.spend),
      results: keys.map((key) => {
        const currentResult = currentSeries.get(key);
        const previousResult = previousSeries.get(key);
        const reference = currentResult ?? previousResult!;
        return {
          resultType: reference.resultType,
          source: "provider_reported" as const,
          attribution: { ...reference.attribution, windows: [...reference.attribution.windows] },
          value: changeFor(
            resultObservation(currentResult, current),
            resultObservation(previousResult, previous),
          ),
          costPerResult: changeFor(
            currentResult?.costPerResult ?? unavailableObservation(
              current.coverage === "complete" ? "result_not_reported" : "period_not_fully_covered",
              current.spend.evidence,
            ),
            previousResult?.costPerResult ?? unavailableObservation(
              previous.coverage === "complete" ? "result_not_reported" : "period_not_fully_covered",
              previous.spend.evidence,
            ),
          ),
        };
      }),
    },
  };
}
