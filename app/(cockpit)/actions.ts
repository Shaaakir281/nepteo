"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { runAnalysis } from "@/lib/analysis";

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

/** Lance l'analyse à la demande (le cron s'en chargera aussi à terme). */
export async function runAnalysisNow() {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) redirect("/");

  const admin = createAdminClient();
  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "analysis_run",
    actor: "user",
    actor_id: ctx.userId,
    payload: {},
  });
  try {
    await runAnalysis(admin, ctx.orgId, ctx.userId);
  } catch {
    // l'échec reste visible : aucune nouvelle action en file
  }
  redirect("/");
}
