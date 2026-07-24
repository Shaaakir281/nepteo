"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { seedMetaAdsDemo } from "@/lib/ads/seed";
import { runAdsAnalysis } from "@/lib/ads/analysis";
import {
  aggregate,
  deriveKpis,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";
import {
  buildCampaignPlan,
  objectiveLabel,
  channelLabel,
  type CampaignBrief,
  type CampaignPlan,
} from "@/lib/campaign-plan";
import { generateCampaignVariants } from "@/lib/campaign";

/** Charge les données de démo Meta Ads (fictives) pour l'organisation. */
export async function loadAdsDemo() {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/campagnes");
  const admin = createAdminClient();
  await seedMetaAdsDemo(admin, ctx.orgId, ctx.userId);
  revalidatePath("/campagnes");
}

export type CampaignBuild = { plan: CampaignPlan; variants: string[] };

/** Coût/contact moyen réel (dépense / conversions) si des campagnes existent. */
async function avgCostPerContact(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data: rows } = await admin
    .from("ad_metrics")
    .select("campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue")
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads");
  if (!rows || rows.length === 0) return null;
  const total = deriveKpis(
    aggregate(
      rows.map((r) => ({ ...r, spend: Number(r.spend), revenue: Number(r.revenue) })) as CampaignMetric[],
    ),
  );
  return total.conversions > 0 ? total.cac : null;
}

/** Étape « Construction » : calcule le plan + rédige les variantes. Ne lance rien. */
export async function buildCampaignAction(
  objectif: string,
  canal: string,
  budgetJour: number,
  contexte: string,
): Promise<{ ok: boolean; build?: CampaignBuild }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false };
  const admin = createAdminClient();

  const brief: CampaignBrief = { objectif, canal, budgetJour, contexte };
  const avg = await avgCostPerContact(admin, ctx.orgId);
  const plan = buildCampaignPlan(brief, { avgCostPerContact: avg });

  const { data: mem } = await admin
    .from("company_memory")
    .select("section, content")
    .eq("organization_id", ctx.orgId)
    .in("section", ["activite", "offres", "ton"]);
  const memCtx = Object.fromEntries((mem ?? []).map((m) => [m.section, m.content]));
  const variants = await generateCampaignVariants({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    ctx: memCtx,
    brief,
  });

  return { ok: true, build: { plan, variants } };
}

/** Étape finale : la campagne rejoint la file de validation (rien n'est lancé). */
export async function submitCampaignAction(
  brief: CampaignBrief,
  plan: CampaignPlan,
  variants: string[],
): Promise<{ ok: boolean }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false };
  const admin = createAdminClient();

  const title = `Lancer la campagne « ${objectiveLabel(brief.objectif)} » sur ${channelLabel(brief.canal)}`;
  const { error } = await admin.from("actions").insert({
    organization_id: ctx.orgId,
    kind: "launch_campaign",
    title,
    finding: `Campagne préparée : ${plan.budgetTotal} € sur ${plan.dureeJours} jours, coût/contact prévu ${plan.coutContact} €, ${plan.contactsMin}–${plan.contactsMax} contacts estimés.`,
    rationale:
      "L'agent a construit la campagne (audience, budget, messages) à partir de votre mémoire et de vos données. Validez pour la garder prête ; le lancement réel restera une étape séparée et explicite.",
    data_sources: ["Mémoire entreprise", "Campagnes (Meta)"],
    expected_impact: `${plan.contactsMin}–${plan.contactsMax} contacts pour ${plan.budgetTotal} €`,
    confidence: plan.confiance,
    risk: "medium",
    status: "proposed",
    payload: { brief, plan, variants },
  });
  if (error) return { ok: false };

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "action_proposed",
    actor: "agent",
    actor_id: ctx.userId,
    payload: { kind: "launch_campaign", title },
  });
  revalidatePath("/");
  return { ok: true };
}

/** Variante form (bouton « Analyser mes campagnes ») — redirige avec le compte. */
export async function analyzeAdsForm() {
  const res = await analyzeAdsNow();
  redirect(`/campagnes?proposed=${res.ok ? res.created : "err"}`);
}

/** Analyse les campagnes et propose des actions (couper les campagnes en perte). */
export async function analyzeAdsNow(): Promise<{ ok: boolean; created: number }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, created: 0 };
  const admin = createAdminClient();
  try {
    const created = await runAdsAnalysis(admin, ctx.orgId, ctx.userId);
    revalidatePath("/campagnes");
    revalidatePath("/");
    return { ok: true, created };
  } catch {
    return { ok: false, created: 0 };
  }
}
