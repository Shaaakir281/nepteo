import type { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregate,
  buildAdsProposals,
  deriveKpis,
  rollupByCampaign,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";

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
): Promise<number> {
  const { data: rows } = await admin
    .from("ad_metrics")
    .select("campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue")
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads");
  if (!rows || rows.length === 0) return 0;

  const metrics = rows.map((r) => ({
    ...r,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
  })) as CampaignMetric[];
  const campaigns = rollupByCampaign(metrics).map(deriveKpis);
  const proposals = buildAdsProposals(campaigns);
  if (proposals.length === 0) return 0;

  // Dédupe : ne pas reproposer un kind déjà en file.
  const { data: existing } = await admin
    .from("actions")
    .select("kind")
    .eq("organization_id", orgId)
    .eq("status", "proposed");
  const existingKinds = new Set((existing ?? []).map((a) => a.kind));
  const fresh = proposals.filter((p) => !existingKinds.has(p.kind));
  if (fresh.length === 0) return 0;

  const { error } = await admin.from("actions").insert(
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
      payload: p.payload,
    })),
  );
  if (error) throw new Error(error.message);

  for (const p of fresh) {
    await admin.from("journal").insert({
      organization_id: orgId,
      event: "action_proposed",
      actor: "agent",
      actor_id: actorId,
      payload: { kind: p.kind, title: p.title },
    });
  }
  return fresh.length;
}
