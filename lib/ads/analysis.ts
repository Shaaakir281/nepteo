import type { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAdsProposals,
  rollupWithStatus,
  windowBounds,
  type DatedMetric,
} from "./metrics-rules.ts";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Analyse des campagnes payantes (Phase 2/3) : lit `ad_metrics`, en tire des
 * propositions d'action (couper les campagnes en perte) dans la file de
 * validation. Propose, n'exécute pas. Retourne le nombre de propositions créées.
 */
export async function runAdsAnalysis(
  admin: Admin,
  orgId: string,
  actorId: string | null,
  options?: {
    campaignIdPrefix?: string;
    demo?: boolean;
  },
): Promise<number> {
  // Historique complet : on a besoin des dates pour distinguer une campagne
  // en cours d'une campagne arrêtée (qu'il serait absurde de proposer à couper).
  let metricQuery = admin
    .from("ad_metrics")
    .select("campaign_id, campaign_name, date, impressions, clicks, spend, conversions, revenue")
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads");
  if (options?.campaignIdPrefix) {
    metricQuery = metricQuery.like(
      "campaign_id",
      `${options.campaignIdPrefix}%`,
    );
  }
  const { data: rows, error: metricsError } = await metricQuery;
  if (metricsError) {
    throw new Error(
      `[ads-analysis] lecture ad_metrics: ${metricsError.message}`,
    );
  }
  if (!rows || rows.length === 0) return 0;

  const metrics = rows.map((r) => ({
    ...r,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
  })) as DatedMetric[];
  const campaigns = rollupWithStatus(metrics, windowBounds());
  const proposals = buildAdsProposals(campaigns);
  if (proposals.length === 0) return 0;

  // Dédupe : ne pas reproposer un kind déjà en file.
  const { data: existing, error: existingError } = await admin
    .from("actions")
    .select("kind")
    .eq("organization_id", orgId)
    .eq("status", "proposed");
  if (existingError) {
    throw new Error(
      `[ads-analysis] lecture actions existantes: ${existingError.message}`,
    );
  }
  const existingKinds = new Set((existing ?? []).map((a) => a.kind));
  const fresh = proposals.filter((p) => !existingKinds.has(p.kind));
  if (fresh.length === 0) return 0;

  const { error: actionsError } = await admin.from("actions").insert(
    fresh.map((p) => ({
      organization_id: orgId,
      kind: p.kind,
      title: p.title,
      finding: p.finding,
      rationale: p.rationale,
      data_sources: p.data_sources,
      expected_impact: p.expected_impact,
      confidence: p.confidence,
      risk: p.risk,
      status: "proposed",
      payload: options?.demo ? { ...p.payload, demo: true } : p.payload,
    })),
  );
  if (actionsError) {
    throw new Error(
      `[ads-analysis] insertion actions: ${actionsError.message}`,
    );
  }

  // La trace `action_proposed` fait partie du contrat de l'analyse. Une erreur
  // de journal ne doit donc jamais être transformée en succès silencieux. Le
  // lot unique évite aussi un journal partiellement écrit entre propositions.
  const { error: journalError } = await admin.from("journal").insert(
    fresh.map((p) => ({
      organization_id: orgId,
      event: "action_proposed",
      actor: "agent",
      actor_id: actorId,
      payload: { kind: p.kind, title: p.title },
    })),
  );
  if (journalError) {
    throw new Error(
      `[ads-analysis] insertion journal: ${journalError.message}`,
    );
  }
  return fresh.length;
}
