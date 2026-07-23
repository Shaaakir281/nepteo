"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { seedMetaAdsDemo } from "@/lib/ads/seed";
import { runAdsAnalysis } from "@/lib/ads/analysis";

/** Charge les données de démo Meta Ads (fictives) pour l'organisation. */
export async function loadAdsDemo() {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/campagnes");
  const admin = createAdminClient();
  await seedMetaAdsDemo(admin, ctx.orgId, ctx.userId);
  revalidatePath("/campagnes");
}

/** Variante form (bouton « Analyser mes campagnes »). */
export async function analyzeAdsForm() {
  await analyzeAdsNow();
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
