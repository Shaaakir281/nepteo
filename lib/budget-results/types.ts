export const BUDGET_RESULTS_WINDOWS = [7, 30] as const;
export const BUDGET_RESULTS_STALE_AFTER_MS = 48 * 60 * 60 * 1_000;

export type WindowDays = (typeof BUDGET_RESULTS_WINDOWS)[number];
export type Quality = "complete" | "stale";

export interface BuildBudgetResultsInput {
  organizationId: string;
  accountId: string;
  asOf: unknown;
  campaigns: unknown;
  metrics: unknown;
  results: unknown;
  syncRuns: unknown;
  plannedActions: unknown;
  budgetLinks: unknown;
}

export type BudgetResultsStateKind =
  | "ready"
  | "empty"
  | "missing"
  | "stale"
  | "partial"
  | "incompatible"
  | "error";

export interface BudgetResultsState {
  kind: BudgetResultsStateKind;
  reason: string;
  lastCompleteAt: string | null;
}

export interface BudgetResultsPeriod {
  from: string;
  to: string;
}

export interface BudgetResultsAttribution {
  model: string;
  windows: string[];
}

export interface BudgetResultsEvidence {
  provider: "meta_ads";
  accountId: string;
  campaignId: string | null;
  period: BudgetResultsPeriod;
  currency: string;
  timezone: string;
  attribution: BudgetResultsAttribution | null;
  metricRows: number;
  resultRows: number;
  lastSyncedAt: string | null;
  provenance: "provider_reported";
  quality: Quality;
}

export type BudgetResultsObservation =
  | { status: "available"; value: number; evidence: BudgetResultsEvidence }
  | {
      status: "unavailable";
      value: null;
      reason:
        | "period_not_fully_covered"
        | "spend_not_reported"
        | "result_not_reported"
        | "zero_result";
      evidence: BudgetResultsEvidence | null;
    };

export type BudgetResultsChange =
  | {
      status: "available";
      current: number;
      previous: number;
      absolute: number;
      relative: number | null;
      relativeReason: "zero_previous" | null;
    }
  | {
      status: "unavailable";
      current: number | null;
      previous: number | null;
      reason: "current_unavailable" | "previous_unavailable";
    };

export interface BudgetResultsResultSeries {
  resultType: string;
  value: number;
  source: "provider_reported";
  attribution: BudgetResultsAttribution;
  costPerResult: BudgetResultsObservation;
}

export interface BudgetResultsPeriodMetrics {
  period: BudgetResultsPeriod;
  coverage: "complete" | "partial" | "missing";
  spend: BudgetResultsObservation;
  results: BudgetResultsResultSeries[];
  resultsState:
    | { status: "available" }
    | {
        status: "unavailable";
        reason: "period_not_fully_covered" | "result_not_reported";
      };
}

export interface BudgetResultsResultTrend {
  resultType: string;
  source: "provider_reported";
  attribution: BudgetResultsAttribution;
  value: BudgetResultsChange;
  costPerResult: BudgetResultsChange;
}

export interface BudgetResultsWindow {
  days: WindowDays;
  current: BudgetResultsPeriodMetrics;
  previous: BudgetResultsPeriodMetrics;
  trend: {
    spend: BudgetResultsChange;
    results: BudgetResultsResultTrend[];
  };
}

export type PlannedBudget =
  | {
      status: "available";
      amount: number;
      currency: string;
      period: BudgetResultsPeriod;
      actionId: string;
      source: "planned_action_explicit_link";
    }
  | {
      status: "unlinked";
      value: null;
      label: "Budget prévu non rapproché";
    };

export type ProviderBudget =
  | {
      status: "available";
      amount: number;
      kind: "daily" | "lifetime";
      currency: string;
      source: "provider_reported";
      observedAt: string;
    }
  | { status: "unavailable"; value: null; reason: "not_provided" };

export type PlannedVsActual =
  | {
      status: "available";
      planned: number;
      actual: number;
      remaining: number;
      spentRatio: number;
      currency: string;
      period: BudgetResultsPeriod;
      evidence: BudgetResultsEvidence;
    }
  | {
      status: "unavailable";
      value: null;
      reason:
        | "planned_budget_unlinked"
        | "period_not_fully_covered"
        | "spend_not_reported";
    };

export interface BudgetResultsCampaign {
  campaignId: string;
  campaignName: string;
  configuredStatus: string;
  effectiveStatus: string;
  objective: string | null;
  plannedBudget: PlannedBudget;
  providerBudget: ProviderBudget;
  plannedVsActual: PlannedVsActual;
  windows: BudgetResultsWindow[];
}

export interface BudgetResultsAccount {
  provider: "meta_ads";
  accountId: string;
  currency: string;
  timezone: string;
  attribution: BudgetResultsAttribution | null;
  lastCompleteAt: string;
  freshnessHours: number;
}

export interface BudgetResultsSnapshot {
  state: BudgetResultsState;
  account: BudgetResultsAccount | null;
  windows: BudgetResultsWindow[];
  campaigns: BudgetResultsCampaign[];
  provenance: {
    campaignRows: number;
    metricRows: number;
    resultRows: number;
    syncRunRows: number;
    plannedActionRows: number;
    budgetLinkRows: number;
  };
}

export interface NormalizedRun {
  id: string;
  quality: "complete" | "partial" | "unavailable";
  applied: boolean;
  errorCode: string | null;
  from: string | null;
  to: string | null;
  currency: string | null;
  timezone: string | null;
  campaignCount: number;
  metricCount: number;
  resultCount: number;
  completedAt: string;
}

export interface NormalizedProviderBudget {
  amount: number;
  kind: "daily" | "lifetime";
  currency: string;
  source: "provider_reported";
}

export interface NormalizedCampaign {
  campaignId: string;
  campaignName: string;
  configuredStatus: string;
  effectiveStatus: string;
  objective: string | null;
  currency: string;
  timezone: string;
  syncRunId: string;
  syncedAt: string;
  providerBudget: NormalizedProviderBudget | null;
}

export interface NormalizedMetric {
  id: string;
  campaignId: string;
  date: string;
  spendCents: number;
  currency: string;
  timezone: string;
  attribution: BudgetResultsAttribution;
  quality: Quality;
  from: string;
  to: string;
  syncRunId: string;
  syncedAt: string;
}

export interface NormalizedResult {
  metricId: string;
  resultType: string;
  valueMicros: number;
  attribution: BudgetResultsAttribution;
  syncRunId: string;
  syncedAt: string;
}

export interface NormalizedAction {
  id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown>;
}

export interface NormalizedLink {
  campaignId: string;
  actionId: string;
  currency: string;
  period: BudgetResultsPeriod;
}

export interface NormalizedInput {
  asOf: Date;
  runs: NormalizedRun[];
  campaigns: NormalizedCampaign[];
  metrics: NormalizedMetric[];
  results: NormalizedResult[];
  actions: NormalizedAction[];
  links: NormalizedLink[];
}

export type NormalizeResult =
  | { ok: true; value: NormalizedInput }
  | { ok: false; state: "error" | "incompatible"; reason: string };
