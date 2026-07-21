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
}

/**
 * Regroupe par email normalisé (minuscules, espaces retirés). La 1re ligne
 * rencontrée sert de base — la plus récente si l'entrée est triée par
 * `synced_at` décroissant — et ses champs vides sont complétés par les doublons
 * suivants (aucune donnée inventée). Les lignes SANS email ne sont pas
 * dédupliquables de façon fiable : elles sont conservées telles quelles.
 * L'entrée d'origine n'est jamais mutée.
 */
export function dedupeByEmail<T extends DedupProspect>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  const out: T[] = [];
  for (const p of rows) {
    const key = (p.email ?? "").trim().toLowerCase();
    if (!key) {
      out.push(p); // sans email : gardée telle quelle
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
    }
  }
  return out;
}
