"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { seedMetaAdsDemo } from "@/lib/ads/seed";

/** Charge les données de démo Meta Ads (fictives) pour l'organisation. */
export async function loadAdsDemo() {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/campagnes");
  const admin = createAdminClient();
  await seedMetaAdsDemo(admin, ctx.orgId, ctx.userId);
  revalidatePath("/campagnes");
}
