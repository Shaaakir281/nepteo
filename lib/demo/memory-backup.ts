import {
  DEMO_BACKUP_SECTION,
  buildDemoBackup,
  legacyOriginalOrgName,
  parseDemoBackup,
  planMemoryRestore,
  type MemoryRow,
} from "@/lib/demo/memory-backup-rules";
import { ensureOk, type Admin } from "@/lib/demo/db";

/**
 * Mise à l'abri et restitution de la **vraie** fiche entreprise pendant une
 * démonstration (chantier B1, docs/projets/demo-isolation.md).
 *
 * Charger un scénario écrase les huit sections de `company_memory` ainsi que le
 * nom et l'activité de l'organisation. Ce fichier est la contrepartie : il
 * range la fiche d'origine dans une section réservée avant l'écrasement, et la
 * rend au retrait des données de démonstration.
 *
 * Ici, uniquement l'I/O Supabase — la logique vit dans `memory-backup-rules.ts`
 * (fichier pur, testé par `node:test`).
 */

/** Sections réelles + fiche d'organisation, telles qu'elles sont en base. */
async function readMemoryRows(admin: Admin, orgId: string): Promise<MemoryRow[]> {
  const { data, error } = await admin
    .from("company_memory")
    .select("section, content")
    .eq("organization_id", orgId);
  ensureOk(error, "lecture de la fiche entreprise");
  return (data ?? []) as MemoryRow[];
}

/**
 * Met la vraie fiche entreprise à l'abri **avant** que le scénario ne l'écrase.
 *
 * Deux propriétés à ne pas casser :
 * - **une seule fois** — si une sauvegarde existe déjà, on n'y touche pas.
 *   Sinon, charger le scénario A puis le scénario B sauvegarderait A, et le
 *   retrait rendrait A au lieu de la fiche d'origine.
 * - **bloquante** — si la sauvegarde échoue, le chargement échoue. Mieux vaut
 *   une démonstration qui ne démarre pas qu'une fiche perdue.
 */
export async function backupMemoryOnce(admin: Admin, orgId: string): Promise<void> {
  const rows = await readMemoryRows(admin, orgId);
  if (rows.some((row) => row.section === DEMO_BACKUP_SECTION)) return;

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("name, activity")
    .eq("id", orgId)
    .maybeSingle();
  ensureOk(orgError, "lecture de l'organisation");

  const current = (org ?? {}) as { name?: string | null; activity?: string | null };
  const backup = buildDemoBackup(
    rows,
    { name: current.name ?? null, activity: current.activity ?? null },
    new Date().toISOString(),
  );

  const { error } = await admin.from("company_memory").upsert(
    {
      organization_id: orgId,
      section: DEMO_BACKUP_SECTION,
      content: backup,
      updated_at: backup.saved_at,
    },
    { onConflict: "organization_id,section" },
  );
  ensureOk(error, "sauvegarde de la fiche entreprise");
}

/**
 * Rend la fiche d'origine : réécrit les sections sauvegardées, supprime celles
 * que le scénario avait ajoutées, restaure le nom et l'activité, puis retire la
 * sauvegarde. Renvoie `false` si aucune sauvegarde n'existe (aucun scénario n'a
 * jamais été chargé, ou la fiche a déjà été rendue).
 */
export async function restoreMemory(admin: Admin, orgId: string): Promise<boolean> {
  const rows = await readMemoryRows(admin, orgId);
  const saved = rows.find((row) => row.section === DEMO_BACKUP_SECTION);
  if (!saved) return false;

  const backup = parseDemoBackup(saved.content);
  if (!backup) {
    throw new Error(
      "sauvegarde de la fiche entreprise illisible — restauration refusée",
    );
  }

  const plan = planMemoryRestore(
    backup,
    rows.map((row) => row.section),
  );
  const now = new Date().toISOString();

  if (plan.upserts.length > 0) {
    const { error } = await admin.from("company_memory").upsert(
      plan.upserts.map((u) => ({
        organization_id: orgId,
        section: u.section,
        content: u.content,
        updated_at: now,
      })),
      { onConflict: "organization_id,section" },
    );
    ensureOk(error, "restauration de la fiche entreprise");
  }

  if (plan.deletes.length > 0) {
    const { error } = await admin
      .from("company_memory")
      .delete()
      .eq("organization_id", orgId)
      .in("section", plan.deletes);
    ensureOk(error, "retrait des sections de démonstration");
  }

  // `organizations.name` est obligatoire : on ne le réécrit que si la
  // sauvegarde en porte un.
  const orgUpdate: { name?: string; activity: string | null } = {
    activity: backup.org.activity,
  };
  if (backup.org.name) orgUpdate.name = backup.org.name;
  const { error: orgError } = await admin
    .from("organizations")
    .update(orgUpdate)
    .eq("id", orgId);
  ensureOk(orgError, "restauration du nom de l'entreprise");

  // En dernier : tant que la sauvegarde est là, un nouveau retrait peut réessayer.
  const { error: dropError } = await admin
    .from("company_memory")
    .delete()
    .eq("organization_id", orgId)
    .eq("section", DEMO_BACKUP_SECTION);
  ensureOk(dropError, "retrait de la sauvegarde");

  return true;
}

/**
 * Cas de transition : un scénario a pu être chargé avant B1, donc avant que
 * `__demo_backup` existe. Les sections et l'activité d'origine ne sont plus
 * reconstructibles, mais le journal append-only porte encore le nom saisi à la
 * création. La règle pure refuse toute restauration si le nom courant ne
 * correspond pas exactement au dernier scénario chargé.
 */
export async function restoreLegacyOrganizationName(
  admin: Admin,
  orgId: string,
): Promise<boolean> {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  ensureOk(orgError, "lecture du nom actuel de l'entreprise");

  const { data: created, error: createdError } = await admin
    .from("journal")
    .select("payload")
    .eq("organization_id", orgId)
    .eq("event", "organization_created")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ensureOk(createdError, "lecture du nom d'origine de l'entreprise");

  const { data: loaded, error: loadedError } = await admin
    .from("journal")
    .select("payload")
    .eq("organization_id", orgId)
    .eq("event", "demo_scenario_loaded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  ensureOk(loadedError, "lecture du dernier scénario de démonstration");

  const original = legacyOriginalOrgName(
    org?.name,
    created?.payload,
    loaded?.payload,
  );
  if (!original) return false;

  const { error } = await admin
    .from("organizations")
    .update({ name: original })
    .eq("id", orgId);
  ensureOk(error, "restauration du nom historique de l'entreprise");
  return true;
}
