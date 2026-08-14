import {
  buildBudgetResults,
  type BudgetResultsSnapshot,
} from "@/lib/budget-results";
import type { BudgetResultsData } from "./budget-results-query";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function accountIdFrom(value: unknown): string | null {
  if (!isRecord(value) || typeof value.account_id !== "string") return null;
  return /^act_\d{1,32}$/.test(value.account_id) ? value.account_id : null;
}

function rowCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function unavailableSnapshot(
  kind: "missing" | "incompatible" | "error",
  reason: string,
  data: BudgetResultsData,
): BudgetResultsSnapshot {
  return {
    state: { kind, reason, lastCompleteAt: null },
    account: null,
    windows: [],
    campaigns: [],
    provenance: {
      campaignRows: rowCount(data.campaigns),
      metricRows: rowCount(data.metrics),
      resultRows: rowCount(data.results),
      syncRunRows: rowCount(data.syncRuns),
      plannedActionRows: rowCount(data.plans),
      budgetLinkRows: 0,
    },
  };
}

/**
 * Isole le compte du run Meta le plus récent avant de construire le modèle.
 * Les anciens comptes éventuellement conservés dans l'historique ne sont
 * jamais agrégés avec le compte courant.
 */
export function presentBudgetResults(
  data: BudgetResultsData,
  organizationId: string,
  asOf: string,
): BudgetResultsSnapshot {
  if (
    !data.complete ||
    !Array.isArray(data.campaigns) ||
    !Array.isArray(data.metrics) ||
    !Array.isArray(data.results) ||
    !Array.isArray(data.syncRuns) ||
    !Array.isArray(data.plans)
  ) {
    return unavailableSnapshot("error", "source_read_unavailable", data);
  }

  if (data.accountId === null) {
    return unavailableSnapshot("missing", "no_meta_account_configured", data);
  }
  const accountId = accountIdFrom({ account_id: data.accountId });
  if (!accountId) return unavailableSnapshot("incompatible", "invalid_account_scope", data);

  const campaigns = data.campaigns.filter(
    (row) => accountIdFrom(row) === accountId,
  );
  const metrics = data.metrics.filter((row) => accountIdFrom(row) === accountId);
  const syncRuns = data.syncRuns.filter(
    (row) => accountIdFrom(row) === accountId,
  );
  const metricIds = new Set(
    metrics.flatMap((row) =>
      isRecord(row) && typeof row.id === "string" ? [row.id] : [],
    ),
  );
  const results = data.results.filter(
    (row) =>
      isRecord(row) &&
      typeof row.ad_metric_id === "string" &&
      metricIds.has(row.ad_metric_id),
  );

  return buildBudgetResults({
    organizationId,
    accountId,
    asOf,
    campaigns,
    metrics,
    results,
    syncRuns,
    plannedActions: data.plans,
    // Le schéma 32 n'expose encore aucun rapprochement explicite. Ne jamais
    // déduire un lien depuis un nom, un identifiant ou une ressemblance.
    budgetLinks: [],
  });
}
