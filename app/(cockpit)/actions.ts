"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { runAnalysis } from "@/lib/analysis";
import { runAdsAnalysis } from "@/lib/ads/analysis";
import {
  draftRelance,
  draftRelanceForProspect,
  isRelanceKind,
  type Draft,
} from "@/lib/draft";
import { applyFirstName } from "@/lib/draft-template";
import { prospectPriority } from "@/lib/analysis-rules";
import { executeApprovedAction, type ExecutionResult } from "@/lib/execution";

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

export interface TargetProspect {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  note: string | null; // note interne Nepteo (éditable)
  hasNotes: boolean;
  hasDraft: boolean;
}

type ProspectRow = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  notes: string | null;
  note_internal: string | null;
};

/** Prospects ciblés par une action de relance (priorité, ou statut visé). */
function matchesAction(
  kind: string,
  payload: Record<string, unknown>,
  p: ProspectRow,
): boolean {
  if (kind === "relaunch_priority") {
    return prospectPriority(p).tier === "priority";
  }
  if (kind.startsWith("relaunch_stage_")) {
    const stage = (payload.stage as string | undefined) ?? "";
    return (p.stage ?? "").trim() === stage.trim();
  }
  return false;
}

/**
 * Liste les prospects concernés par une action de relance — pour la
 * personnalisation par personne dans le tiroir. Lecture seule.
 */
export async function prospectsForAction(
  id: string,
): Promise<{ ok: boolean; prospects: TargetProspect[] }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, prospects: [] };

  const admin = createAdminClient();
  const { data: action } = await admin
    .from("actions")
    .select("id, kind, payload")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!action || !isRelanceKind(action.kind)) return { ok: false, prospects: [] };

  const { data: rows } = await admin
    .from("prospects")
    .select("id, name, email, company, stage, notes, note_internal")
    .eq("organization_id", ctx.orgId);

  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const drafts = (payload.prospect_drafts ?? {}) as Record<string, unknown>;
  const targeted = ((rows ?? []) as ProspectRow[])
    .filter((p) => matchesAction(action.kind, payload, p))
    .slice(0, 25)
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      company: p.company,
      stage: p.stage,
      note: p.note_internal,
      hasNotes:
        (p.notes ?? "").trim() !== "" || (p.note_internal ?? "").trim() !== "",
      hasDraft: Boolean(drafts[p.id]),
    }));

  return { ok: true, prospects: targeted };
}

/** Enregistre une note interne Nepteo sur un prospect (jamais écrasée au sync). */
export async function saveProspectNote(
  prospectId: string,
  note: string,
): Promise<{ ok: boolean }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("prospects")
    .update({ note_internal: note.trim() || null })
    .eq("id", prospectId)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false };

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "prospect_note_saved",
    actor: "user",
    actor_id: ctx.userId,
    payload: {},
  });
  return { ok: true };
}

/**
 * Brouillon personnalisé pour UN prospect d'une action de relance — s'appuie sur
 * ses notes et toutes ses colonnes. Idempotent (cache dans
 * `payload.prospect_drafts[prospectId]`). Phase 2 : prépare, n'envoie rien.
 */
export async function draftForProspect(
  actionId: string,
  prospectId: string,
  regenerate = false,
): Promise<DraftResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };

  const admin = createAdminClient();
  const { data: action } = await admin
    .from("actions")
    .select("id, kind, title, payload")
    .eq("id", actionId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!action) return { ok: false, reason: "not_found" };
  if (!isRelanceKind(action.kind)) return { ok: false, reason: "not_relance" };

  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const drafts = (payload.prospect_drafts ?? {}) as Record<string, Draft>;
  if (drafts[prospectId] && !regenerate) {
    return { ok: true, draft: drafts[prospectId] };
  }

  const { data: prospect } = await admin
    .from("prospects")
    .select("name, company, stage, notes, note_internal, raw")
    .eq("id", prospectId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!prospect) return { ok: false, reason: "not_found" };

  const { data: mem } = await admin
    .from("company_memory")
    .select("section, content")
    .eq("organization_id", ctx.orgId)
    .in("section", ["activite", "ton", "objectifs", "offres"]);
  const memCtx = Object.fromEntries(
    (mem ?? []).map((m) => [m.section, m.content]),
  );

  // Notes de la source + note interne Nepteo réunies pour la personnalisation.
  const notes = [prospect.notes, prospect.note_internal]
    .map((n) => (n ?? "").trim())
    .filter(Boolean)
    .join(" — ");

  const generated = await draftRelanceForProspect({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    ctx: memCtx,
    prospect: {
      name: prospect.name,
      company: prospect.company,
      stage: prospect.stage,
      notes: notes || null,
      raw: (prospect.raw ?? {}) as Record<string, unknown>,
    },
  });
  // On connaît le destinataire → prénom réel à la place de {prénom}.
  const draft = applyFirstName(generated, prospect.name);

  await admin
    .from("actions")
    .update({
      payload: { ...payload, prospect_drafts: { ...drafts, [prospectId]: draft } },
    })
    .eq("id", action.id);

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "draft_prepared",
    actor: "agent",
    actor_id: ctx.userId,
    payload: { kind: action.kind, title: prospect.name ?? action.title },
  });

  return { ok: true, draft };
}

/**
 * Enregistre les retouches manuelles d'un brouillon (Phase 2) — l'utilisateur
 * reprend la main sur le message de l'agent. Persiste dans `payload.draft`,
 * journalise `draft_edited`. Aucune exécution, aucun envoi.
 */
export async function saveDraftEdit(
  id: string,
  subject: string,
  body: string,
): Promise<DraftResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };

  const cleanSubject = subject.trim();
  const cleanBody = body.trim();
  if (!cleanSubject || cleanBody.length < 10) {
    return { ok: false, reason: "not_found" };
  }

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
  const draft: Draft = { subject: cleanSubject, body: cleanBody };

  await admin
    .from("actions")
    .update({ payload: { ...payload, draft } })
    .eq("id", action.id);

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "draft_edited",
    actor: "user",
    actor_id: ctx.userId,
    payload: { kind: action.kind, title: action.title },
  });

  return { ok: true, draft };
}

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
  await admin
    .from("organizations")
    .update({ execution_paused: paused })
    .eq("id", ctx.orgId);
  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "execution_pause_changed",
    actor: "user",
    actor_id: ctx.userId,
    payload: { paused },
  });
  revalidatePath("/");
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
    let adsCreated = 0;
    try {
      adsCreated = await runAdsAnalysis(admin, ctx.orgId, ctx.userId);
    } catch {
      // l'analyse ads ne doit pas casser l'analyse prospects
    }
    return { ok: true, created: created + adsCreated };
  } catch {
    // l'échec reste visible : aucune nouvelle action en file
    return { ok: false, created: 0 };
  }
}
