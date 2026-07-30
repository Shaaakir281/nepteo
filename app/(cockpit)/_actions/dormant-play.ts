"use server";

import {
  daysSinceContact,
  selectDormantProspects,
  type DormantSilenceDays,
} from "@/lib/analysis-rules";
import { getEditorContext } from "@/lib/auth/context";
import { isDemoModeActive } from "@/lib/demo/isolation";
import { DemoBusyError, withDemoMutationLock } from "@/lib/demo/lock";
import { normalizedEmailKey } from "@/lib/execution-rules";
import { canonicalizeProspectCohort } from "@/lib/prospect-cohort-loader";
import { loadRelaunchProspects } from "@/lib/relaunch-prospect-loader";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

type DormantActionRow = {
  id: string;
  status: string;
  payload: Record<string, unknown> | null;
};

export type DormantPlayResult =
  | { ok: true; status: "created"; count: number }
  | { ok: true; status: "exists"; count: number }
  | { ok: true; status: "empty"; count: 0 }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "invalid_threshold"
        | "busy"
        | "read_failed"
        | "history_too_large"
        | "base_too_large"
        | "write_failed";
    };

const ACTIVE_DORMANT_STATUSES = ["proposed", "approved", "postponed"];
const SNAPSHOT_PAGE_SIZE = 1_000;
const ACTION_HISTORY_LIMIT = 1_000;
const SNAPSHOT_ACTION_CHUNK = 100;

function isDormantThreshold(value: unknown): value is DormantSilenceDays {
  return value === 30 || value === 45;
}

function positiveCount(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : 0;
}

async function loadDormantActions(
  admin: Admin,
  organizationId: string,
): Promise<
  | { ok: true; actions: DormantActionRow[] }
  | { ok: false; reason: "read_failed" | "history_too_large" }
> {
  const { data, error } = await admin
    .from("actions")
    .select("id, status, payload")
    .eq("organization_id", organizationId)
    .eq("kind", "relaunch_dormant")
    .order("created_at", { ascending: false })
    .limit(ACTION_HISTORY_LIMIT);

  if (error || !data) return { ok: false, reason: "read_failed" };
  if (data.length === ACTION_HISTORY_LIMIT) {
    // Échec fermé : ignorer une ancienne cohorte pourrait recontacter quelqu'un.
    return { ok: false, reason: "history_too_large" };
  }
  return { ok: true, actions: data as DormantActionRow[] };
}

async function loadPriorSnapshotProspectIds(
  admin: Admin,
  organizationId: string,
  actionIds: string[],
): Promise<{ ok: true; ids: Set<string> } | { ok: false }> {
  const ids = new Set<string>();

  for (let start = 0; start < actionIds.length; start += SNAPSHOT_ACTION_CHUNK) {
    const chunk = actionIds.slice(start, start + SNAPSHOT_ACTION_CHUNK);
    let offset = 0;

    while (true) {
      const { data, error } = await admin
        .from("action_target_snapshot_members")
        .select("prospect_id")
        .eq("organization_id", organizationId)
        .in("action_id", chunk)
        .order("prospect_id", { ascending: true })
        .range(offset, offset + SNAPSHOT_PAGE_SIZE - 1);

      if (error || !data) return { ok: false };
      for (const row of data) {
        if (typeof row.prospect_id === "string") ids.add(row.prospect_id);
      }
      if (data.length < SNAPSHOT_PAGE_SIZE) break;
      offset += SNAPSHOT_PAGE_SIZE;
    }
  }

  return { ok: true, ids };
}

/**
 * Prépare un playbook terrain volontairement étroit : l'utilisateur choisit
 * le seuil, puis l'agent crée une proposition à relire. Aucun brouillon n'est
 * envoyé et aucune ligne d'outbox n'est créée à cette étape.
 */
export async function proposeDormantPlay(
  minSilenceDays: number,
): Promise<DormantPlayResult> {
  if (!isDormantThreshold(minSilenceDays)) {
    return { ok: false, reason: "invalid_threshold" };
  }

  const ctx = await getEditorContext();
  if (!ctx || !ctx.canEdit) return { ok: false, reason: "forbidden" };

  const admin = createAdminClient();
  try {
    return await withDemoMutationLock(
      admin,
      ctx.orgId,
      "analysis",
      async (): Promise<DormantPlayResult> => {
        const demo = await isDemoModeActive(admin, ctx.orgId);
        const history = await loadDormantActions(admin, ctx.orgId);
        if (!history.ok) return history;

        const active = history.actions.find((action) =>
          ACTIVE_DORMANT_STATUSES.includes(action.status),
        );
        if (active) {
          return {
            ok: true,
            status: "exists",
            count: positiveCount(active.payload?.count),
          };
        }

        const priorTargets = await loadPriorSnapshotProspectIds(
          admin,
          ctx.orgId,
          history.actions.map((action) => action.id),
        );
        if (!priorTargets.ok) return { ok: false, reason: "read_failed" };

        const loaded = await loadRelaunchProspects(admin, ctx.orgId, demo);
        if (!loaded.ok) return loaded;

        const today = new Date().toISOString().slice(0, 10);
        const priorEmails = new Set(
          loaded.prospects
            .filter((prospect) => priorTargets.ids.has(prospect.id))
            .map((prospect) => normalizedEmailKey(prospect.email))
            .filter((email): email is string => email !== null),
        );
        const uniqueCurrentContacts = canonicalizeProspectCohort(
          loaded.prospects,
        ).filter((prospect) => {
          const email = normalizedEmailKey(prospect.email);
          return (
            !priorTargets.ids.has(prospect.id) &&
            (email === null || !priorEmails.has(email))
          );
        });
        const targets = selectDormantProspects(
          uniqueCurrentContacts,
          today,
          minSilenceDays,
        );

        if (targets.length === 0) {
          return { ok: true, status: "empty", count: 0 };
        }

        const ages = targets
          .map((prospect) =>
            daysSinceContact(prospect.last_contact_at, today),
          )
          .filter((age): age is number => age !== null);
        const oldestContactDays = Math.max(...ages);
        const newestContactDays = Math.min(...ages);
        const sources = [
          ...new Set(
            targets
              .map((prospect) => prospect.source?.trim())
              .filter((source): source is string => Boolean(source)),
          ),
        ];
        const count = targets.length;
        const plural = count > 1 ? "s" : "";
        const payload = {
          play: "dormant",
          min_silence_days: minSilenceDays,
          count,
          proposed_count: count,
          oldest_contact_days: oldestContactDays,
          newest_contact_days: newestContactDays,
          generated_on: today,
          targeting_version: 1,
          ...(demo ? { demo: true } : {}),
        };

        const { data: action, error: actionError } = await admin
          .from("actions")
          .insert({
            organization_id: ctx.orgId,
            kind: "relaunch_dormant",
            title: "Préparer la relance des prospects dormants",
            finding:
              `${count} prospect${plural} actif${plural} et joignable${plural} ` +
              `n'${count > 1 ? "ont" : "a"} pas été contacté${plural} depuis au moins ` +
              `${minSilenceDays} jours.`,
            rationale:
              "La cohorte repose uniquement sur la date du dernier contact, un statut encore actif et une adresse email présente. Chaque message restera à relire et à valider humainement.",
            data_sources: [
              `prospects (${sources.length > 0 ? sources.join(", ") : "source non renseignée"})`,
            ],
            expected_impact:
              `Jusqu'à ${count} brouillon${plural} personnalisable${plural} ` +
              "à examiner, sans envoi automatique",
            confidence: 0.95,
            risk: "low",
            status: "proposed",
            payload,
          })
          .select("id")
          .single();

        if (actionError || !action) {
          return { ok: false, reason: "write_failed" };
        }

        // La proposition reste utile même si l'affichage du journal connaît une
        // panne transitoire ; l'action elle-même est la source de vérité.
        await admin.from("journal").insert({
          organization_id: ctx.orgId,
          action_id: action.id,
          event: "dormant_play_proposed",
          actor: "agent",
          actor_id: ctx.userId,
          payload: {
            title: `Relance dormante · ${minSilenceDays} jours`,
            count,
            min_silence_days: minSilenceDays,
            ...(demo ? { demo: true } : {}),
          },
        });

        return { ok: true, status: "created", count };
      },
    );
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof DemoBusyError ? "busy" : "write_failed",
    };
  }
}
