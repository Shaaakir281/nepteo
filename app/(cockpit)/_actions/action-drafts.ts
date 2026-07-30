"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/auth/context";
import {
  draftRelance,
  draftRelanceForProspect,
  isRelanceKind,
  type Draft,
} from "@/lib/draft";
import { applyFirstName } from "@/lib/draft-template";
import { LLM_MEMORY_SECTIONS } from "@/lib/memory";
import { readMemory } from "@/lib/memory-store";
import { researchProspectCompany } from "@/lib/research/prospect-company";
import { isDemoModeActive } from "@/lib/demo/isolation";
import type { DraftResult } from "../actions";

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

  const memCtx = await readMemory(admin, LLM_MEMORY_SECTIONS, ctx.orgId);

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
 * Brouillon personnalisé pour UN prospect d'une action de relance — s'appuie sur
 * ses notes et toutes ses colonnes. Idempotent (cache dans
 * `payload.prospect_drafts[prospectId]`). Phase 2 : prépare, n'envoie rien.
 *
 * `enrich` déclenche en plus une recherche web sur la SOCIÉTÉ du prospect
 * (jamais sur la personne — cf. docs/DECISIONS.md). C'est un appel payant :
 * il reste explicite, jamais automatique. Un échec de recherche est silencieux,
 * le brouillon est simplement produit sans ce contexte.
 */
export async function draftForProspect(
  actionId: string,
  prospectId: string,
  regenerate = false,
  enrich = false,
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

  const memCtx = await readMemory(admin, LLM_MEMORY_SECTIONS, ctx.orgId);

  // Notes de la source + note interne Nepteo réunies pour la personnalisation.
  const notes = [prospect.notes, prospect.note_internal]
    .map((n) => (n ?? "").trim())
    .filter(Boolean)
    .join(" — ");

  // Contexte société : uniquement sur demande explicite (appel facturé).
  let research: string | null = null;
  const demo = await isDemoModeActive(admin, ctx.orgId);
  if (enrich && !demo && prospect.company) {
    const found = await researchProspectCompany(admin, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      company: prospect.company,
    });
    if (found.ok) research = found.summary;
  }

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
      research,
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
