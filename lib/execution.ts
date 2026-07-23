import type { createAdminClient } from "@/lib/supabase/admin";
import { prospectPriority } from "@/lib/analysis-rules";
import { draftRelance, isRelanceKind } from "@/lib/draft";
import { applyFirstName, type Draft } from "@/lib/draft-template";
import { guardExecution, planRecipients } from "@/lib/execution-rules";

type Admin = ReturnType<typeof createAdminClient>;

export type ExecutionResult =
  | {
      ok: true;
      prepared: number;
      skippedNoEmail: number;
      capped: boolean;
    }
  | { ok: false; reason: string };

type ProspectRow = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
};

function isRecipient(
  kind: string,
  payload: Record<string, unknown>,
  p: ProspectRow,
): boolean {
  if (kind === "relaunch_priority") {
    return prospectPriority(p).tier === "priority";
  }
  if (kind.startsWith("relaunch_stage_")) {
    const stage = ((payload.stage as string) ?? "").trim();
    return (p.stage ?? "").trim() === stage;
  }
  return false;
}

/** Début du jour (UTC) — pour le plafond quotidien. */
function startOfDayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Exécute une action VALIDÉE, en mode sûr (Phase 3, étape A) : prépare un message
 * par destinataire dans la boîte d'envoi (`outbox_messages`, statut 'prepared'),
 * SANS envoi externe. Non négociables respectés : bouton d'arrêt (pause org),
 * idempotence (clé + journal AVANT préparation, upsert anti-doublon), garde-fous
 * serveur (plafonds run/jour). L'envoi réel (SMTP) se branchera ici, étape B.
 */
export async function executeApprovedAction(
  admin: Admin,
  orgId: string,
  actorId: string | null,
  actionId: string,
): Promise<ExecutionResult> {
  const { data: action } = await admin
    .from("actions")
    .select("id, kind, status, payload")
    .eq("id", actionId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!action) return { ok: false, reason: "not_found" };
  const adsPause = action.kind.startsWith("ads_pause_");
  if (!isRelanceKind(action.kind) && !adsPause) {
    return { ok: false, reason: "not_executable" };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("execution_paused")
    .eq("id", orgId)
    .maybeSingle();

  const guard = guardExecution({
    status: action.status,
    paused: Boolean(org?.execution_paused),
  });
  if (!guard.ok) {
    await admin.from("journal").insert({
      organization_id: orgId,
      action_id: actionId,
      event: "execution_blocked",
      actor: "user",
      actor_id: actorId,
      payload: { reason: guard.reason },
    });
    return { ok: false, reason: guard.reason };
  }

  // Idempotence + journal AVANT toute préparation (non négociable).
  const idem = `exec:${actionId}`;
  await admin.from("actions").update({ idempotency_key: idem }).eq("id", actionId);
  await admin.from("journal").insert({
    organization_id: orgId,
    action_id: actionId,
    event: "execution_started",
    actor: "user",
    actor_id: actorId,
    payload: { idempotency_key: idem },
  });

  try {
    const payload = (action.payload ?? {}) as Record<string, unknown>;

    // Action ads (couper une campagne) — mode sûr : on ENREGISTRE le changement
    // voulu (journalisé), AUCUN appel externe. L'API Meta réelle viendra ici.
    if (adsPause) {
      await admin.from("actions").update({ status: "executed" }).eq("id", actionId);
      await admin.from("journal").insert({
        organization_id: orgId,
        action_id: actionId,
        event: "execution_succeeded",
        actor: "user",
        actor_id: actorId,
        payload: {
          intended: "pause_campaign",
          campaign_name: payload.campaign_name ?? null,
          provider: payload.provider ?? "meta_ads",
          note: "mode sûr — changement préparé, non appliqué",
        },
      });
      return { ok: true, prepared: 1, skippedNoEmail: 0, capped: false };
    }

    const { data: rows } = await admin
      .from("prospects")
      .select("id, name, email, company, stage")
      .eq("organization_id", orgId);
    const targeted = ((rows ?? []) as ProspectRow[]).filter((p) =>
      isRecipient(action.kind, payload, p),
    );

    const { count: sentToday } = await admin
      .from("outbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", startOfDayISO());

    const { recipients, skippedNoEmail, capped } = planRecipients(targeted, {
      sentToday: sentToday ?? 0,
    });

    // Brouillon de base (groupe) : réutilisé, généré une fois si absent.
    const drafts = (payload.prospect_drafts ?? {}) as Record<string, Draft>;
    let base = payload.draft as Draft | undefined;
    if (!base) {
      const { data: mem } = await admin
        .from("company_memory")
        .select("section, content")
        .eq("organization_id", orgId)
        .in("section", ["activite", "ton", "objectifs", "offres"]);
      const memCtx = Object.fromEntries(
        (mem ?? []).map((m) => [m.section, m.content]),
      );
      base = await draftRelance({
        orgId,
        actorId,
        ctx: memCtx,
        stage: (payload.stage as string | undefined) ?? null,
      });
    }

    const messages = recipients.map((p) => {
      const perProspect = drafts[p.id];
      const msg = perProspect ?? applyFirstName(base!, p.name);
      return {
        organization_id: orgId,
        action_id: actionId,
        prospect_id: p.id,
        to_email: p.email as string,
        subject: msg.subject,
        body: msg.body,
        status: "prepared",
        idempotency_key: `${idem}:${p.id}`,
      };
    });

    if (messages.length > 0) {
      const { error } = await admin
        .from("outbox_messages")
        .upsert(messages, {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        });
      if (error) throw new Error(error.message);
    }

    await admin.from("actions").update({ status: "executed" }).eq("id", actionId);
    await admin.from("journal").insert({
      organization_id: orgId,
      action_id: actionId,
      event: "execution_succeeded",
      actor: "user",
      actor_id: actorId,
      payload: { prepared: messages.length, skipped_no_email: skippedNoEmail, capped },
    });

    return { ok: true, prepared: messages.length, skippedNoEmail, capped };
  } catch (e) {
    await admin.from("actions").update({ status: "failed" }).eq("id", actionId);
    await admin.from("journal").insert({
      organization_id: orgId,
      action_id: actionId,
      event: "execution_failed",
      actor: "user",
      actor_id: actorId,
      payload: { message: e instanceof Error ? e.message : String(e) },
    });
    return { ok: false, reason: "execution_failed" };
  }
}
