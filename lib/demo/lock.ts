import { ensureOk, type Admin } from "@/lib/demo/db";
import {
  DEMO_LOCK_SECTION,
  type DemoLockContent,
} from "@/lib/demo/isolation-rules";
import { isDemoModeActive } from "@/lib/demo/isolation";

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

async function insertLock(
  admin: Admin,
  orgId: string,
  content: DemoLockContent,
): Promise<string | null> {
  const { data, error } = await admin
    .from("company_memory")
    .insert({
      organization_id: orgId,
      section: DEMO_LOCK_SECTION,
      content,
      updated_at: content.acquired_at,
    })
    .select("id")
    .maybeSingle();

  if (!error && data) return data.id as string;
  // 23505 = unicité (organization_id, section) : un autre propriétaire tient
  // le verrou. Toute autre erreur est une vraie panne et doit rester visible.
  if ((error as { code?: string } | null)?.code === "23505") return null;
  ensureOk(error, "prise du verrou de démonstration");
  throw new Error("Verrou de démonstration non créé.");
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
    const { data, error } = await admin
      .from("company_memory")
      .delete()
      .eq("organization_id", orgId)
      .eq("section", DEMO_LOCK_SECTION)
      .eq("id", lockId)
      .contains("content", { token: content.token })
      .select("id");

    // Ne jamais masquer la cause métier initiale. Sur un succès, en revanche,
    // la libération fait partie du contrat et doit échouer bruyamment. Un verrou
    // orphelin reste volontairement bloquant jusqu'à récupération manuelle.
    if (error || (data ?? []).length !== 1) {
      if (!taskFailed) {
        ensureOk(error, "libération du verrou de démonstration");
        throw new Error("Le verrou de démonstration n'a pas été libéré.");
      }
      console.error(
        "[demo] verrou non libéré après échec ; récupération manuelle vérifiée requise",
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
    if (await isDemoModeActive(admin, orgId)) {
      throw new DemoDataMutationBlockedError();
    }
    return task();
  });
}
