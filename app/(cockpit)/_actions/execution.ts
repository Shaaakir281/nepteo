"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEditorContext } from "@/lib/auth/context";
import { executeApprovedAction, type ExecutionResult } from "@/lib/execution";
import { changeExecutionControl } from "@/lib/execution-controls";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Exécute une action validée (Phase 3, mode sûr) : prépare les messages dans la
 * boîte d'envoi, sans envoi externe. Toute la mécanique (idempotence, garde-fous,
 * bouton d'arrêt, journal) vit dans `executeApprovedAction`.
 */
export async function executeAction(id: string): Promise<ExecutionResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };
  const admin = createAdminClient();
  const res = await executeApprovedAction(admin, ctx.orgId, ctx.userId, id);
  revalidatePath("/");
  return res;
}

/** Variante form (bouton « Exécuter » sur une action validée). */
export async function executeActionForm(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await executeAction(id);
}

/** Bascule le bouton d'arrêt de l'organisation (bloque/débloque l'exécution). */
export async function toggleExecutionPause(paused: boolean): Promise<void> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) redirect("/login");
  const admin = createAdminClient();
  await changeExecutionControl(
    admin,
    ctx.orgId,
    ctx.userId,
    "pause",
    paused,
  );

  revalidatePath("/");
}
