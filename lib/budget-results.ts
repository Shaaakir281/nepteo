/**
 * Public BUDGET-RESULTS contract. Implementation stays split into small, pure modules.
 */

export { buildBudgetResults } from "./budget-results/build.ts";
export {
  BUDGET_RESULTS_STALE_AFTER_MS,
  BUDGET_RESULTS_WINDOWS,
} from "./budget-results/types.ts";
export type {
  BudgetResultsAccount,
  BudgetResultsAttribution,
  BudgetResultsCampaign,
  BudgetResultsChange,
  BudgetResultsEvidence,
  BudgetResultsObservation,
  BudgetResultsPeriod,
  BudgetResultsPeriodMetrics,
  BudgetResultsResultSeries,
  BudgetResultsResultTrend,
  BudgetResultsSnapshot,
  BudgetResultsState,
  BudgetResultsStateKind,
  BudgetResultsWindow,
  BuildBudgetResultsInput,
  PlannedBudget,
  PlannedVsActual,
  ProviderBudget,
} from "./budget-results/types.ts";
