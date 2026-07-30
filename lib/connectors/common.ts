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
