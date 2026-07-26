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
  // Le nom d'organisation vit dans le layout du cockpit (sidebar), pas dans
  // les pages ci-dessous. Sans cette invalidation, charger/retirer un scénario
  // peut laisser l'ancien nom visible malgré une base correctement mise à jour.
  revalidatePath("/", "layout");
  for (const p of ["/", "/prospects", "/campagnes", "/contenu", "/entreprise"]) {
    revalidatePath(p);
  }
}

export type DemoResult =
  | { ok: true; prospects: number; created: number }
  /**
   * `detail` porte le message technique de l'échec (table + erreur Postgres).
   * Sans lui, « ça n'a pas abouti » n'est pas exploitable : ni l'utilisateur ni
   * nous ne savons quoi réessayer. Il est affiché à l'écran ET écrit au journal.
   */
  | { ok: false; reason: string; detail?: string };

/** Message technique d'une exception, sans jamais faire tomber l'affichage. */
function detailOf(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  return raw.trim().slice(0, 300) || "erreur inconnue";
}

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
  } catch (err) {
    return { ok: false, reason: "failed", detail: detailOf(err) };
  }
}

/**
 * Vide les données de démo et **rend la fiche entreprise d'origine**.
 *
 * Un échec n'est jamais avalé : la base peut rester à moitié nettoyée, donc
 * l'appelant doit pouvoir le dire à l'écran, et le journal en garde la trace.
 */
export async function clearDemoAction(): Promise<DemoResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };
  const admin = createAdminClient();
  try {
    await clearDemoData(admin, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
    });
    revalidateCockpit();
    return { ok: true, prospects: 0, created: 0 };
  } catch (err) {
    const detail = detailOf(err);
    await admin.from("journal").insert({
      organization_id: ctx.orgId,
      event: "demo_scenario_clear_failed",
      actor: "user",
      actor_id: ctx.userId,
      payload: { error: detail },
    });
    // Le retrait a pu aboutir en partie : on rafraîchit pour montrer l'état réel.
    revalidateCockpit();
    return { ok: false, reason: "failed", detail };
  }
}
