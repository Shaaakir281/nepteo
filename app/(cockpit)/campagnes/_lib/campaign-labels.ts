import { CAMPAIGN_COCKPIT_CHANNELS, CAMPAIGN_COCKPIT_STATUSES, type CampaignAttempt, type CampaignCockpitChannel, type CampaignCockpitItem, type CampaignCockpitStatus, type CampaignComparisonResult, type ObservedMetricsSource } from "@/lib/campaign-cockpit";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignEvidenceReference } from "../_components/campaign-decision-types";
import type { CampaignSearchParam } from "./campaign-page-constants";

export function datasetEvidence(
  presentation: DemoPresentation,
  provider: ObservedMetricsSource["provider"] = "multiple",
): CampaignEvidenceReference {
  const prefix =
    presentation === "certified-demo"
      ? "Scénario d’exemple Nepteo"
      : presentation === "test-environment"
        ? "Environnement de test"
        : "Métriques enregistrées";
  return { label: `${prefix} · ad_metrics · ${providerLabel(provider)}` };
}

export function attemptOutcome(attempt: CampaignAttempt): string {
  if (attempt.status === "approved" && attempt.kind === "launch_campaign") {
    return "Validée — non lancée";
  }
  if (attempt.status === "approved" && attempt.kind.startsWith("ads_pause_")) {
    return "Validée — non appliquée";
  }
  if (attempt.status === "executed" && attempt.kind.startsWith("ads_pause_")) {
    return "Trace historique — aucune preuve d’application fournisseur";
  }
  const labels: Record<string, string> = {
    approved: "Validée",
    rejected: "Refusée",
    postponed: "Reportée",
    executed: "Préparée",
    failed: "Échec enregistré",
    proposed: "En attente de décision",
  };
  return labels[attempt.status] ?? attempt.status;
}

export function journalEventLabel(event: string): string {
  const labels: Record<string, string> = {
    action_proposed: "Proposition enregistrée",
    action_approved: "Validation enregistrée",
    action_rejected: "Refus enregistré",
    action_postponed: "Report enregistré",
    action_resumed: "Proposition reprise",
    campaign_blocked: "Blocage de campagne enregistré",
    campaign_waiting: "Attente de campagne enregistrée",
    campaign_status_cleared: "État de campagne levé",
  };
  return labels[event] ?? `Événement enregistré · ${event}`;
}

export function unlinkedJournalEventDetail(event: string): string {
  if (event === "campaign_blocked") {
    return "Un blocage CAMP-2 a été journalisé sans action associée.";
  }
  if (event === "campaign_waiting") {
    return "Une attente CAMP-2 a été journalisée sans action associée.";
  }
  if (event === "campaign_status_cleared") {
    return "La levée d’un état CAMP-2 a été journalisée sans action associée.";
  }
  return "Cet événement CAMP-2 est enregistré sans action associée.";
}

export function journalEventDetail(event: string, title: string): string {
  const subject = `« ${title} »`;
  if (event === "action_proposed") {
    return `${subject} a été ajoutée à la file de validation.`;
  }
  if (event === "action_approved") {
    return `Une validation humaine a été enregistrée pour ${subject} ; aucune application fournisseur n’est déduite.`;
  }
  if (event === "action_rejected") {
    return `Un refus humain a été enregistré pour ${subject}.`;
  }
  if (event === "action_postponed") {
    return `Un report humain a été enregistré pour ${subject}.`;
  }
  if (event === "action_resumed") {
    return `${subject} a été replacée dans la file de validation.`;
  }
  return `${subject} possède cet événement journalisé, sans interprétation supplémentaire.`;
}

export function comparisonReason(comparison: CampaignComparisonResult): string {
  if (comparison.status === "available") return "";
  if (comparison.reason === "no_previous_rows") {
    return "Aucune ligne n’est disponible sur la période précédente.";
  }
  if (comparison.reason === "no_current_rows") {
    return "Aucune ligne n’est disponible sur la période courante.";
  }
  return "La comparaison a été désactivée.";
}

export function providerLabel(provider: ObservedMetricsSource["provider"]): string {
  const labels: Record<ObservedMetricsSource["provider"], string> = {
    meta_ads: "Meta Ads déclaré",
    google_ads: "Google Ads déclaré",
    linkedin_ads: "LinkedIn Ads déclaré",
    email: "Email déclaré",
    outbound_email: "Email sortant déclaré",
    multiple: "plusieurs sources déclarées",
  };
  return labels[provider];
}

export function channelLabel(channel: CampaignCockpitItem["channel"]): string {
  return {
    meta: "Meta Ads",
    google: "Google Ads",
    linkedin: "LinkedIn Ads",
    email: "Email",
  }[channel];
}

export function statusLabel(status: CampaignCockpitStatus): string {
  return {
    active: "Active (statut fournisseur)",
    ended: "Terminée (statut fournisseur)",
    waiting: "En attente",
    blocked: "Bloquée",
    recent_data: "Données récentes",
    historical_data: "Historique",
  }[status];
}

export function campaignChannel(value: CampaignSearchParam): CampaignCockpitChannel | null {
  return typeof value === "string" &&
    CAMPAIGN_COCKPIT_CHANNELS.includes(value as CampaignCockpitChannel)
    ? (value as CampaignCockpitChannel)
    : null;
}

export function campaignStatus(value: CampaignSearchParam): CampaignCockpitStatus | null {
  return typeof value === "string" &&
    CAMPAIGN_COCKPIT_STATUSES.includes(value as CampaignCockpitStatus)
    ? (value as CampaignCockpitStatus)
    : null;
}

export function datasetNotice(
  presentation: DemoPresentation,
  evidenceComplete: boolean,
): string {
  if (!evidenceComplete) {
    return "Origine des données incomplètement vérifiable : environnement de test prudent.";
  }
  if (presentation === "certified-demo") {
    return "Données du scénario d’exemple Nepteo, jamais présentées comme terrain réel.";
  }
  if (presentation === "test-environment") {
    return "Environnement de test : vérifiez l’origine avant toute décision terrain.";
  }
  return "Valeurs relues dans ad_metrics ; aucun statut fournisseur actif/terminé n’est disponible.";
}

export function prospectDatasetLabel(presentation: DemoPresentation): string {
  if (presentation === "certified-demo") {
    return "Scénario d’exemple Nepteo certifié";
  }
  if (presentation === "test-environment") {
    return "Environnement de test — origine à vérifier";
  }
  return "Données enregistrées de votre organisation";
}
