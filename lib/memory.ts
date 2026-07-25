/** Mémoire entreprise — options issues de l'onboarding validé (maquettes). */

export const MEMORY_SECTIONS = [
  "activite",
  "zone",
  "canaux",
  "ton",
  "objectifs",
  "offres",
  "philosophie",
] as const;
export type MemorySection = (typeof MEMORY_SECTIONS)[number];

/**
 * Sections lues pour construire le contexte des prompts (relance, brief créatif…).
 * Liste unique : ajouter une section ici suffit à l'exposer à tous les appels LLM,
 * au lieu de répéter un `.in([...])` dans chaque lecteur.
 */
export const LLM_MEMORY_SECTIONS: readonly MemorySection[] = [
  "activite",
  "offres",
  "ton",
  "objectifs",
  "philosophie",
];

export const ACTIVITY_OPTIONS = [
  "Services",
  "Produits",
  "SaaS ou application",
  "E-commerce",
  "Plusieurs activités",
  "Je ne sais pas encore",
] as const;

export const AUDIENCE_OPTIONS = [
  "Particuliers",
  "Entreprises",
  "Les deux",
  "Collectivités ou associations",
] as const;

export const CHANNEL_OPTIONS = [
  "Recommandations",
  "Réseaux sociaux",
  "Publicité",
  "Google",
  "Email",
  "Prospection",
  "Événements",
  "Autre",
] as const;

export const OBJECTIVE_OPTIONS = [
  "Trouver plus de clients",
  "Obtenir plus de rendez-vous",
  "Vendre davantage",
  "Relancer mes prospects",
  "Mieux suivre mes campagnes",
  "Créer du contenu",
  "Fidéliser mes clients",
  "Comprendre ce qui fonctionne",
  "Organiser le travail de mon équipe",
] as const;

export const MAX_OBJECTIVES = 2;

export interface Offer {
  name: string;
  price?: string;
  target?: string;
  promise?: string;
}

export interface MemoryContent {
  activite: { activity_type?: string; audience?: string; description?: string };
  zone: { text?: string };
  canaux: { list?: string[] };
  ton: { text?: string };
  objectifs: { list?: string[] };
  offres: { items?: Offer[] };
  philosophie: { text?: string };
}

/** Texte libre : plus généreux que le ton (500) ou la description (1000). */
export const PHILOSOPHY_MAX = 2000;

/**
 * Nettoie la philosophie saisie : trim, retours à la ligne multiples réduits,
 * bornage à PHILOSOPHY_MAX. Renvoie "" si rien d'exploitable (champ facultatif).
 */
export function normalizePhilosophy(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.slice(0, PHILOSOPHY_MAX);
}

/** Philosophie stockée dans un contexte de mémoire (`{ philosophie: { text } }`). */
export function philosophyText(ctx: Record<string, unknown>): string {
  const section = ctx["philosophie"];
  if (section && typeof section === "object") {
    return normalizePhilosophy((section as { text?: unknown }).text);
  }
  return "";
}

/**
 * Bloc « philosophie » à insérer dans un prompt. Chaîne vide si non renseignée :
 * les prompts existants restent alors strictement identiques (aucune régression).
 */
export function philosophyBlock(ctx: Record<string, unknown>): string {
  const text = philosophyText(ctx);
  if (!text) return "";
  return (
    `Philosophie de l'entreprise — à respecter dans le ton, les engagements ` +
    `et ce qu'elle refuse de promettre :\n${text}\n\n`
  );
}

export const EDIT_ROLES = ["admin", "marketing", "direction"];
