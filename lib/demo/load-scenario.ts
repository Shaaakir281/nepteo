import { runAdsAnalysis } from "@/lib/ads/analysis";
import { runAnalysis } from "@/lib/analysis";
import {
  demoAnalysisDetail,
  settleDemoAnalysis,
  type DemoAnalysisStep,
} from "@/lib/demo/analysis-outcome";
import {
  DEMO_CAMPAIGN_PREFIX,
  DEMO_PROVIDER,
} from "@/lib/demo/isolation-rules";
import { withDemoMutationLock } from "@/lib/demo/lock";
import { loadDemoScenario } from "@/lib/demo/seed";
import type { Admin } from "@/lib/demo/db";

export interface LoadedDemoScenario {
  prospects: number;
  created: number;
  analysis: {
    prospects: DemoAnalysisStep;
    campaigns: DemoAnalysisStep;
  };
}

async function journalAnalysis(
  admin: Admin,
  orgId: string,
  actorId: string,
  scope: "prospects" | "campaigns",
  step: DemoAnalysisStep,
): Promise<DemoAnalysisStep> {
  const { error } = await admin.from("journal").insert({
    organization_id: orgId,
    event: "analysis_run",
    actor: "agent",
    actor_id: actorId,
    payload: {
      mode: "demo_seed",
      scope,
      status: step.ok ? "succeeded" : "failed",
      created: step.created,
      ...(step.detail ? { error: step.detail } : {}),
    },
  });
  if (!error) return step;
  return {
    ok: false,
    created: step.created,
    detail: [step.detail, `[demo-analysis] journal ${scope}: ${error.message}`]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * Frontière partagée du chargement d'un scénario.
 *
 * L'onboarding et le panneau Connecteurs passent tous les deux par le même
 * verrou distribué, le même préflight d'isolation dans `loadDemoScenario`
 * et les mêmes analyses bornées au seed. Aucun appel de recherche web n'est
 * impliqué dans cette démonstration.
 */
export async function loadAndAnalyzeDemoScenario(
  admin: Admin,
  args: { orgId: string; actorId: string; scenarioId: string },
): Promise<LoadedDemoScenario> {
  return withDemoMutationLock(admin, args.orgId, "demo", async () => {
    const loaded = await loadDemoScenario(admin, args);
    let prospects = await settleDemoAnalysis(() =>
      runAnalysis(admin, args.orgId, args.actorId, {
        prospectSource: DEMO_PROVIDER,
        demo: true,
      }),
    );
    prospects = await journalAnalysis(
      admin,
      args.orgId,
      args.actorId,
      "prospects",
      prospects,
    ).catch((error) => ({
      ok: false,
      created: prospects.created,
      detail: [prospects.detail, demoAnalysisDetail(error)]
        .filter(Boolean)
        .join(" · "),
    }));

    let campaigns = await settleDemoAnalysis(() =>
      runAdsAnalysis(admin, args.orgId, args.actorId, {
        campaignIdPrefix: DEMO_CAMPAIGN_PREFIX,
        demo: true,
      }),
    );
    campaigns = await journalAnalysis(
      admin,
      args.orgId,
      args.actorId,
      "campaigns",
      campaigns,
    ).catch((error) => ({
      ok: false,
      created: campaigns.created,
      detail: [campaigns.detail, demoAnalysisDetail(error)]
        .filter(Boolean)
        .join(" · "),
    }));

    return {
      prospects: loaded.prospects,
      created: prospects.created + campaigns.created,
      analysis: { prospects, campaigns },
    };
  });
}
