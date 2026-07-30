/**
 * Dédup à l'affichage (Phase 2) — regroupe les lignes partageant le même email,
 * en LECTURE SEULE : n'écrit jamais en base, ne fusionne rien côté données.
 * Sert à ne pas compter deux fois la même personne quand plusieurs connecteurs
 * lisent la même base (ex. Google Sheets + Notion). La fusion réelle des doublons
 * reste une proposition de l'agent (règle dedupe_emails) puis une action Phase 3.
 */

export interface DedupProspect {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  last_contact_at?: string | null;
}

const norm = (s: string | null) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Clé de regroupement d'un prospect :
 *  - email normalisé si présent (clé fiable, prioritaire) ;
 *  - sinon, **secours** nom + entreprise normalisés (fiches sans email) ;
 *  - sinon `null` (ni email ni nom → non dédupliquable, conservée telle quelle).
 * Le secours nom+entreprise est un compromis d'affichage : il peut fusionner
 * deux homonymes de la même société, mais évite les doublons visibles les plus
 * évidents quand plusieurs connecteurs lisent la même base sans email.
 */
function dedupeKey(p: DedupProspect): string | null {
  const email = norm(p.email);
  if (email) return `e:${email}`;
  const name = norm(p.name);
  if (name) return `nc:${name}|${norm(p.company)}`;
  return null;
}

/**
 * Regroupe les prospects par clé (email, sinon nom+entreprise). La 1re ligne
 * rencontrée sert de base — la plus récente si l'entrée est triée par
 * `synced_at` décroissant — et ses champs vides sont complétés par les doublons
 * suivants (aucune donnée inventée). Les fiches sans email NI nom restent telles
 * quelles. L'entrée d'origine n'est jamais mutée.
 */
export function dedupeByEmail<T extends DedupProspect>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  const out: T[] = [];
  for (const p of rows) {
    const key = dedupeKey(p);
    if (!key) {
      out.push(p); // non dédupliquable : gardée telle quelle
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      const copy = { ...p };
      seen.set(key, copy);
      out.push(copy);
    } else {
      existing.name ??= p.name;
      existing.company ??= p.company;
      existing.stage ??= p.stage;
      if (
        p.last_contact_at &&
        (!existing.last_contact_at ||
          p.last_contact_at > existing.last_contact_at)
      ) {
        existing.last_contact_at = p.last_contact_at;
      }
    }
  }
  return out;
}

export interface ProspectKpiSummary<T extends DedupProspect = DedupProspect> {
  dedupedCount: number | null;
  dedupedRows: T[] | null;
  hasData: boolean;
  value: string;
  hint: string;
}

const formatCount = (count: number) => count.toLocaleString("fr-FR");

/**
 * Construit le KPI Prospects et la cohorte dédoublonnée sans jamais présenter
 * une lecture partielle comme un total. `importedRowCount` vient du count exact
 * en base ; les lignes ne sont dédoublonnées que si elles ont toutes été
 * chargées dans la borne.
 */
export function buildProspectKpi<T extends DedupProspect>(
  rows: T[],
  importedRowCount: number | null,
  maxRows: number,
): ProspectKpiSummary<T> {
  // Une erreur de count ne prouve jamais que la base est vide. Dans ce cas,
  // rester côté cockpit évite d'afficher à tort le diagnostic de départ.
  const hasData = importedRowCount === null ? true : importedRowCount > 0;

  if (importedRowCount === null) {
    return {
      dedupedCount: null,
      dedupedRows: null,
      hasData,
      value: "—",
      hint: "décompte dédoublonné indisponible",
    };
  }

  if (importedRowCount > maxRows) {
    return {
      dedupedCount: null,
      dedupedRows: null,
      hasData,
      value: "—",
      hint: `${formatCount(importedRowCount)} lignes importées · décompte dédoublonné suspendu au-delà de ${formatCount(maxRows)}`,
    };
  }

  if (rows.length !== importedRowCount) {
    return {
      dedupedCount: null,
      dedupedRows: null,
      hasData,
      value: "—",
      hint: `${formatCount(importedRowCount)} ligne${importedRowCount > 1 ? "s" : ""} importée${importedRowCount > 1 ? "s" : ""} · décompte dédoublonné indisponible`,
    };
  }

  const dedupedRows = dedupeByEmail(rows);
  const dedupedCount = dedupedRows.length;
  if (dedupedCount === 0) {
    return {
      dedupedCount,
      dedupedRows,
      hasData,
      value: "—",
      hint: "aucune ligne importée",
    };
  }

  return {
    dedupedCount,
    dedupedRows,
    hasData,
    value: formatCount(dedupedCount),
    hint: `fiche${dedupedCount > 1 ? "s" : ""} dédoublonnée${dedupedCount > 1 ? "s" : ""} · ${formatCount(importedRowCount)} ligne${importedRowCount > 1 ? "s" : ""} importée${importedRowCount > 1 ? "s" : ""}`,
  };
}
