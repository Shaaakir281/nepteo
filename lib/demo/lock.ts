import type { Admin } from "./db.ts";
import {
  DEMO_LOCK_SECTION,
  type DemoLockContent,
} from "./isolation-rules.ts";

export type DemoLockPurpose = DemoLockContent["purpose"];

export class DemoBusyError extends Error {
  constructor() {
    super("Une opération concurrente est déjà en cours.");
    this.name = "DemoBusyError";
  }
}

export class DemoDataMutationBlockedError extends Error {
  constructor() {
    super(
      "Retirez d'abord les données de démonstration avant de modifier les données réelles.",
    );
    this.name = "DemoDataMutationBlockedError";
  }
}

type LockQueryAttempt =
  | { completed: true; data: unknown; error: unknown }
  | { completed: false; cause: unknown };

type OwnedLockProbe =
  | { state: "owned"; id: string }
  | { state: "absent" }
  | { state: "unknown"; cause: unknown };

async function captureLockQuery(
  query: () => Promise<{ data: unknown; error: unknown }>,
): Promise<LockQueryAttempt> {
  try {
    const response = await query();
    if (!response || typeof response !== "object") {
      return {
        completed: false,
        cause: new Error("Réponse Supabase absente ou malformée."),
      };
    }
    return {
      completed: true,
      data: response.data,
      error: response.error,
    };
  } catch (cause) {
    return { completed: false, cause };
  }
}

function rowId(row: unknown): string | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const id = (row as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
}

function attemptCause(attempt: LockQueryAttempt): unknown {
  return attempt.completed ? attempt.error : attempt.cause;
}

function reconciliationError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

/**
 * Relit une seule fois la ligne qui porte exactement notre identité de verrou.
 *
 * Ce sondage sert aux deux réponses réseau ambiguës : après l'insert il prouve
 * que nous sommes bien propriétaires avant d'exécuter la tâche ; après le
 * delete il prouve au contraire que notre ligne a disparu. Aucun autre verrou
 * n'est repris ou supprimé.
 */
async function probeOwnedDemoLock(
  admin: Admin,
  orgId: string,
  token: string,
  expectedId?: string,
): Promise<OwnedLockProbe> {
  let query = admin
    .from("company_memory")
    .select("id")
    .eq("organization_id", orgId)
    .eq("section", DEMO_LOCK_SECTION)
    .contains("content", { token });
  if (expectedId) query = query.eq("id", expectedId);

  const attempt = await captureLockQuery(async () => query.limit(2));
  if (!attempt.completed) {
    return { state: "unknown", cause: attempt.cause };
  }
  if (attempt.error !== null) {
    return { state: "unknown", cause: attempt.error };
  }
  if (!Array.isArray(attempt.data)) {
    return {
      state: "unknown",
      cause: new Error("Le sondage du verrou a renvoyé une forme inattendue."),
    };
  }
  if (attempt.data.length === 0) return { state: "absent" };
  if (attempt.data.length !== 1) {
    return {
      state: "unknown",
      cause: new Error("Le sondage du verrou n'est pas univoque."),
    };
  }

  const id = rowId(attempt.data[0]);
  if (!id || (expectedId && id !== expectedId)) {
    return {
      state: "unknown",
      cause: new Error("Le sondage du verrou ne prouve pas son identifiant."),
    };
  }
  return { state: "owned", id };
}

async function insertLock(
  admin: Admin,
  orgId: string,
  content: DemoLockContent,
): Promise<string | null> {
  const attempt = await captureLockQuery(async () =>
    admin
      .from("company_memory")
      .insert({
        organization_id: orgId,
        section: DEMO_LOCK_SECTION,
        content,
        updated_at: content.acquired_at,
      })
      .select("id")
      .maybeSingle(),
  );

  if (attempt.completed && attempt.error === null) {
    const id = rowId(attempt.data);
    if (id) return id;
  }
  // 23505 = unicité (organization_id, section) : un autre propriétaire tient
  // définitivement le verrou. Toute autre réponse peut avoir été perdue après
  // commit : un sondage exact est alors obligatoire avant de continuer.
  if (attempt.completed && errorCode(attempt.error) === "23505") return null;

  const probe = await probeOwnedDemoLock(admin, orgId, content.token);
  if (probe.state === "owned") return probe.id;
  if (probe.state === "unknown") {
    throw reconciliationError(
      "Acquisition du verrou ambiguë : le sondage exact organisation, section et token a échoué.",
      probe.cause,
    );
  }
  throw reconciliationError(
    "Acquisition du verrou non prouvée après une réponse ambiguë : aucun verrou exact n'a été repris.",
    attemptCause(attempt),
  );
}

async function acquireDemoLock(
  admin: Admin,
  orgId: string,
  content: DemoLockContent,
): Promise<string> {
  const freshId = await insertLock(admin, orgId, content);
  if (freshId) return freshId;

  // Échec fermé, même si la ligne paraît ancienne. Sans fencing distribué,
  // supprimer automatiquement ce verrou permettrait à son propriétaire initial
  // de continuer à écrire pendant qu'un concurrent entre en section critique.
  // Une ligne orpheline exige donc une récupération manuelle vérifiée.
  throw new DemoBusyError();
}

async function releaseLock(
  admin: Admin,
  orgId: string,
  lockId: string,
  token: string,
): Promise<void> {
  const attempt = await captureLockQuery(async () =>
    admin
      .from("company_memory")
      .delete()
      .eq("organization_id", orgId)
      .eq("section", DEMO_LOCK_SECTION)
      .eq("id", lockId)
      .contains("content", { token })
      .select("id"),
  );

  const deleteConfirmed =
    attempt.completed &&
    attempt.error === null &&
    Array.isArray(attempt.data) &&
    attempt.data.length === 1 &&
    rowId(attempt.data[0]) === lockId;
  if (deleteConfirmed) return;

  const probe = await probeOwnedDemoLock(admin, orgId, token, lockId);
  if (probe.state === "absent") return;
  if (probe.state === "owned") {
    throw reconciliationError(
      "Libération du verrou non prouvée : notre ligne exacte est encore présente et reste bloquante.",
      attemptCause(attempt),
    );
  }
  throw reconciliationError(
    "Libération du verrou ambiguë : impossible de prouver l'absence de notre ligne exacte.",
    probe.cause,
  );
}

/**
 * Sérialise chargement, changement de scénario, analyse et retrait.
 *
 * La ligne unique `__demo_lock` fonctionne sur plusieurs instances serveur,
 * contrairement à un mutex mémoire. Le token + l'ID empêchent une requête de
 * libérer le verrou d'une autre. Après un crash, aucune reprise automatique
 * n'est tentée : l'absence de fencing impose une récupération manuelle vérifiée.
 */
export async function withDemoMutationLock<T>(
  admin: Admin,
  orgId: string,
  purpose: DemoLockPurpose,
  task: () => Promise<T>,
): Promise<T> {
  const content: DemoLockContent = {
    token: crypto.randomUUID(),
    acquired_at: new Date().toISOString(),
    purpose,
  };
  const lockId = await acquireDemoLock(admin, orgId, content);
  let taskFailed = false;

  try {
    return await task();
  } catch (error) {
    taskFailed = true;
    throw error;
  } finally {
    // Ne jamais masquer la cause métier initiale. Sur un succès, en revanche,
    // la libération fait partie du contrat et doit échouer bruyamment. Un verrou
    // orphelin reste volontairement bloquant jusqu'à récupération manuelle.
    try {
      await releaseLock(admin, orgId, lockId, content.token);
    } catch (error) {
      if (!taskFailed) {
        throw error;
      }
      console.error(
        "[demo] verrou non libéré après échec ; récupération manuelle vérifiée requise",
        error,
      );
    }
  }
}

/**
 * Frontière atomique des écritures réelles.
 *
 * Le verrou est acquis AVANT la lecture du marqueur démo et reste détenu
 * jusqu'à la fin de l'écriture. Une démo ne peut donc plus démarrer entre un
 * `check` favorable et la mutation qui suit.
 */
export async function withRealDataMutationLock<T>(
  admin: Admin,
  orgId: string,
  task: () => Promise<T>,
): Promise<T> {
  return withDemoMutationLock(admin, orgId, "data", async () => {
    // Import tardif pour garder la primitive de verrou testable sans charger
    // l'inventaire complet ; le module reste mis en cache par le runtime.
    const { isDemoModeActive } = await import("@/lib/demo/isolation");
    if (await isDemoModeActive(admin, orgId)) {
      throw new DemoDataMutationBlockedError();
    }
    return task();
  });
}
