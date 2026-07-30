export interface NormalizedProspect {
  external_id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  notes: string | null;
  last_contact_at: string | null;
  raw: Record<string, unknown>;
}

/** Champs cibles de Nepteo. Les valeurs sont les identifiants côté source
 *  (en-tête de colonne pour Sheets, clé de propriété pour Notion).
 *  `null` = « ce champ n'existe pas dans ma base » (choix explicite).
 *  L'absence de mapping = détection automatique (comportement par défaut). */
export const PROSPECT_FIELDS = [
  "name",
  "email",
  "company",
  "stage",
  "notes",
  "last_contact_at",
] as const;
export type ProspectField = (typeof PROSPECT_FIELDS)[number];
export type FieldMapping = Partial<Record<ProspectField, string | null>>;

export const OAUTH_PROVIDERS = ["google_sheets", "notion"] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOauthProvider(p: string): p is OauthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(p);
}

export const IMPORT_PROVIDERS = ["csv"] as const;
export type ImportProvider = (typeof IMPORT_PROVIDERS)[number];

export function isImportProvider(p: string): p is ImportProvider {
  return (IMPORT_PROVIDERS as readonly string[]).includes(p);
}

/**
 * Détection commune aux sources tabulaires (Google Sheets et CSV).
 *
 * La correspondance explicite reste prioritaire dans les connecteurs qui la
 * proposent. Cette fonction fournit un démarrage sûr pour les exports aux
 * en-têtes français ou anglais les plus courants. Une colonne ne peut alimenter
 * qu'un seul champ : « Email du contact » ne devient jamais aussi un nom.
 */
export function autoDetectTabularMapping(headers: string[]): FieldMapping {
  const used = new Set<string>();
  const take = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const header = headers.find(
        (candidate) =>
          candidate.length > 0 &&
          !used.has(candidate) &&
          pattern.test(candidate),
      );
      if (header) {
        used.add(header);
        return header;
      }
    }
    return null;
  };

  // Les champs spécifiques passent avant le nom, dont le repli « contact » est
  // volontairement large pour les feuilles historiques.
  const email = take([/^e-?mail$|^courriel$/i, /e-?mail/i, /courriel/i]);
  const company = take([
    /^entreprise$|^soci[eé]t[eé]$|^company$|^organisation$/i,
    /entreprise/i,
    /soci[eé]t[eé]/i,
    /company/i,
    /organisation/i,
  ]);
  const stage = take([
    /^statut$|^status$|^stage$|^[ée]tape$/i,
    /statut/i,
    /status/i,
    /stage/i,
    /[ée]tape/i,
  ]);
  const lastContact = take([
    /^dernier\s+contact$/i,
    /^derni[eè]re\s+relance$/i,
    /^last\s+contact$/i,
    /date.*contact|contact.*date/i,
    /relance/i,
    /^date$/i,
  ]);
  const notes = take([
    /^notes?$/i,
    /^remarques?$/i,
    /^commentaires?$/i,
    /notes?/i,
    /remarque/i,
    /commentaire/i,
    /comment/i,
  ]);
  const name = take([
    /^nom$|^name$/i,
    /^nom\s+(du\s+)?contact$/i,
    /^contact$/i,
    /nom/i,
    /name/i,
    /contact/i,
  ]);

  return {
    name,
    email,
    company,
    stage,
    notes,
    last_contact_at: lastContact,
  };
}
