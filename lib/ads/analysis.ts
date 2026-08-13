import type { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAdsProposals,
  windowBounds,
} from "./metrics-rules.ts";
import { buildCampaignCockpit } from "../campaign-cockpit.ts";

type Admin = ReturnType<typeof createAdminClient>;
const ADS_ANALYSIS_ROW_LIMIT = 5_000;
const ADS_ACTION_ROW_LIMIT = 5_000;

/**
 * Analyse des campagnes payantes (Phase 2/3) : lit `ad_metrics`, en tire des
 * propositions d'action (couper les campagnes en perte) dans la file de
 * validation. Propose, n'exécute pas. Retourne le nombre de propositions créées.
 */
export async function runAdsAnalysis(
  admin: Admin,
  orgId: string,
  actorId: string,
  options?: {
    campaignIdPrefix?: string;
    demo?: boolean;
  },
): Promise<number> {
  const bounds = windowBounds();
  let metricQuery = admin
    .from("ad_metrics")
    .select(
      "provider, campaign_id, campaign_name, date, impressions, clicks, spend, conversions, revenue, synced_at",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads")
    .in("outcome_provenance", ["demo", "verified_downstream"])
    .gte("date", bounds.currentFrom)
    .lte("date", bounds.currentTo)
    .order("date", { ascending: false })
    .limit(ADS_ANALYSIS_ROW_LIMIT);
  if (options?.campaignIdPrefix) {
    metricQuery = metricQuery.like(
      "campaign_id",
      `${options.campaignIdPrefix}%`,
    );
  }
  const { data: rows, error: metricsError, count } = await metricQuery;
  if (metricsError) {
    throw new Error(
      `[ads-analysis] lecture ad_metrics: ${metricsError.message}`,
    );
  }
  if (!rows || count === null) {
    throw new Error("[ads-analysis] lecture ad_metrics: résultat incomplet");
  }
  if (count > ADS_ANALYSIS_ROW_LIMIT || count !== rows.length) {
    throw new Error("[ads-analysis] lecture ad_metrics: résultat tronqué");
  }
  if (rows.length === 0) return 0;

  const snapshot = buildCampaignCockpit({
    rows,
    actions: [],
    journal: [],
    providerStatuses: [],
    window: { from: bounds.currentFrom, to: bounds.currentTo },
    comparison: { kind: "none" },
    filters: { channels: ["meta"], statuses: "all" },
  });
  if (!snapshot.ok) {
    throw new Error(`[ads-analysis] métriques invalides: ${snapshot.error}`);
  }
  const campaigns = snapshot.cockpit.campaigns.flatMap((campaign) =>
    campaign.performance?.scope === "selected_window"
      ? [
          {
            campaign_id: campaign.campaignId,
            campaign_name: campaign.campaignName,
            spend: campaign.performance.metrics.spend,
            revenue: campaign.performance.metrics.revenue,
            roas: campaign.performance.metrics.roas ?? 0,
            firstDate: campaign.performance.source.from,
            lastDate: campaign.performance.source.to,
          },
        ]
      : [],
  );
  const proposals = buildAdsProposals(campaigns, {
    demo: Boolean(options?.demo),
  });
  if (proposals.length === 0) return 0;

  const { data: existingActions, error: actionsError, count: actionCount } = await admin
    .from("actions")
    .select("kind, confidence", { count: "exact" })
    .eq("organization_id", orgId)
    .like("kind", "ads\\_pause\\_%")
    .order("created_at", { ascending: false })
    .limit(ADS_ACTION_ROW_LIMIT);
  if (actionsError) {
    throw new Error(`[ads-analysis] lecture actions: ${actionsError.message}`);
  }
  if (!existingActions || actionCount === null) {
    throw new Error("[ads-analysis] lecture actions: résultat incomplet");
  }
  if (actionCount > ADS_ACTION_ROW_LIMIT || actionCount !== existingActions.length) {
    throw new Error("[ads-analysis] lecture actions: résultat tronqué");
  }
  const canonicalKinds = new Set<string>();
  for (const row of existingActions) {
    if (
      !row || typeof row !== "object" || Array.isArray(row) ||
      typeof row.kind !== "string" || row.kind.trim() === "" ||
      row.confidence !== null && (
        typeof row.confidence !== "number" || !Number.isFinite(row.confidence) ||
        row.confidence < 0 || row.confidence > 1
      )
    ) {
      throw new Error("[ads-analysis] lecture actions: ligne invalide");
    }
    if (row.confidence === null) canonicalKinds.add(row.kind);
  }

  // La RPC borne le lot à 20, revalide chaque proposition, déduplique le kind
  // encore proposed et écrit action + journal dans une seule transaction.
  // Aucun chemin CAMP-2 ne prépare d'outbox ni n'appelle un fournisseur Ads.
  const selected = proposals
    // Une confiance non nulle identifie une ancienne proposition à adopter
    // transactionnellement par la RPC. Les décisions CAMP-2 déjà canoniques
    // restent durablement supprimées, quel que soit leur statut.
    .filter((proposal) => !canonicalKinds.has(proposal.kind))
    .slice(0, 20)
    .map((proposal) => ({
      ...proposal,
      payload: options?.demo
        ? { ...proposal.payload, demo: true }
        : proposal.payload,
    }));
  if (selected.length === 0) return 0;
  const { data, error } = await admin.rpc("propose_ads_pause_actions", {
    p_organization_id: orgId,
    p_actor_id: actorId,
    p_proposals: selected,
  });
  if (error) {
    throw new Error(
      `[ads-analysis] proposition atomique actions+journal: ${error.message}`,
    );
  }
  const createdCount =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).created_count
      : null;
  if (
    typeof createdCount !== "number" ||
    !Number.isInteger(createdCount) ||
    createdCount < 0 ||
    createdCount > selected.length
  ) {
    throw new Error("[ads-analysis] résultat atomique invalide");
  }
  return createdCount;
}
