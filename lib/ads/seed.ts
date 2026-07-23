import type { createAdminClient } from "@/lib/supabase/admin";
import { mockMetaCampaigns } from "@/lib/ads/mock-provider";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Charge des données de démo Meta Ads (fictives) dans `ad_metrics`, en upsert
 * idempotent (org+provider+campaign+date). Sert à développer/démontrer le
 * connecteur sans compte ni dépense. L'API réelle écrira les mêmes lignes.
 */
export async function seedMetaAdsDemo(
  admin: Admin,
  orgId: string,
  actorId: string | null,
): Promise<number> {
  const now = new Date().toISOString();
  const rows = mockMetaCampaigns(7).map((r) => ({
    organization_id: orgId,
    provider: "meta_ads",
    campaign_id: r.campaign_id,
    campaign_name: r.campaign_name,
    date: r.date,
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend,
    conversions: r.conversions,
    revenue: r.revenue,
    synced_at: now,
  }));

  const { error } = await admin
    .from("ad_metrics")
    .upsert(rows, { onConflict: "organization_id,provider,campaign_id,date" });
  if (error) throw new Error(error.message);

  await admin.from("journal").insert({
    organization_id: orgId,
    event: "ads_demo_loaded",
    actor: "user",
    actor_id: actorId,
    payload: { provider: "meta_ads", rows: rows.length },
  });

  return rows.length;
}
