import type {
  FalsePositiveReason,
  ValueEventEditLevel,
  ValueEventType,
} from "@/lib/value-events-rules";

export const FALSE_POSITIVE_OPTIONS: ReadonlyArray<{
  value: FalsePositiveReason;
  label: string;
}> = [
  { value: "recent_contact", label: "Contact trop récent" },
  { value: "already_replied", label: "A déjà répondu" },
  { value: "opted_out", label: "Opposition / désinscription" },
  { value: "wrong_person", label: "Mauvaise personne" },
  { value: "terminal_stage", label: "Statut déjà terminal" },
  { value: "missing_context", label: "Contexte manquant" },
  { value: "other", label: "Autre motif normalisé" },
];

export const EDIT_LEVELS: ReadonlyArray<{
  value: ValueEventEditLevel;
  label: string;
}> = [
  { value: "none", label: "Aucune" },
  { value: "light", label: "Légère" },
  { value: "significant", label: "Importante" },
];

export const OUTCOMES: ReadonlyArray<{ value: ValueEventType; label: string }> = [
  { value: "manual_followup_sent", label: "Relance envoyée manuellement" },
  { value: "reply_received", label: "Réponse reçue" },
  { value: "meeting_booked", label: "Rendez-vous obtenu" },
  { value: "opportunity_created", label: "Opportunité créée" },
];

export const isOutcomeEvent = (eventType: ValueEventType) =>
  OUTCOMES.some((outcome) => outcome.value === eventType);
