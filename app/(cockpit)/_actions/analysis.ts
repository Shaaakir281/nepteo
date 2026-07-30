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
import { DemoBusyError, withDemoMutationLock } from "@/lib/demo/lock";

export type AnalyzeNowResult =
  | {
      ok: true;
      created: number;
      warning?: "ads_failed";
    }
  | {
      ok: false;
      created: 0;
      reason: "forbidden" | "busy" | "analysis_failed";
    };

/**
 * Lance l'analyse à la demande et **retourne** le nombre de propositions créées
 * (le cron s'en chargera aussi à terme). Valeur de retour → appelée depuis le
 * runner animé (autonomie visible), qui rafraîchit ensuite la vue.
 */
export async function analyzeNow(): Promise<AnalyzeNowResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) {
    return { ok: false, created: 0, reason: "forbidden" };
  }

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
        let adsFailed = false;
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
            // L'analyse prospects reste acquise, mais l'interface doit annoncer
            // explicitement que la passe publicitaire n'a pas abouti.
            adsFailed = true;
          }
        }
        return {
          ok: true,
          created: created + adsCreated,
          ...(adsFailed ? { warning: "ads_failed" as const } : {}),
        };
      } catch {
        return { ok: false, created: 0, reason: "analysis_failed" };
      }
    });
  } catch (error) {
    // Un verrou réellement occupé se distingue d'une panne de lecture/écriture :
    // l'interface ne doit pas annoncer une concurrence qui n'existe pas.
    return {
      ok: false,
      created: 0,
      reason: error instanceof DemoBusyError ? "busy" : "analysis_failed",
    };
  }
}
