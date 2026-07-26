/**
 * Sauvegarde et restauration de la fiche entreprise pendant une démonstration.
 *
 * Fichier **pur** : zéro import, même relatif (règle 6 — `node:test` fait du
 * type-stripping). Toute l'I/O Supabase vit dans `lib/demo/seed.ts`.
 *
 * Pourquoi ça existe : charger un scénario de démo **écrase** les sections de
 * `company_memory` et le nom/activité de l'organisation. Sans copie préalable,
 * essayer une entreprise fictive détruisait définitivement la vraie fiche.
 */

/**
 * Section réservée où dort la fiche d'origine pendant la démonstration.
 *
 * Ce n'est PAS une section de produit : elle ne figure pas dans
 * `MEMORY_SECTIONS` (`lib/memory.ts`, fichier pur qu'on ne touche pas) et
 * n'est jamais rendue. C'est une convention de stockage — `company_memory.section`
 * est un `text` sans contrainte de check, donc aucune migration n'est nécessaire.
 *
 * Le préfixe `__` marque la convention : voir `isReservedSection`.
 */
export const DEMO_BACKUP_SECTION = "__demo_backup";

/** Sections techniques, à masquer partout où la fiche est lue ou affichée. */
export function isReservedSection(section: string): boolean {
  return section.startsWith("__");
}

export interface MemoryRow {
  section: string;
  content: unknown;
}

/** Les deux champs d'onboarding, eux aussi écrasés par le chargement d'un scénario. */
export interface BackedUpOrg {
  name: string | null;
  activity: string | null;
}

export interface DemoBackup {
  /** Version de forme — permet d'ignorer proprement une sauvegarde illisible. */
  v: 1;
  saved_at: string;
  org: BackedUpOrg;
  /** Sections réelles au moment de la sauvegarde (section → contenu). */
  sections: Record<string, unknown>;
}

/**
 * Construit la sauvegarde à partir des lignes réelles de `company_memory`.
 * Les sections réservées ne se sauvegardent pas elles-mêmes.
 *
 * Une organisation sans aucune section produit une sauvegarde **vide mais
 * existante** : c'est ce qui permet, au retrait, de supprimer les huit sections
 * du scénario et de retomber sur une fiche vide.
 */
export function buildDemoBackup(
  rows: readonly MemoryRow[],
  org: BackedUpOrg,
  savedAt: string,
): DemoBackup {
  const sections: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row || typeof row.section !== "string") continue;
    if (isReservedSection(row.section)) continue;
    sections[row.section] = row.content ?? {};
  }
  return {
    v: 1,
    saved_at: savedAt,
    org: { name: org.name ?? null, activity: org.activity ?? null },
    sections,
  };
}

/**
 * Relit une sauvegarde stockée. Renvoie `null` si le contenu n'a pas la forme
 * attendue — mieux vaut ne rien restaurer que restaurer n'importe quoi.
 */
export function parseDemoBackup(content: unknown): DemoBackup | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const raw = content as Record<string, unknown>;
  if (raw.v !== 1) return null;

  const sections =
    raw.sections && typeof raw.sections === "object" && !Array.isArray(raw.sections)
      ? (raw.sections as Record<string, unknown>)
      : null;
  if (!sections) return null;

  const orgRaw =
    raw.org && typeof raw.org === "object" && !Array.isArray(raw.org)
      ? (raw.org as Record<string, unknown>)
      : {};

  const clean: Record<string, unknown> = {};
  for (const [section, value] of Object.entries(sections)) {
    if (isReservedSection(section)) continue;
    clean[section] = value ?? {};
  }

  return {
    v: 1,
    saved_at: typeof raw.saved_at === "string" ? raw.saved_at : "",
    org: {
      name: typeof orgRaw.name === "string" ? orgRaw.name : null,
      activity: typeof orgRaw.activity === "string" ? orgRaw.activity : null,
    },
    sections: clean,
  };
}

function payloadName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const name = (payload as Record<string, unknown>).name;
  if (typeof name !== "string") return null;
  const clean = name.trim().slice(0, 80);
  return clean || null;
}

/**
 * Réparation limitée aux scénarios chargés AVANT B1, donc sans sauvegarde.
 *
 * Le journal append-only conserve le nom de création et celui du dernier
 * scénario chargé. On ne rend l'original que si le nom courant est encore
 * exactement celui du scénario : une modification ultérieure de l'utilisateur
 * ne doit jamais être écrasée par cette voie de secours.
 */
export function legacyOriginalOrgName(
  currentName: unknown,
  organizationCreatedPayload: unknown,
  lastDemoLoadedPayload: unknown,
): string | null {
  const current =
    typeof currentName === "string" ? currentName.trim().slice(0, 80) : "";
  const original = payloadName(organizationCreatedPayload);
  const demo = payloadName(lastDemoLoadedPayload);
  if (!current || !original || !demo) return null;
  if (current !== demo || original === current) return null;
  return original;
}

export interface RestorePlan {
  /** Sections à réécrire telles qu'elles étaient. */
  upserts: { section: string; content: unknown }[];
  /** Sections ajoutées par le scénario et absentes de la fiche d'origine. */
  deletes: string[];
}

/**
 * Ce qu'il faut faire pour revenir à la fiche d'origine.
 *
 * La sauvegarde fait foi : tout ce qu'elle contient est réécrit (le scénario a
 * pu modifier le contenu), tout ce qui existe en plus et qu'elle ne connaît pas
 * est supprimé. Les sections réservées ne sont jamais supprimées ici — la
 * sauvegarde elle-même est retirée à part, une fois la restauration réussie.
 */
export function planMemoryRestore(
  backup: DemoBackup,
  currentSections: readonly string[],
): RestorePlan {
  const upserts = Object.entries(backup.sections).map(([section, content]) => ({
    section,
    content: content ?? {},
  }));

  const kept = new Set(Object.keys(backup.sections));
  const seen = new Set<string>();
  const deletes: string[] = [];
  for (const section of currentSections) {
    if (typeof section !== "string") continue;
    if (isReservedSection(section)) continue;
    if (kept.has(section) || seen.has(section)) continue;
    seen.add(section);
    deletes.push(section);
  }

  return { upserts, deletes };
}
