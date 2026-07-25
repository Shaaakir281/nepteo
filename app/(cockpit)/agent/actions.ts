"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { clearDemoData, loadDemoScenario } from "@/lib/demo/seed";
import { DEMO_SCENARIO_IDS } from "@/lib/demo/scenarios";

const LEVELS = ["suggest", "prepare"] as const;

/** Change le niveau d'autonomie de l'agent (proposer seulement / préparer). */
export async function setAutonomyLevel(level: string): Promise<void> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) redirect("/login");
  if (!(LEVELS as readonly string[]).includes(level)) redirect("/agent");

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
  revalidatePath("/agent");
  revalidatePath("/");
}

/** Toutes les vues qui dépendent des données de démo. */
function revalidateCockpit(): void {
  for (const p of ["/", "/agent", "/prospects", "/campagnes", "/contenu", "/plan", "/entreprise"]) {
    revalidatePath(p);
  }
}

export type DemoResult = { ok: true; prospects: number } | { ok: false; reason: string };

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

  try {
    const result = await loadDemoScenario(createAdminClient(), {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      scenarioId,
    });
    revalidateCockpit();
    return { ok: true, prospects: result.prospects };
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
    return { ok: true, prospects: 0 };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
