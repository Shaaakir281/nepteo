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
  connector_authorized: "Accès connecteur autorisé",
  connector_connected: "Connecteur connecté",
  connector_configured: "Connecteur configuré",
  connector_synced: "Synchronisation effectuée",
  connector_disconnected: "Connecteur déconnecté",
  connector_sync_failed: "Synchronisation échouée",
  connector_paused: "Lecture connecteur mise en pause",
  connector_resumed: "Lecture connecteur reprise",
  meta_ads_accounts_listed: "Comptes Meta Ads lus",
  meta_ads_account_selected: "Compte Meta Ads sélectionné",
  meta_ads_metrics_read: "Métriques Meta Ads lues",
  meta_ads_metrics_snapshot_applied: "Photographie Meta Ads appliquée",
  meta_ads_metrics_sync_failed: "Photographie Meta Ads non appliquée",
  meta_ads_read_failed: "Lecture Meta Ads échouée",
  meta_ads_pilot_access_requested: "Accès pilote Meta Ads demandé",
  meta_ads_pilot_access_ready: "Accès pilote Meta Ads prêt",
  meta_ads_pilot_access_connected: "Accès pilote Meta Ads finalisé",
  analysis_run: "Analyse lancée",
  dormant_play_proposed: "Relance dormante proposée",
  action_proposed: "Action proposée",
  action_proposal_upgraded: "Proposition mise à niveau",
  action_history_adopted: "Historique de décision repris",
  action_approved: "Action validée",
  action_rejected: "Action refusée",
  action_postponed: "Action reportée",
  action_resumed: "Action remise dans la file",
  draft_prepared: "Brouillon de message préparé",
  draft_edited: "Brouillon de message modifié",
  prospect_note_saved: "Note sur un prospect enregistrée",
  execution_started: "Exécution démarrée",
  execution_succeeded: "Exécution réussie",
  execution_failed: "Exécution échouée",
  execution_blocked: "Exécution bloquée",
  execution_pause_changed: "Bouton d'arrêt basculé",
  ads_demo_loaded: "Données d'exemple Meta Ads chargées",
  autonomy_changed: "Niveau d'autonomie modifié",
  campaign_waiting: "Campagne mise en attente",
  creative_brief_generated: "Brief créatif généré",
  creative_image_requested: "Création visuelle demandée",
  creative_image_generated: "Visuel généré",
  creative_image_selected: "Version visuelle retenue",
  creative_image_validated: "Visuel de campagne validé",
  creative_image_failed: "Création visuelle échouée",
  revenue_demo_loaded: "Revenu d'exemple chargé",
  research_started: "Recherche web lancée",
  research_succeeded: "Recherche web aboutie",
  research_failed: "Recherche web échouée",
  research_blocked: "Recherche web bloquée",
  identity_proposed: "Identité proposée par l'agent",
  website_preview_applied: "Analyse web appliquée à la fiche",
  demo_scenario_loaded: "Scénario d'exemple Nepteo chargé",
  demo_scenario_cleared: "Scénario Nepteo retiré",
  demo_scenario_clear_failed: "Retrait du scénario Nepteo échoué",
  value_event_recorded: "Retour terrain enregistré",
};

/** Libellé client du type technique, sans jamais masquer un type inconnu. */
export function journalEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

const SECTION_LABELS: Record<string, string> = {
  activite: "Activité",
  zone: "Zone",
  canaux: "Canaux",
  ton: "Ton",
  objectifs: "Objectifs",
  offres: "Offres",
  philosophie: "Philosophie",
  presence: "Communication actuelle",
};

export function entryTitle(e: JournalEntry): string {
  return journalEventLabel(e.event);
}

export function entryDetail(e: JournalEntry): string | null {
  const p = e.payload ?? {};
  if (typeof p.section === "string") {
    return `Section « ${SECTION_LABELS[p.section] ?? p.section} »`;
  }
  if (typeof p.title === "string") return p.title;
  if (typeof p.name === "string") {
    return typeof p.count === "number"
      ? `${p.name} — ${p.count} prospect${p.count > 1 ? "s" : ""}`
      : p.name;
  }
  // En dernier : la raison d'un échec. Écrite depuis toujours dans le payload,
  // elle n'était affichée nulle part — un journal qui dit « échoué » sans dire
  // pourquoi ne sert à personne.
  if (typeof p.error === "string" && p.error.trim()) return p.error;
  return null;
}

export function entrySource(e: JournalEntry): string {
  return e.actor === "agent" ? "Agent Nepteo" : "Par vous ou votre équipe";
}
