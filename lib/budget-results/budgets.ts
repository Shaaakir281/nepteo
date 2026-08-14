import { isRecord, nonNegativeInteger, periodLength, scaledInteger } from "./primitives.ts";
import type {
  NormalizedAction,
  NormalizedCampaign,
  NormalizedLink,
  NormalizedMetric,
  NormalizedResult,
  NormalizedRun,
  PlannedBudget,
  PlannedVsActual,
} from "./types.ts";
import { buildPeriodMetrics } from "./windows.ts";

export function plannedBudgetFor(
  campaign: NormalizedCampaign,
  actions: readonly NormalizedAction[],
  links: readonly NormalizedLink[],
): PlannedBudget | false {
  const link = links.find((candidate) => candidate.campaignId === campaign.campaignId);
  if (!link) {
    return { status: "unlinked", value: null, label: "Budget prévu non rapproché" };
  }
  const action = actions.find((candidate) => candidate.id === link.actionId);
  const brief = action && isRecord(action.payload.brief) ? action.payload.brief : null;
  const plan = action && isRecord(action.payload.plan) ? action.payload.plan : null;
  const dailyCents = brief ? scaledInteger(brief.dailyBudget, 2) : null;
  const duration = brief ? nonNegativeInteger(brief.durationDays) : null;
  const totalCents = plan ? scaledInteger(plan.totalBudget, 2) : null;
  const planDailyCents = plan ? scaledInteger(plan.dailyCap, 2) : null;
  const planDuration = plan ? nonNegativeInteger(plan.durationDays) : null;
  if (
    !action || action.kind !== "launch_campaign" || action.status !== "approved" ||
    !brief || brief.channel !== "meta" || !plan || dailyCents === null || dailyCents <= 0 ||
    duration === null || duration <= 0 || totalCents === null || totalCents <= 0 ||
    planDailyCents !== dailyCents || planDuration !== duration ||
    totalCents !== dailyCents * duration || periodLength(link.period) !== duration ||
    link.currency !== campaign.currency
  ) return false;
  return {
    status: "available",
    amount: totalCents / 100,
    currency: link.currency,
    period: { ...link.period },
    actionId: action.id,
    source: "planned_action_explicit_link",
  };
}

export function plannedVsActualFor(
  planned: PlannedBudget,
  campaignId: string,
  metrics: readonly NormalizedMetric[],
  results: readonly NormalizedResult[],
  runs: readonly NormalizedRun[],
  account: { accountId: string; currency: string; timezone: string },
): PlannedVsActual {
  if (planned.status === "unlinked") {
    return { status: "unavailable", value: null, reason: "planned_budget_unlinked" };
  }
  const observed = buildPeriodMetrics(
    planned.period,
    metrics,
    results,
    runs,
    account,
    campaignId,
  );
  if (observed.spend.status === "unavailable") {
    return {
      status: "unavailable",
      value: null,
      reason: observed.spend.reason === "period_not_fully_covered"
        ? "period_not_fully_covered"
        : "spend_not_reported",
    };
  }
  return {
    status: "available",
    planned: planned.amount,
    actual: observed.spend.value,
    remaining: Math.round((planned.amount - observed.spend.value) * 100) / 100,
    spentRatio: Math.round((observed.spend.value / planned.amount) * 10_000) / 10_000,
    currency: planned.currency,
    period: { ...planned.period },
    evidence: observed.spend.evidence,
  };
}
