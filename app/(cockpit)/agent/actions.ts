"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { clearDemoData, loadDemoScenario } from "@/lib/demo/seed";
import { DEMO_SCENARIO_IDS } from "@/lib/demo/scenarios";
import { runAnalysis } from "@/lib/analysis";
import { runAdsAnalysis } from "@/lib/ads/analysis";

const LEVELS = ["suggest", "prepare"] as const;

/** Change le niveau d'autonomie de l'agent (proposer seulement / préparer). */
export async function setAutonomyLevel(level: string): Promise<void> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) redirect("/login");
  if (!(LEVELS as readonly string[]).includes(level))
    redirect("/entreprise?onglet=agent");

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({ autonomy_level: level })
    .eq("id", ctx.orgId);
  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "autonomy_changed",
    actor: "user",
    actor_id: ctx.userId,
    payload: { level },
  });
  // L'onglet Agent vit désormais sous /entreprise (C4).
  revalidatePath("/entreprise");
  revalidatePath("/");
}

/** Toutes les vues qui dépendent des données de démo. `/agent` et `/plan` ne
 *  sont plus des écrans : ce sont des redirections (onglet Agent, Aujourd'hui). */
function revalidateCockpit(): void {
  for (const p of ["/", "/prospects", "/campagnes", "/contenu", "/entreprise"]) {
    revalidatePath(p);
  }
}

export type DemoResult =
  | { ok: true; prospects: number; created: number }
  | { ok: false; reason: string };

/**
 * Charge un scénario de démonstration complet (entreprise fictive : identité,
 * prospects, campagnes, ventes). Données FICTIVES et cohérentes entre elles —
 * aucun connecteur à brancher pour voir le cockpit vivre.
 */
export async function loadDemoScenarioAction(scenarioId: string): Promise<DemoResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };
  if (!DEMO_SCENARIO_IDS.includes(scenarioId)) {
    return { ok: false, reason: "unknown_scenario" };
  }

  const admin = createAdminClient();
  try {
    const result = await loadDemoScenario(admin, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      scenarioId,
    });

    // On enchaîne l'analyse : le cockpit est immédiatement vivant (briefing +
    // propositions), sans avoir à naviguer puis relancer à la main. Un échec
    // d'analyse ne doit pas faire échouer le chargement des données.
    let created = 0;
    try {
      created = await runAnalysis(admin, ctx.orgId, ctx.userId);
    } catch {
      /* ignoré volontairement */
    }
    try {
      created += await runAdsAnalysis(admin, ctx.orgId, ctx.userId);
    } catch {
      /* ignoré volontairement */
    }

    revalidateCockpit();
    return { ok: true, prospects: result.prospects, created };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Vide les données de démo — pour montrer le cockpit à son état initial. */
export async function clearDemoAction(): Promise<DemoResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };
  try {
    await clearDemoData(createAdminClient(), {
      orgId: ctx.orgId,
      actorId: ctx.userId,
    });
    revalidateCockpit();
    return { ok: true, prospects: 0, created: 0 };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
