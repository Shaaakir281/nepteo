"use server";

import { runAdsAnalysis } from "@/lib/ads/analysis";
import { runAnalysis } from "@/lib/analysis";
import { getEditorContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEMO_CAMPAIGN_PREFIX,
  DEMO_PROVIDER,
} from "@/lib/demo/isolation-rules";
import { isDemoModeActive } from "@/lib/demo/isolation";
import { withDemoMutationLock } from "@/lib/demo/lock";

/**
 * Lance l'analyse à la demande et **retourne** le nombre de propositions créées
 * (le cron s'en chargera aussi à terme). Valeur de retour → appelée depuis le
 * runner animé (autonomie visible), qui rafraîchit ensuite la vue.
 */
export async function analyzeNow(): Promise<{ ok: boolean; created: number }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, created: 0 };

  const admin = createAdminClient();
  try {
    return await withDemoMutationLock(admin, ctx.orgId, "analysis", async () => {
      const demo = await isDemoModeActive(admin, ctx.orgId);
      await admin.from("journal").insert({
        organization_id: ctx.orgId,
        event: "analysis_run",
        actor: "user",
        actor_id: ctx.userId,
        payload: demo ? { demo: true } : {},
      });

      try {
        const created = await runAnalysis(admin, ctx.orgId, ctx.userId, {
          ...(demo ? { prospectSource: DEMO_PROVIDER, demo: true } : {}),
        });
        let adsCreated = 0;
        if (ctx.canManageCampaigns) {
          try {
            adsCreated = await runAdsAnalysis(admin, ctx.orgId, ctx.userId, {
              ...(demo
                ? {
                    campaignIdPrefix: DEMO_CAMPAIGN_PREFIX,
                    demo: true,
                  }
                : {}),
            });
          } catch {
            // l'analyse ads ne doit pas casser l'analyse prospects
          }
        }
        return { ok: true, created: created + adsCreated };
      } catch {
        return { ok: false, created: 0 };
      }
    });
  } catch {
    // Verrou occupé ou indisponible : pas d'analyse concurrente.
    return { ok: false, created: 0 };
  }
}
