"use server";

import {
  matchesRelaunchTarget,
  selectDormantProspects,
} from "@/lib/analysis-rules";
import { getEditorContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRelanceKind } from "@/lib/draft";
import {
  dedupeContacts,
  normalizedEmailKey,
} from "@/lib/execution-rules";
import { loadRelaunchProspects } from "@/lib/relaunch-prospect-loader";
import type { TargetProspect } from "../actions";

type RelaunchActionRow = {
  id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown> | null;
};

async function priorDormantProspectIds(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  currentActionId: string,
): Promise<Set<string> | null> {
  const { data: priorActions, error: priorActionsError } = await admin
    .from("actions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("kind", "relaunch_dormant")
    .neq("id", currentActionId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (priorActionsError || !priorActions || priorActions.length === 1000) {
    return null;
  }
  if (priorActions.length === 0) return new Set<string>();

  const prospectIds = new Set<string>();
  const actionIds = priorActions.map((action) => action.id as string);
  for (let start = 0; start < actionIds.length; start += 100) {
    const chunk = actionIds.slice(start, start + 100);
    let offset = 0;
    while (true) {
      const { data: members, error: membersError } = await admin
        .from("action_target_snapshot_members")
        .select("prospect_id")
        .eq("organization_id", organizationId)
        .in("action_id", chunk)
        .order("prospect_id", { ascending: true })
        .range(offset, offset + 999);
      if (membersError || !members) return null;
      for (const member of members) {
        if (typeof member.prospect_id === "string") {
          prospectIds.add(member.prospect_id);
        }
      }
      if (members.length < 1000) break;
      offset += 1000;
    }
  }
  return prospectIds;
}

async function loadRelaunchActionAndProspects(
  id: string,
  organizationId: string,
) {
  const admin = createAdminClient();
  const { data: action, error: actionError } = await admin
    .from("actions")
    .select("id, kind, status, payload")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (actionError || !action || !isRelanceKind(action.kind)) return null;

  const typedAction = action as RelaunchActionRow;
  const payload = typedAction.payload ?? {};
  const loadedProspects = await loadRelaunchProspects(
    admin,
    organizationId,
    payload.demo === true,
  );
  if (!loadedProspects.ok) return null;
  const rows = loadedProspects.prospects;

  const today = new Date().toISOString().slice(0, 10);
  let uniqueCurrentContacts = dedupeContacts(rows);
  if (typedAction.kind === "relaunch_dormant") {
    const priorProspectIds = await priorDormantProspectIds(
      admin,
      organizationId,
      typedAction.id,
    );
    if (!priorProspectIds) return null;
    const priorEmails = new Set(
      rows
        .filter((prospect) => priorProspectIds.has(prospect.id))
        .map((prospect) => normalizedEmailKey(prospect.email))
        .filter((email): email is string => email !== null),
    );
    uniqueCurrentContacts = uniqueCurrentContacts.filter(
      (prospect) => {
        const email = normalizedEmailKey(prospect.email);
        return (
          !priorProspectIds.has(prospect.id) &&
          (email === null || !priorEmails.has(email))
        );
      },
    );
  }
  const currentTargets =
    typedAction.kind === "relaunch_dormant"
      ? selectDormantProspects(
          uniqueCurrentContacts,
          today,
          typeof payload.min_silence_days === "number"
            ? payload.min_silence_days
            : Number.NaN,
        )
      : uniqueCurrentContacts
          .filter((prospect) =>
            matchesRelaunchTarget(typedAction.kind, payload, prospect, today),
          )
          .slice(0, 50);

  return {
    admin,
    action: typedAction,
    payload,
    rows,
    currentTargets,
  };
}

export type RelaunchApprovalResult =
  | { handled: false }
  | { handled: true; changed: boolean };

/**
 * Pour une relance, fige la cohorte et approuve dans la même transaction SQL.
 * Une action d'un autre type est laissée à la RPC de décision générique.
 */
export async function approveRelaunchWithTargetSnapshot(
  id: string,
): Promise<RelaunchApprovalResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { handled: true, changed: false };

  const loaded = await loadRelaunchActionAndProspects(id, ctx.orgId);
  if (!loaded) {
    const admin = createAdminClient();
    const { data: action, error } = await admin
      .from("actions")
      .select("kind")
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (error || !action) return { handled: true, changed: false };
    return isRelanceKind(action.kind)
      ? { handled: true, changed: false }
      : { handled: false };
  }

  const { data, error } = await loaded.admin.rpc(
    "approve_relaunch_action_with_targets",
    {
      p_organization_id: ctx.orgId,
      p_action_id: id,
      p_actor_id: ctx.userId,
      p_prospect_ids: loaded.currentTargets.map((prospect) => prospect.id),
    },
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { handled: true, changed: false };
  }

  return {
    handled: true,
    changed: (data as Record<string, unknown>).changed === true,
  };
}

/**
 * Liste la cible d'une relance pour la personnalisation et la preuve terrain.
 * Avant décision, elle suit les règles courantes. Après approbation, elle vient
 * du snapshot ; les anciennes actions utilisent un fallback opérationnel.
 */
export async function prospectsForAction(
  id: string,
): Promise<{ ok: boolean; prospects: TargetProspect[] }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, prospects: [] };

  const loaded = await loadRelaunchActionAndProspects(id, ctx.orgId);
  if (!loaded) return { ok: false, prospects: [] };
  const { action, admin, currentTargets, payload, rows } = loaded;
  const drafts = (payload.prospect_drafts ?? {}) as Record<string, unknown>;
  let targeted = currentTargets;

  const { data: snapshot, error: snapshotError } = await admin
    .from("action_target_snapshots")
    .select("action_id")
    .eq("action_id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (snapshotError) return { ok: false, prospects: [] };

  if (snapshot) {
    const { data: members, error: membersError } = await admin
      .from("action_target_snapshot_members")
      .select("prospect_id")
      .eq("action_id", id)
      .eq("organization_id", ctx.orgId);
    if (membersError) return { ok: false, prospects: [] };
    const snapshotIds = new Set(
      (members ?? []).map((member) => member.prospect_id as string),
    );
    targeted = rows.filter((prospect) => snapshotIds.has(prospect.id));
  } else if (action.status !== "proposed") {
    // Compatibilité des décisions antérieures à 0020.
    const legacyIds = new Set<string>();
    for (const prospectId of Object.keys(drafts)) legacyIds.add(prospectId);

    const { data: outboxRows } = await admin
      .from("outbox_messages")
      .select("prospect_id")
      .eq("action_id", id)
      .eq("organization_id", ctx.orgId)
      .not("prospect_id", "is", null);
    for (const row of outboxRows ?? []) {
      if (row.prospect_id) legacyIds.add(row.prospect_id as string);
    }

    const { data: eventRows } = await admin
      .from("value_events")
      .select("prospect_id")
      .eq("action_id", id)
      .eq("organization_id", ctx.orgId)
      .not("prospect_id", "is", null);
    for (const row of eventRows ?? []) {
      if (row.prospect_id) legacyIds.add(row.prospect_id as string);
    }

    targeted = dedupeContacts(
      rows.filter((prospect) => legacyIds.has(prospect.id)),
    );
  }

  const prospects = targeted.slice(0, 50).map((prospect) => ({
    id: prospect.id,
    name: prospect.name,
    email: prospect.email,
    company: prospect.company,
    stage: prospect.stage,
    note: prospect.note_internal,
    hasNotes:
      (prospect.notes ?? "").trim() !== "" ||
      (prospect.note_internal ?? "").trim() !== "",
    hasDraft: Boolean(drafts[prospect.id]),
  }));

  return { ok: true, prospects };
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
