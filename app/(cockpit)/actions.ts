"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { runAnalysis } from "@/lib/analysis";
import { draftRelance, isRelanceKind, type Draft } from "@/lib/draft";

const DECISIONS = {
  approve: { status: "approved", event: "action_approved" },
  reject: { status: "rejected", event: "action_rejected" },
  postpone: { status: "postponed", event: "action_postponed" },
} as const;

/** Décision sur une action proposée — Phase 2 : aucune exécution. */
export async function decideAction(formData: FormData) {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/");

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || !(decision in DECISIONS)) redirect("/");
  const d = DECISIONS[decision as keyof typeof DECISIONS];

  const admin = createAdminClient();
  const { data: action } = await admin
    .from("actions")
    .select("id, title, kind, status")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!action || action.status !== "proposed") redirect("/");

  await admin
    .from("actions")
    .update({
      status: d.status,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", action.id);

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: d.event,
    actor: "user",
    actor_id: ctx.userId,
    payload: { kind: action.kind, title: action.title },
  });

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
  const { data: action } = await admin
    .from("actions")
    .select("id, title, kind, status")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!action || action.status !== "postponed") redirect("/");

  await admin
    .from("actions")
    .update({ status: "proposed", decided_by: null, decided_at: null })
    .eq("id", action.id);

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "action_resumed",
    actor: "user",
    actor_id: ctx.userId,
    payload: { kind: action.kind, title: action.title },
  });

  redirect("/");
}

export type DraftResult =
  | { ok: true; draft: Draft }
  | { ok: false; reason: "forbidden" | "not_found" | "not_relance" };

/**
 * Prépare (ou renvoie) le brouillon de relance d'une action — Phase 2 :
 * l'agent RÉDIGE, il n'envoie rien. Idempotent : réutilise `payload.draft`
 * sauf `regenerate`. Appelée directement depuis le tiroir (valeur de retour).
 */
export async function draftForAction(
  id: string,
  regenerate = false,
): Promise<DraftResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };

  const admin = createAdminClient();
  const { data: action } = await admin
    .from("actions")
    .select("id, kind, title, payload")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!action) return { ok: false, reason: "not_found" };
  if (!isRelanceKind(action.kind)) return { ok: false, reason: "not_relance" };

  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const cached = payload.draft as Draft | undefined;
  if (cached && !regenerate) return { ok: true, draft: cached };

  const { data: mem } = await admin
    .from("company_memory")
    .select("section, content")
    .eq("organization_id", ctx.orgId)
    .in("section", ["activite", "ton", "objectifs", "offres"]);
  const memCtx = Object.fromEntries(
    (mem ?? []).map((m) => [m.section, m.content]),
  );

  const draft = await draftRelance({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    ctx: memCtx,
    stage: (payload.stage as string | undefined) ?? null,
  });

  await admin
    .from("actions")
    .update({ payload: { ...payload, draft } })
    .eq("id", action.id);

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "draft_prepared",
    actor: "agent",
    actor_id: ctx.userId,
    payload: { kind: action.kind, title: action.title },
  });

  return { ok: true, draft };
}

/**
 * Lance l'analyse à la demande et **retourne** le nombre de propositions créées
 * (le cron s'en chargera aussi à terme). Valeur de retour → appelée depuis le
 * runner animé (autonomie visible), qui rafraîchit ensuite la vue.
 */
export async function analyzeNow(): Promise<{ ok: boolean; created: number }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, created: 0 };

  const admin = createAdminClient();
  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "analysis_run",
    actor: "user",
    actor_id: ctx.userId,
    payload: {},
  });
  try {
    const created = await runAnalysis(admin, ctx.orgId, ctx.userId);
    return { ok: true, created };
  } catch {
    // l'échec reste visible : aucune nouvelle action en file
    return { ok: false, created: 0 };
  }
}
