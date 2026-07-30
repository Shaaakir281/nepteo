"use server";

import { revalidatePath } from "next/cache";
import { getEditorContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateValueEventInput,
  type ValueEventInput,
} from "@/lib/value-events-rules";

export type RecordValueEventResult =
  | { ok: true; status: "recorded" | "duplicate" }
  | {
      ok: false;
      reason: "forbidden" | "invalid" | "not_found" | "unavailable";
    };

function readRpcResult(value: unknown): {
  recorded: boolean;
  reason: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (typeof result.recorded !== "boolean") return null;
  return {
    recorded: result.recorded,
    reason: typeof result.reason === "string" ? result.reason : null,
  };
}

/**
 * Enregistre une preuve déclarative sur une action.
 *
 * La source est volontairement forcée à `manual` : seul un futur connecteur
 * pourra certifier un événement Gmail ou Microsoft. Cette action n'écrit
 * jamais dans `outbox_messages` et ne change aucun statut d'envoi.
 */
export async function recordValueEvent(
  input: ValueEventInput,
): Promise<RecordValueEventResult> {
  const parsed = validateValueEventInput({ ...input, source: "manual" });
  if (!parsed.ok) return { ok: false, reason: "invalid" };

  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };

  const admin = createAdminClient();
  const { data: action, error: actionError } = await admin
    .from("actions")
    .select("id")
    .eq("id", parsed.value.actionId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (actionError) return { ok: false, reason: "unavailable" };
  if (!action) return { ok: false, reason: "not_found" };

  if (parsed.value.prospectId) {
    const { data: prospect, error: prospectError } = await admin
      .from("prospects")
      .select("id")
      .eq("id", parsed.value.prospectId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();

    if (prospectError) return { ok: false, reason: "unavailable" };
    if (!prospect) return { ok: false, reason: "not_found" };
  }

  const { data, error } = await admin.rpc("record_value_event", {
    p_organization_id: ctx.orgId,
    p_action_id: parsed.value.actionId,
    p_prospect_id: parsed.value.prospectId,
    p_actor_id: ctx.userId,
    p_event_type: parsed.value.eventType,
    p_source: "manual",
    p_false_positive_reason: parsed.value.falsePositiveReason,
    p_edit_level: parsed.value.editLevel,
    p_submission_id: parsed.value.submissionId,
    p_idempotency_key: parsed.value.idempotencyKey,
  });

  if (error) return { ok: false, reason: "unavailable" };
  const result = readRpcResult(data);
  if (!result) return { ok: false, reason: "unavailable" };

  if (!result.recorded && result.reason !== "duplicate") {
    return {
      ok: false,
      reason:
        result.reason === "not_found" ||
        result.reason === "prospect_not_found"
          ? "not_found"
          : "unavailable",
    };
  }

  revalidatePath("/");
  return {
    ok: true,
    status: result.recorded ? "recorded" : "duplicate",
  };
}
