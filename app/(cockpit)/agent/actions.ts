"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/auth/context";
import { changeExecutionControl } from "@/lib/execution-controls";
import { clearDemoData } from "@/lib/demo/seed";
import { DEMO_SCENARIO_IDS } from "@/lib/demo/scenarios";
import {
  DEMO_ISOLATION_CONFLICT_LABELS,
  DemoIsolationError,
} from "@/lib/demo/isolation";
import {
  DemoBusyError,
  withDemoMutationLock,
} from "@/lib/demo/lock";
import { demoAnalysisDetail, type DemoAnalysisStep } from "@/lib/demo/analysis-outcome";
import { loadAndAnalyzeDemoScenario } from "@/lib/demo/load-scenario";

const LEVELS = ["suggest", "prepare"] as const;

/** Change le niveau d'autonomie de l'agent (proposer seulement / préparer). */
export async function setAutonomyLevel(level: string): Promise<void> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) redirect("/login");
  if (!(LEVELS as readonly string[]).includes(level))
    redirect("/entreprise?onglet=agent");

  const admin = createAdminClient();
  await changeExecutionControl(
    admin,
    ctx.orgId,
    ctx.userId,
    "autonomy",
    level,
  );
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
  | {
      ok: true;
      prospects: number;
      created: number;
      analysis: {
        prospects: DemoAnalysisStep;
        campaigns: DemoAnalysisStep;
      };
    }
  /**
   * `detail` porte le message technique de l'échec (table + erreur Postgres).
   * Sans lui, « ça n'a pas abouti » n'est pas exploitable : ni l'utilisateur ni
   * nous ne savons quoi réessayer. Il est affiché à l'écran ET écrit au journal.
   */
  | {
      ok: false;
      reason: string;
      detail?: string;
      categories?: string[];
    };

/** Message technique d'une exception, sans jamais faire tomber l'affichage. */
function detailOf(err: unknown): string {
  return demoAnalysisDetail(err);
}

/**
 * Charge un scénario d'exemple complet (identité, prospects, campagnes,
 * ventes). Les données sont cohérentes entre elles : aucun connecteur à
 * brancher pour voir le cockpit vivre.
 */
export async function loadDemoScenarioAction(scenarioId: string): Promise<DemoResult> {
  const ctx = await getEditorContext();
  if (!ctx || ctx.role !== "admin") {
    return { ok: false, reason: "forbidden" };
  }
  if (!DEMO_SCENARIO_IDS.includes(scenarioId)) {
    return { ok: false, reason: "unknown_scenario" };
  }

  const admin = createAdminClient();
  try {
    const { prospects, created, analysis } =
      await loadAndAnalyzeDemoScenario(admin, {
        orgId: ctx.orgId,
        actorId: ctx.userId,
        scenarioId,
      });

    revalidateCockpit();
    return { ok: true, prospects, created, analysis };
  } catch (err) {
    if (err instanceof DemoIsolationError) {
      // Le rendu client peut dater d'avant un import ou une synchronisation.
      // Invalider côté serveur complète le verrouillage local immédiat du
      // panneau et garantit que le prochain payload reflète l'inventaire.
      revalidateCockpit();
      return {
        ok: false,
        reason: "unsafe_existing_data",
        detail: detailOf(err),
        categories: err.conflicts.map(
          (conflict) => DEMO_ISOLATION_CONFLICT_LABELS[conflict],
        ),
      };
    }
    if (err instanceof DemoBusyError) {
      return { ok: false, reason: "busy", detail: detailOf(err) };
    }
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
  if (!ctx || ctx.role !== "admin") {
    return { ok: false, reason: "forbidden" };
  }
  const admin = createAdminClient();
  try {
    await withDemoMutationLock(admin, ctx.orgId, "demo", () =>
      clearDemoData(admin, {
        orgId: ctx.orgId,
        actorId: ctx.userId,
      }),
    );
    revalidateCockpit();
    return {
      ok: true,
      prospects: 0,
      created: 0,
      analysis: {
        prospects: { ok: true, created: 0 },
        campaigns: { ok: true, created: 0 },
      },
    };
  } catch (err) {
    if (err instanceof DemoBusyError) {
      return { ok: false, reason: "busy", detail: detailOf(err) };
    }
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
