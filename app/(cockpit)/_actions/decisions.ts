"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/auth/context";
import { approveRelaunchWithTargetSnapshot } from "./prospects";

const DECISIONS = ["approve", "reject", "postpone"] as const;

type ActionTransition = (typeof DECISIONS)[number] | "resume";

function transitionChanged(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).changed === true
  );
}

async function transitionAction(
  admin: ReturnType<typeof createAdminClient>,
  ctx: NonNullable<Awaited<ReturnType<typeof getEditorContext>>>,
  actionId: string,
  transition: ActionTransition,
): Promise<boolean> {
  const { data, error } = await admin.rpc("transition_action_decision", {
    p_organization_id: ctx.orgId,
    p_action_id: actionId,
    p_actor_id: ctx.userId,
    p_transition: transition,
  });
  if (error) throw new Error("action_transition_failed");
  return transitionChanged(data);
}

/** Décision sur une action proposée — Phase 2 : aucune exécution. */
export async function decideAction(formData: FormData) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/");

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || !(DECISIONS as readonly string[]).includes(decision)) redirect("/");

  if (decision === "approve") {
    const relaunchApproval = await approveRelaunchWithTargetSnapshot(id);
    if (relaunchApproval.handled) redirect("/");
  }

  const admin = createAdminClient();
  // La RPC effectue le CAS proposed -> décision et l'INSERT journal dans une
  // même transaction : aucun état approuvé ne peut exister sans sa trace.
  const changed = await transitionAction(
    admin,
    ctx,
    id,
    decision as ActionTransition,
  );
  if (!changed) redirect("/");

  redirect("/");
}

/** Remet une action reportée dans la file (statut → proposed). Aucune exécution. */
export async function resumeAction(formData: FormData) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/");

  const admin = createAdminClient();
  const changed = await transitionAction(admin, ctx, id, "resume");
  if (!changed) redirect("/");

  redirect("/");
}
