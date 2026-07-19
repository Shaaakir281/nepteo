/** Journal — libellés et helpers d'affichage (append-only en DB). */

export interface JournalEntry {
  id: string;
  event: string;
  actor: "agent" | "user";
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export const EVENT_LABELS: Record<string, string> = {
  organization_created: "Organisation créée",
  memory_updated: "Mémoire entreprise mise à jour",
  connector_requested: "Connecteur demandé",
};

const SECTION_LABELS: Record<string, string> = {
  activite: "Activité",
  zone: "Zone",
  canaux: "Canaux",
  ton: "Ton",
  objectifs: "Objectifs",
  offres: "Offres",
};

export function entryTitle(e: JournalEntry): string {
  return EVENT_LABELS[e.event] ?? e.event;
}

export function entryDetail(e: JournalEntry): string | null {
  const p = e.payload ?? {};
  if (typeof p.section === "string") {
    return `Section « ${SECTION_LABELS[p.section] ?? p.section} »`;
  }
  if (typeof p.name === "string") return p.name;
  return null;
}

export function entrySource(e: JournalEntry): string {
  return e.actor === "agent" ? "Agent Nepteo" : "Par vous ou votre équipe";
}
