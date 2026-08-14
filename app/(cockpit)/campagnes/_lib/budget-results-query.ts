import type { getCurrentAuthContext } from "@/lib/auth/context";
import { readSelectedMetaAdAccount } from "@/lib/connectors/meta-ads";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUDGET_CAMPAIGN_ROW_LIMIT,
  BUDGET_METRIC_ROW_LIMIT,
  BUDGET_RESULT_ROW_LIMIT,
  BUDGET_SYNC_RUN_ROW_LIMIT,
} from "./campaign-page-constants";
import { isoDaysAgo } from "./campaign-formatters";
import { completeRead } from "./campaign-read-utils";

type CampaignPageSupabase = Awaited<
  ReturnType<typeof getCurrentAuthContext>
>["supabase"];

/**
 * Lecture dédiée aux faits Meta déclarés par le fournisseur.
 *
 * Elle reste volontairement séparée du snapshot CAMP-2 aval : aucun revenu,
 * CAC, ROAS, constat, recommandation ou chemin d'exécution n'est sélectionné.
 */
export async function readBudgetResultsData(
  supabase: CampaignPageSupabase,
  organizationId: string,
  asOf: Date,
) {
  // Deux fenêtres de 30 jours adjacentes, avec un jour de marge pour les
  // comptes dont le fuseau diffère de celui du serveur.
  const historyFrom = isoDaysAgo(asOf, 60);
  const historyFromTimestamp = new Date(
    asOf.getTime() - 61 * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const connectorResult = await createAdminClient()
    .from("connectors")
    .select("config")
    .eq("organization_id", organizationId)
    .eq("provider", "meta_ads")
    .maybeSingle();

  if (connectorResult.error) {
    return {
      complete: false,
      accountId: null,
      metrics: null,
      campaigns: null,
      results: null,
      syncRuns: null,
      plans: null,
    };
  }

  const accountId = readSelectedMetaAdAccount(connectorResult.data?.config)?.id ?? null;
  if (!accountId) {
    return {
      complete: true,
      accountId: null,
      metrics: [],
      campaigns: [],
      results: [],
      syncRuns: [],
      plans: [],
    };
  }

  const syncRunSelect =
    "id, organization_id, provider, account_id, quality, applied, error_code, observation_from, observation_to, currency, account_timezone, campaign_count, metric_count, result_count, started_at, completed_at";
  const [
    metricsResult,
    campaignsResult,
    resultsResult,
    syncRunsResult,
    latestRunResult,
    latestCompleteRunResult,
  ] = await Promise.all([
    supabase
      .from("ad_metrics")
      .select(
        "id, organization_id, provider, account_id, campaign_id, campaign_name, date, spend, currency, account_timezone, attribution_model, attribution_windows, metric_provenance, data_quality, observation_from, observation_to, sync_run_id, synced_at",
        { count: "exact" },
      )
      .eq("organization_id", organizationId)
      .eq("provider", "meta_ads")
      .eq("account_id", accountId)
      .eq("metric_provenance", "provider_reported")
      .gte("date", historyFrom)
      .order("date", { ascending: false })
      .limit(BUDGET_METRIC_ROW_LIMIT),
    supabase
      .from("ad_campaigns")
      .select(
        "id, organization_id, provider, account_id, campaign_id, campaign_name, effective_status, configured_status, objective, currency, account_timezone, sync_run_id, synced_at",
        { count: "exact" },
      )
      .eq("organization_id", organizationId)
      .eq("provider", "meta_ads")
      .eq("account_id", accountId)
      .order("synced_at", { ascending: false })
      .limit(BUDGET_CAMPAIGN_ROW_LIMIT),
    supabase
      .from("ad_metric_results")
      .select(
        "id, organization_id, ad_metric_id, result_type, result_value, result_source, attribution_model, attribution_windows, sync_run_id, synced_at, ad_metrics!inner(provider, date, metric_provenance)",
        { count: "exact" },
      )
      .eq("organization_id", organizationId)
      .eq("result_source", "provider_reported")
      .eq("ad_metrics.provider", "meta_ads")
      .eq("ad_metrics.account_id", accountId)
      .eq("ad_metrics.metric_provenance", "provider_reported")
      .gte("ad_metrics.date", historyFrom)
      .order("synced_at", { ascending: false })
      .limit(BUDGET_RESULT_ROW_LIMIT),
    supabase
      .from("ad_metric_sync_runs")
      .select(syncRunSelect, { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("provider", "meta_ads")
      .eq("account_id", accountId)
      .gte("completed_at", historyFromTimestamp)
      .order("completed_at", { ascending: false })
      .limit(BUDGET_SYNC_RUN_ROW_LIMIT),
    supabase
      .from("ad_metric_sync_runs")
      .select(syncRunSelect)
      .eq("organization_id", organizationId)
      .eq("provider", "meta_ads")
      .eq("account_id", accountId)
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase
      .from("ad_metric_sync_runs")
      .select(syncRunSelect)
      .eq("organization_id", organizationId)
      .eq("provider", "meta_ads")
      .eq("account_id", accountId)
      .eq("quality", "complete")
      .eq("applied", true)
      .order("completed_at", { ascending: false })
      .limit(1),
  ]);

  const singletonRead = (result: {
    data: unknown[] | null;
    error: unknown;
  }) => result.error === null && Array.isArray(result.data) && result.data.length <= 1;

  const complete =
    completeRead(metricsResult, BUDGET_METRIC_ROW_LIMIT) &&
    completeRead(campaignsResult, BUDGET_CAMPAIGN_ROW_LIMIT) &&
    completeRead(resultsResult, BUDGET_RESULT_ROW_LIMIT) &&
    completeRead(syncRunsResult, BUDGET_SYNC_RUN_ROW_LIMIT) &&
    singletonRead(latestRunResult) &&
    singletonRead(latestCompleteRunResult);

  const syncRuns = complete
    ? Array.from(
        new Map(
          [
            ...(syncRunsResult.data ?? []),
            ...(latestRunResult.data ?? []),
            ...(latestCompleteRunResult.data ?? []),
          ].map((row) => [row.id, row]),
        ).values(),
      ).sort((left, right) =>
        right.completed_at.localeCompare(left.completed_at) ||
        right.id.localeCompare(left.id),
      )
    : null;

  return {
    complete,
    accountId,
    metrics: complete ? metricsResult.data : null,
    campaigns: complete ? campaignsResult.data : null,
    results: complete ? resultsResult.data : null,
    syncRuns,
    // Aucun stockage de rapprochement explicite n'existe au schéma 32. Lire
    // des plans sans lien certifié encouragerait un auto-match interdit.
    plans: complete ? [] : null,
  };
}

export type BudgetResultsData = Awaited<ReturnType<typeof readBudgetResultsData>>;
