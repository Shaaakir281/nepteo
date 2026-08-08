import type { createAdminClient } from "@/lib/supabase/admin";
import {
  matchesRelaunchTarget,
  selectDormantProspects,
} from "@/lib/analysis-rules";
import { draftRelance, isRelanceKind } from "@/lib/draft";
import { applyFirstName, type Draft } from "@/lib/draft-template";
import {
  DemoBusyError,
  withDemoMutationLock,
} from "@/lib/demo/lock";
import { LLM_MEMORY_SECTIONS } from "@/lib/memory";
import { readMemory } from "@/lib/memory-store";
import {
  planRecipients,
  readExecutionClaim,
} from "@/lib/execution-rules";
import { canonicalizeProspectCohort } from "@/lib/prospect-cohort-loader";
import { loadRelaunchProspects } from "@/lib/relaunch-prospect-loader";
import { restrictCanonicalCohortToSnapshot } from "@/lib/relaunch-snapshot";

type Admin = ReturnType<typeof createAdminClient>;

export type ExecutionResult =
  | {
      ok: true;
      prepared: number;
      skippedNoEmail: number;
      capped: boolean;
    }
  | { ok: false; reason: string };

/** Début du jour (UTC) — pour le plafond quotidien. */
function startOfDayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Finalise le claim et son journal de résultat dans la même transaction. */
async function finishExecution(
  admin: Admin,
  orgId: string,
  actorId: string,
  actionId: string,
  idempotencyKey: string,
  outcome: "succeeded" | "failed",
  payload: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await admin.rpc("finish_action_execution", {
    p_organization_id: orgId,
    p_action_id: actionId,
    p_actor_id: actorId,
    p_idempotency_key: idempotencyKey,
    p_outcome: outcome,
    p_payload: payload,
  });
  return (
    !error &&
    Boolean(data) &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>).finished === true
  );
}

/**
 * Exécute une action VALIDÉE, en mode sûr (Phase 3, étape A) : prépare un message
 * par destinataire dans la boîte d'envoi (`outbox_messages`, statut 'prepared'),
 * SANS envoi externe. Non négociables respectés : bouton d'arrêt (pause org),
 * idempotence (clé + journal AVANT préparation, upsert anti-doublon), garde-fous
 * serveur (plafonds run/jour). L'envoi réel (SMTP) se branchera ici, étape B.
 */
async function executeApprovedActionUnderLock(
  admin: Admin,
  orgId: string,
  actorId: string,
  actionId: string,
): Promise<ExecutionResult> {
  // La RPC verrouille l'organisation, vérifie pause + autonomie, revendique
  // l'action et journalise le départ dans une seule transaction.
  const idem = `exec:${actionId}`;
  const { data: claimData, error: claimError } = await admin.rpc(
    "claim_action_execution",
    {
      p_organization_id: orgId,
      p_action_id: actionId,
      p_actor_id: actorId,
      p_idempotency_key: idem,
    },
  );

  if (claimError) {
    return { ok: false, reason: "claim_failed_recovery_required" };
  }
  const claim = readExecutionClaim(claimData);
  if (!claim) {
    return { ok: false, reason: "claim_state_unavailable_recovery_required" };
  }
  if (!claim.claimed) return { ok: false, reason: claim.reason };

  try {
    const claimedAction = claim.action;
    if (!isRelanceKind(claimedAction.kind)) {
      return { ok: false, reason: "not_executable" };
    }
    const payload = (claimedAction.payload ?? {}) as Record<string, unknown>;

    const loadedProspects = await loadRelaunchProspects(
      admin,
      orgId,
      payload.demo === true,
    );
    if (!loadedProspects.ok) {
      return {
        ok: false,
        reason:
          loadedProspects.reason === "base_too_large"
            ? "prospects_base_too_large_recovery_required"
            : "prospects_read_failed_recovery_required",
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    // Canonicaliser AVANT le snapshot conserve les signaux de sécurité portés
    // par un autre doublon (DNC, terminal ou conflit de statuts actifs).
    const rawProspectRows = loadedProspects.prospects;
    let currentCohortRows = canonicalizeProspectCohort(rawProspectRows);

    // Depuis 0020, l'approbation fige la cohorte. L'exécution préparatoire ne
    // peut viser que son intersection avec les faits encore sûrs aujourd'hui :
    // ni dérive vers un nouveau prospect, ni contournement d'un statut terminal.
    const { data: targetSnapshot, error: targetSnapshotError } = await admin
      .from("action_target_snapshots")
      .select("action_id")
      .eq("organization_id", orgId)
      .eq("action_id", actionId)
      .maybeSingle();
    if (targetSnapshotError) {
      return {
        ok: false,
        reason: "target_snapshot_read_failed_recovery_required",
      };
    }
    if (!targetSnapshot && claimedAction.kind === "relaunch_dormant") {
      return {
        ok: false,
        reason: "target_snapshot_missing_recovery_required",
      };
    }

    if (targetSnapshot) {
      const { data: targetMembers, error: targetMembersError } = await admin
        .from("action_target_snapshot_members")
        .select("prospect_id")
        .eq("organization_id", orgId)
        .eq("action_id", actionId)
        .limit(50);
      if (targetMembersError || !targetMembers) {
        return {
          ok: false,
          reason: "target_snapshot_members_read_failed_recovery_required",
        };
      }
      const memberIds = new Set(
        targetMembers.map((member) => member.prospect_id as string),
      );
      currentCohortRows = restrictCanonicalCohortToSnapshot(
        currentCohortRows,
        rawProspectRows,
        memberIds,
      );
    }

    const targeted =
      claimedAction.kind === "relaunch_dormant"
        ? selectDormantProspects(
            currentCohortRows,
            today,
            typeof payload.min_silence_days === "number"
              ? payload.min_silence_days
              : Number.NaN,
          )
        : currentCohortRows.filter((prospect) =>
            matchesRelaunchTarget(
              claimedAction.kind,
              payload,
              prospect,
              today,
            ),
          );

    const { count: sentToday, error: countError } = await admin
      .from("outbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", startOfDayISO());
    if (countError || sentToday === null) {
      return {
        ok: false,
        reason: "outbox_count_failed_recovery_required",
      };
    }

    const { recipients, skippedNoEmail, capped } = planRecipients(targeted, {
      sentToday,
    });

    // Brouillon de base (groupe) : réutilisé, généré une fois si absent.
    const drafts = (payload.prospect_drafts ?? {}) as Record<string, Draft>;
    let base = payload.draft as Draft | undefined;
    if (!base) {
      const memCtx = await readMemory(admin, LLM_MEMORY_SECTIONS, orgId);
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

    const finished = await finishExecution(
      admin,
      orgId,
      actorId,
      actionId,
      idem,
      "succeeded",
      {
        prepared: messages.length,
        skipped_no_email: skippedNoEmail,
        capped,
      },
    );
    if (!finished) {
      return {
        ok: false,
        reason: "execution_finalize_failed_recovery_required",
      };
    }

    return { ok: true, prepared: messages.length, skippedNoEmail, capped };
  } catch (e) {
    const failureRecorded = await finishExecution(
      admin,
      orgId,
      actorId,
      actionId,
      idem,
      "failed",
      { message: e instanceof Error ? e.message : String(e) },
    );
    if (!failureRecorded) {
      return {
        ok: false,
        reason: "execution_failure_record_failed_recovery_required",
      };
    }
    return { ok: false, reason: "execution_failed" };
  }
}

/**
 * Le même verrou distribué que les synchronisations couvre le claim, toute la
 * lecture paginée et la finalisation. Une sync ne peut donc pas déplacer une
 * ligne entre deux pages pendant la décision de sécurité.
 */
export async function executeApprovedAction(
  admin: Admin,
  orgId: string,
  actorId: string | null,
  actionId: string,
): Promise<ExecutionResult> {
  if (!actorId) return { ok: false, reason: "actor_required" };

  try {
    return await withDemoMutationLock(admin, orgId, "data", () =>
      executeApprovedActionUnderLock(admin, orgId, actorId, actionId),
    );
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof DemoBusyError
          ? "busy"
          : "execution_lock_failed_recovery_required",
    };
  }
}
