/** Mémoire entreprise — options issues de l'onboarding validé (maquettes). */

export const MEMORY_SECTIONS = [
  "activite",
  "zone",
  "canaux",
  "ton",
  "objectifs",
  "offres",
] as const;
export type MemorySection = (typeof MEMORY_SECTIONS)[number];

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
}

export const EDIT_ROLES = ["admin", "marketing", "direction"];
