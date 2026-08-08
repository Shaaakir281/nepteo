/**
 * CAMP-2 — analytical questions and weekly report derived from one cockpit snapshot.
 *
 * This module is deliberately pure: it performs no read, write, generation or
 * provider operation. Callers must first build a CampaignCockpit from inspected
 * data, with a seven-day current window and the adjacent seven-day comparison.
 */
import type {
  CampaignCockpit,
  CampaignCockpitRange,
  CampaignPeriodComparison,
  ObservedCampaignMetrics,
  ObservedMetricsSource,
} from "./campaign-cockpit";

export const CAMPAIGN_ANALYTIC_QUESTIONS = [
  {
    id: "weekly_observed_totals",
    label: "Quels résultats ont été observés sur les 7 derniers jours ?",
  },
  {
    id: "weekly_observed_changes",
    label: "Comment les résultats ont-ils évolué face aux 7 jours précédents ?",
  },
  {
    id: "weekly_delivery_changes",
    label: "Comment le CPM et le CTR observés ont-ils évolué ?",
  },
  {
    id: "weekly_campaign_coverage",
    label: "Quelles campagnes disposent des deux périodes de mesure ?",
  },
] as const;

export type CampaignAnalyticQuestionId = (typeof CAMPAIGN_ANALYTIC_QUESTIONS)[number]["id"];

export interface CampaignWeeklyPeriod {
  current: CampaignCockpitRange;
  previous: CampaignCockpitRange | null;
}

export interface CampaignWeeklySource {
  kind: "ad_metrics";
  provider: ObservedMetricsSource["provider"] | null;
  currentRowCount: number | null;
  previousRowCount: number | null;
  currentLastSyncedAt: string | null;
  filters: {
    channels: "all" | CampaignCockpit["campaigns"][number]["channel"][];
    statuses: "all" | CampaignCockpit["campaigns"][number]["status"]["value"][];
  };
}

export type CampaignWeeklyUnavailableReason =
  | "invalid_period"
  | "current_period_not_seven_days"
  | "comparison_not_configured"
  | "previous_period_not_seven_days"
  | "periods_not_adjacent"
  | "no_current_rows"
  | "no_previous_rows"
  | "source_inconsistent";

export type CampaignWeeklyCampaignRow =
  | {
      status: "available";
      key: string;
      campaignId: string;
      campaignName: string;
      provider: CampaignCockpit["campaigns"][number]["provider"];
      channel: CampaignCockpit["campaigns"][number]["channel"];
      current: ObservedCampaignMetrics;
      previous: ObservedCampaignMetrics;
      changes: CampaignPeriodComparison["changes"];
      source: CampaignPeriodComparison["source"];
    }
  | {
      status: "unavailable";
      key: string;
      campaignId: string;
      campaignName: string;
      provider: CampaignCockpit["campaigns"][number]["provider"];
      channel: CampaignCockpit["campaigns"][number]["channel"];
      reason: "comparison_not_configured" | "no_current_rows" | "no_previous_rows" | "source_inconsistent";
    };

export type CampaignWeeklyReport =
  | {
      kind: "campaign_weekly_report";
      status: "available";
      period: { current: CampaignCockpitRange; previous: CampaignCockpitRange };
      source: CampaignWeeklySource & {
        provider: ObservedMetricsSource["provider"];
        currentRowCount: number;
        previousRowCount: number;
      };
      totals: {
        current: ObservedCampaignMetrics;
        previous: ObservedCampaignMetrics;
        changes: CampaignPeriodComparison["changes"];
      };
      campaigns: CampaignWeeklyCampaignRow[];
      evidence: "observed_values_only";
    }
  | {
      kind: "campaign_weekly_report";
      status: "unavailable";
      reason: CampaignWeeklyUnavailableReason;
      period: CampaignWeeklyPeriod;
      source: CampaignWeeklySource;
    };

type AvailableWeeklyReport = Extract<CampaignWeeklyReport, { status: "available" }>;

type CampaignAnalyticUnavailableReason = CampaignWeeklyUnavailableReason | "delivery_metrics_unavailable";

export type CampaignAnalyticAnswer =
  | {
      questionId: "weekly_observed_totals";
      status: "available";
      period: AvailableWeeklyReport["period"];
      source: AvailableWeeklyReport["source"];
      facts: { current: ObservedCampaignMetrics };
      evidence: "observed_values_only";
    }
  | {
      questionId: "weekly_observed_changes";
      status: "available";
      period: AvailableWeeklyReport["period"];
      source: AvailableWeeklyReport["source"];
      facts: AvailableWeeklyReport["totals"];
      evidence: "observed_values_only";
    }
  | {
      questionId: "weekly_delivery_changes";
      status: "available";
      period: AvailableWeeklyReport["period"];
      source: AvailableWeeklyReport["source"];
      facts: {
        current: { cpm: number; ctr: number };
        previous: { cpm: number; ctr: number };
        changes: { cpm: number; ctr: number };
        directions: {
          cpm: "higher" | "lower" | "unchanged";
          ctr: "higher" | "lower" | "unchanged";
        };
      };
      evidence: "observed_values_only";
    }
  | {
      questionId: "weekly_campaign_coverage";
      status: "available";
      period: AvailableWeeklyReport["period"];
      source: AvailableWeeklyReport["source"];
      facts: {
        comparable: Array<{ key: string; campaignName: string }>;
        unavailable: Array<{
          key: string;
          campaignName: string;
          reason: Extract<CampaignWeeklyCampaignRow, { status: "unavailable" }>["reason"];
        }>;
      };
      evidence: "observed_values_only";
    }
  | {
      questionId: CampaignAnalyticQuestionId;
      status: "unavailable";
      reason: CampaignAnalyticUnavailableReason;
      period: CampaignWeeklyPeriod;
      source: CampaignWeeklySource;
    };

export type AnswerCampaignAnalyticQuestionResult =
  | { ok: true; answer: CampaignAnalyticAnswer }
  | { ok: false; error: "unsupported_question" };

const DAY_MS = 86_400_000;

function dateValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const normalized = new Date(timestamp).toISOString().slice(0, 10);
  return normalized === value ? timestamp : null;
}

function rangeLength(range: CampaignCockpitRange): number | null {
  const from = dateValue(range.from);
  const to = dateValue(range.to);
  if (from === null || to === null || to < from) return null;
  return (to - from) / DAY_MS + 1;
}

function rangesEqual(left: CampaignCockpitRange, right: CampaignCockpitRange): boolean {
  return left.from === right.from && left.to === right.to;
}

function periodsAreAdjacent(previous: CampaignCockpitRange, current: CampaignCockpitRange): boolean {
  const previousTo = dateValue(previous.to);
  const currentFrom = dateValue(current.from);
  return previousTo !== null && currentFrom !== null && previousTo + DAY_MS === currentFrom;
}

function cloneDeliveryMetric(metric: ObservedCampaignMetrics["cpm"]): ObservedCampaignMetrics["cpm"] {
  return metric.status === "available"
    ? { status: "available", value: metric.value }
    : { status: "unavailable", value: null, reason: metric.reason };
}

function cloneMetrics(metrics: ObservedCampaignMetrics): ObservedCampaignMetrics {
  return {
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    spend: metrics.spend,
    conversions: metrics.conversions,
    revenue: metrics.revenue,
    cac: metrics.cac,
    roas: metrics.roas,
    cpm: cloneDeliveryMetric(metrics.cpm),
    ctr: cloneDeliveryMetric(metrics.ctr),
  };
}

function relativeChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 10_000;
}

function deliveryChange(
  current: ObservedCampaignMetrics["cpm"],
  previous: ObservedCampaignMetrics["cpm"],
): CampaignPeriodComparison["changes"]["cpm"] {
  if (current.status === "unavailable") {
    return { status: "unavailable", value: null, reason: "current_metric_unavailable" };
  }
  if (previous.status === "unavailable") {
    return { status: "unavailable", value: null, reason: "previous_metric_unavailable" };
  }
  if (previous.value === 0) {
    return { status: "unavailable", value: null, reason: "zero_previous_value" };
  }
  return {
    status: "available",
    value: Math.round(((current.value - previous.value) / previous.value) * 10_000) / 10_000,
  };
}

function changesFor(
  current: ObservedCampaignMetrics,
  previous: ObservedCampaignMetrics,
): CampaignPeriodComparison["changes"] {
  return {
    spend: relativeChange(current.spend, previous.spend),
    conversions: relativeChange(current.conversions, previous.conversions),
    revenue: relativeChange(current.revenue, previous.revenue),
    cac: relativeChange(current.cac, previous.cac),
    roas: relativeChange(current.roas, previous.roas),
    cpm: deliveryChange(current.cpm, previous.cpm),
    ctr: deliveryChange(current.ctr, previous.ctr),
  };
}

function deliveryChangesEqual(
  left: CampaignPeriodComparison["changes"]["cpm"],
  right: CampaignPeriodComparison["changes"]["cpm"],
): boolean {
  return left.status === right.status && left.value === right.value &&
    (left.status === "available" ||
      right.status === "unavailable" && left.reason === right.reason);
}

function changesEqual(
  left: CampaignPeriodComparison["changes"],
  right: CampaignPeriodComparison["changes"],
): boolean {
  return left.spend === right.spend && left.conversions === right.conversions &&
    left.revenue === right.revenue && left.cac === right.cac && left.roas === right.roas &&
    deliveryChangesEqual(left.cpm, right.cpm) && deliveryChangesEqual(left.ctr, right.ctr);
}

function metricsFromParts(parts: readonly ObservedCampaignMetrics[]): ObservedCampaignMetrics | null {
  if (parts.length === 0) return null;
  const impressions = parts.reduce((total, metrics) => total + metrics.impressions, 0);
  const clicks = parts.reduce((total, metrics) => total + metrics.clicks, 0);
  const spend = Math.round(parts.reduce((total, metrics) => total + metrics.spend, 0) * 100) / 100;
  const conversions = parts.reduce((total, metrics) => total + metrics.conversions, 0);
  const revenue = Math.round(parts.reduce((total, metrics) => total + metrics.revenue, 0) * 100) / 100;
  return {
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
    cac: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : null,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
    cpm: impressions > 0
      ? { status: "available", value: Math.round((spend / impressions) * 100_000) / 100 }
      : { status: "unavailable", value: null, reason: "zero_impressions" },
    ctr: impressions > 0
      ? { status: "available", value: Math.round((clicks / impressions) * 1_000_000) / 1_000_000 }
      : { status: "unavailable", value: null, reason: "zero_impressions" },
  };
}

function metricsEqual(left: ObservedCampaignMetrics, right: ObservedCampaignMetrics): boolean {
  return left.impressions === right.impressions && left.clicks === right.clicks &&
    left.spend === right.spend && left.conversions === right.conversions &&
    left.revenue === right.revenue && left.cac === right.cac && left.roas === right.roas &&
    left.cpm.status === right.cpm.status && left.cpm.value === right.cpm.value &&
    left.ctr.status === right.ctr.status && left.ctr.value === right.ctr.value;
}

function scopeFor(cockpit: CampaignCockpit): {
  period: CampaignWeeklyPeriod;
  source: CampaignWeeklySource;
} {
  const previous = cockpit.comparisonPeriod.kind === "period"
    ? { from: cockpit.comparisonPeriod.from, to: cockpit.comparisonPeriod.to }
    : null;
  const currentRowCount = cockpit.totals.status === "available"
    ? cockpit.totals.source.rowCount
    : 0;
  const previousRowCount = cockpit.comparison.status === "available"
    ? cockpit.comparison.source.previousRowCount
    : cockpit.comparison.reason === "no_previous_rows"
      ? 0
      : null;
  return {
    period: {
      current: { ...cockpit.window },
      previous,
    },
    source: {
      kind: "ad_metrics",
      provider: cockpit.totals.status === "available" ? cockpit.totals.source.provider : null,
      currentRowCount,
      previousRowCount,
      currentLastSyncedAt: cockpit.totals.status === "available"
        ? cockpit.totals.source.lastSyncedAt
        : null,
      filters: {
        channels: cockpit.filters.channels === "all" ? "all" : [...cockpit.filters.channels],
        statuses: cockpit.filters.statuses === "all" ? "all" : [...cockpit.filters.statuses],
      },
    },
  };
}

function unavailableReport(
  cockpit: CampaignCockpit,
  reason: CampaignWeeklyUnavailableReason,
): CampaignWeeklyReport {
  return {
    kind: "campaign_weekly_report",
    status: "unavailable",
    reason,
    ...scopeFor(cockpit),
  };
}

function comparisonUnavailableReason(
  reason: "disabled" | "no_current_rows" | "no_previous_rows",
): CampaignWeeklyUnavailableReason {
  if (reason === "disabled") return "comparison_not_configured";
  return reason;
}

function campaignRow(
  campaign: CampaignCockpit["campaigns"][number],
  period: AvailableWeeklyReport["period"],
): CampaignWeeklyCampaignRow {
  const base = {
    key: campaign.key,
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    provider: campaign.provider,
    channel: campaign.channel,
  };
  if (campaign.comparison.status === "unavailable") {
    return {
      status: "unavailable",
      ...base,
      reason: campaign.comparison.reason === "disabled"
        ? "comparison_not_configured"
        : campaign.comparison.reason,
    };
  }
  const source = campaign.comparison.source;
  if (!rangesEqual(campaign.comparison.period, period.previous) ||
      !rangesEqual(source.currentPeriod, period.current) ||
      !rangesEqual(source.previousPeriod, period.previous) ||
      source.currentRowCount < 1 || source.previousRowCount < 1 ||
      campaign.performance?.scope !== "selected_window" ||
      !metricsEqual(campaign.performance.metrics, campaign.comparison.current) ||
      campaign.performance.source.from !== period.current.from ||
      campaign.performance.source.to !== period.current.to ||
      campaign.performance.source.provider !== campaign.provider ||
      campaign.performance.source.rowCount !== source.currentRowCount ||
      !changesEqual(
        campaign.comparison.changes,
        changesFor(campaign.comparison.current, campaign.comparison.previous),
      )) {
    return { status: "unavailable", ...base, reason: "source_inconsistent" };
  }
  return {
    status: "available",
    ...base,
    current: cloneMetrics(campaign.comparison.current),
    previous: cloneMetrics(campaign.comparison.previous),
    changes: changesFor(campaign.comparison.current, campaign.comparison.previous),
    source: {
      kind: "ad_metrics",
      currentPeriod: { ...source.currentPeriod },
      previousPeriod: { ...source.previousPeriod },
      currentRowCount: source.currentRowCount,
      previousRowCount: source.previousRowCount,
    },
  };
}

/**
 * Builds an in-memory weekly report from an already-built cockpit. The method
 * refuses any period other than 7 days followed by the adjacent previous 7 days.
 */
export function buildCampaignWeeklyReport(cockpit: CampaignCockpit): CampaignWeeklyReport {
  const currentLength = rangeLength(cockpit.window);
  if (currentLength === null) return unavailableReport(cockpit, "invalid_period");
  if (currentLength !== 7) return unavailableReport(cockpit, "current_period_not_seven_days");
  if (cockpit.comparisonPeriod.kind !== "period") {
    return unavailableReport(cockpit, "comparison_not_configured");
  }

  const previous = {
    from: cockpit.comparisonPeriod.from,
    to: cockpit.comparisonPeriod.to,
  };
  const previousLength = rangeLength(previous);
  if (previousLength === null) return unavailableReport(cockpit, "invalid_period");
  if (previousLength !== 7) return unavailableReport(cockpit, "previous_period_not_seven_days");
  if (!periodsAreAdjacent(previous, cockpit.window)) {
    return unavailableReport(cockpit, "periods_not_adjacent");
  }
  if (cockpit.totals.status === "unavailable") {
    return unavailableReport(cockpit, "no_current_rows");
  }
  if (cockpit.comparison.status === "unavailable") {
    return unavailableReport(cockpit, comparisonUnavailableReason(cockpit.comparison.reason));
  }

  const comparison = cockpit.comparison;
  const source = comparison.source;
  const expectedChanges = changesFor(comparison.current, comparison.previous);
  const currentCampaignParts = cockpit.campaigns
    .filter((campaign) => campaign.performance?.scope === "selected_window")
    .map((campaign) => campaign.performance!.metrics);
  const currentCampaignMetrics = metricsFromParts(currentCampaignParts);
  const currentCampaignRowCount = cockpit.campaigns.reduce(
    (total, campaign) => campaign.performance?.scope === "selected_window"
      ? total + campaign.performance.source.rowCount
      : total,
    0,
  );
  const currentCampaignProviders = new Set(
    cockpit.campaigns
      .filter((campaign) => campaign.performance?.scope === "selected_window")
      .map((campaign) => campaign.provider),
  );
  const expectedCurrentProvider: ObservedMetricsSource["provider"] =
    currentCampaignProviders.size === 1
      ? [...currentCampaignProviders][0]
      : "multiple";
  const currentCampaignLastSyncedAt = cockpit.campaigns
    .filter((campaign) => campaign.performance?.scope === "selected_window")
    .map((campaign) => campaign.performance!.source.lastSyncedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const previousCampaignComparisons = cockpit.campaigns.filter(
    (campaign): campaign is typeof campaign & {
      comparison: CampaignPeriodComparison;
    } => campaign.comparison.status === "available",
  );
  const previousCampaignMetrics = metricsFromParts(
    previousCampaignComparisons.map((campaign) => campaign.comparison.previous),
  );
  const previousCampaignRowCount = previousCampaignComparisons.reduce(
    (total, campaign) => total + campaign.comparison.source.previousRowCount,
    0,
  );
  if (!rangesEqual(comparison.period, previous) ||
      !rangesEqual(source.currentPeriod, cockpit.window) ||
      !rangesEqual(source.previousPeriod, previous) ||
      source.currentRowCount < 1 || source.previousRowCount < 1 ||
      cockpit.totals.source.from !== cockpit.window.from ||
      cockpit.totals.source.to !== cockpit.window.to ||
      cockpit.totals.source.provider !== expectedCurrentProvider ||
      cockpit.totals.source.lastSyncedAt !== currentCampaignLastSyncedAt ||
      cockpit.totals.source.rowCount !== source.currentRowCount ||
      !metricsEqual(cockpit.totals.metrics, comparison.current) ||
      currentCampaignMetrics === null ||
      !metricsEqual(currentCampaignMetrics, cockpit.totals.metrics) ||
      currentCampaignRowCount !== source.currentRowCount ||
      previousCampaignMetrics === null ||
      !metricsEqual(previousCampaignMetrics, comparison.previous) ||
      previousCampaignRowCount !== source.previousRowCount ||
      !changesEqual(comparison.changes, expectedChanges)) {
    return unavailableReport(cockpit, "source_inconsistent");
  }

  const period = {
    current: { ...cockpit.window },
    previous: { ...previous },
  };
  const campaigns = cockpit.campaigns
    .map((campaign) => campaignRow(campaign, period))
    .sort((left, right) => left.key.localeCompare(right.key));
  if (campaigns.some(
    (campaign) => campaign.status === "unavailable" && campaign.reason === "source_inconsistent",
  )) {
    return unavailableReport(cockpit, "source_inconsistent");
  }
  return {
    kind: "campaign_weekly_report",
    status: "available",
    period,
    source: {
      kind: "ad_metrics",
      provider: cockpit.totals.source.provider,
      currentRowCount: source.currentRowCount,
      previousRowCount: source.previousRowCount,
      currentLastSyncedAt: cockpit.totals.source.lastSyncedAt,
      filters: {
        channels: cockpit.filters.channels === "all" ? "all" : [...cockpit.filters.channels],
        statuses: cockpit.filters.statuses === "all" ? "all" : [...cockpit.filters.statuses],
      },
    },
    totals: {
      current: cloneMetrics(comparison.current),
      previous: cloneMetrics(comparison.previous),
      changes: expectedChanges,
    },
    campaigns,
    evidence: "observed_values_only",
  };
}

function isQuestionId(value: unknown): value is CampaignAnalyticQuestionId {
  return typeof value === "string" && CAMPAIGN_ANALYTIC_QUESTIONS.some((question) => question.id === value);
}

function direction(current: number, previous: number): "higher" | "lower" | "unchanged" {
  if (current === previous) return "unchanged";
  return current > previous ? "higher" : "lower";
}

/** Answers one fixed dock question; arbitrary prompts are rejected. */
export function answerCampaignAnalyticQuestion(
  cockpit: CampaignCockpit,
  questionId: unknown,
): AnswerCampaignAnalyticQuestionResult {
  if (!isQuestionId(questionId)) return { ok: false, error: "unsupported_question" };
  const report = buildCampaignWeeklyReport(cockpit);
  if (report.status === "unavailable") {
    return {
      ok: true,
      answer: {
        questionId,
        status: "unavailable",
        reason: report.reason,
        period: report.period,
        source: report.source,
      },
    };
  }

  const common = {
    period: report.period,
    source: report.source,
    evidence: "observed_values_only" as const,
  };
  if (questionId === "weekly_observed_totals") {
    return {
      ok: true,
      answer: { questionId, status: "available", ...common, facts: { current: report.totals.current } },
    };
  }
  if (questionId === "weekly_observed_changes") {
    return {
      ok: true,
      answer: { questionId, status: "available", ...common, facts: report.totals },
    };
  }
  if (questionId === "weekly_delivery_changes") {
    const { current, previous, changes } = report.totals;
    if (current.cpm.status === "unavailable" || current.ctr.status === "unavailable" ||
        previous.cpm.status === "unavailable" || previous.ctr.status === "unavailable" ||
        changes.cpm.status === "unavailable" || changes.ctr.status === "unavailable") {
      return {
        ok: true,
        answer: {
          questionId,
          status: "unavailable",
          reason: "delivery_metrics_unavailable",
          period: report.period,
          source: report.source,
        },
      };
    }
    return {
      ok: true,
      answer: {
        questionId,
        status: "available",
        ...common,
        facts: {
          current: { cpm: current.cpm.value, ctr: current.ctr.value },
          previous: { cpm: previous.cpm.value, ctr: previous.ctr.value },
          changes: { cpm: changes.cpm.value, ctr: changes.ctr.value },
          directions: {
            cpm: direction(current.cpm.value, previous.cpm.value),
            ctr: direction(current.ctr.value, previous.ctr.value),
          },
        },
      },
    };
  }

  const comparable: Array<{ key: string; campaignName: string }> = [];
  const unavailable: Array<{
    key: string;
    campaignName: string;
    reason: Extract<CampaignWeeklyCampaignRow, { status: "unavailable" }>["reason"];
  }> = [];
  for (const campaign of report.campaigns) {
    if (campaign.status === "available") {
      comparable.push({ key: campaign.key, campaignName: campaign.campaignName });
    } else {
      unavailable.push({
        key: campaign.key,
        campaignName: campaign.campaignName,
        reason: campaign.reason,
      });
    }
  }
  return {
    ok: true,
    answer: {
      questionId,
      status: "available",
      ...common,
      facts: { comparable, unavailable },
    },
  };
}
