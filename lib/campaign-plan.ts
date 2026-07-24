/**
 * Plan de campagne — parties pures (aucun import `@/`, testable node:test).
 * « Nouvelle campagne » : à partir d'un brief court, l'agent calcule un plan
 * (budget, coût/contact prévu, confiance) et les garde-fous. Calibré sur les
 * campagnes réelles si dispo, sinon défauts prudents. Ne lance rien.
 */

export const CAMPAIGN_OBJECTIVES = [
  { value: "clients", label: "Trouver des clients" },
  { value: "rdv", label: "Obtenir des rendez-vous" },
  { value: "relance", label: "Relancer des prospects" },
] as const;

export const CAMPAIGN_CHANNELS = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google Ads" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

export const CAMPAIGN_BUDGETS = [10, 20, 30] as const;
export const CAMPAIGN_DURATION_DAYS = 14;

export interface CampaignBrief {
  objectif: string; // value d'objectif
  canal: string; // value de canal
  budgetJour: number; // €/jour
  contexte: string;
}

export interface CampaignPlan {
  budgetTotal: number; // €
  dureeJours: number;
  coutContact: number; // € prévus par contact
  contactsMin: number;
  contactsMax: number;
  confiance: number; // 0..1
  capJour: number; // plafond strict = budget/jour
  arretContact: number; // seuil d'arrêt auto (€/contact)
}

const round = (n: number) => Math.round(n);
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Coût/contact par défaut selon le canal (ordre de grandeur prudent). */
function defaultCostPerContact(canal: string): number {
  if (canal === "linkedin") return 55;
  if (canal === "google") return 40;
  return 35; // meta / défaut
}

/**
 * Construit le plan à partir du brief. `avgCostPerContact` (dépense/conversions
 * des campagnes réelles) prime sur le défaut ; sa présence relève la confiance.
 */
export function buildCampaignPlan(
  brief: CampaignBrief,
  opts: { avgCostPerContact?: number | null } = {},
): CampaignPlan {
  const dureeJours = CAMPAIGN_DURATION_DAYS;
  const budgetTotal = brief.budgetJour * dureeJours;

  const calibrated =
    typeof opts.avgCostPerContact === "number" && opts.avgCostPerContact > 0;
  const coutContact = calibrated
    ? round(opts.avgCostPerContact as number)
    : defaultCostPerContact(brief.canal);

  const mid = coutContact > 0 ? budgetTotal / coutContact : 0;
  const contactsMin = Math.max(1, Math.floor(mid * 0.8));
  const contactsMax = Math.max(contactsMin, Math.ceil(mid * 1.1));

  return {
    budgetTotal,
    dureeJours,
    coutContact,
    contactsMin,
    contactsMax,
    confiance: calibrated ? 0.76 : 0.6,
    capJour: brief.budgetJour,
    arretContact: Math.max(60, roundTo(coutContact * 2.4, 10)),
  };
}

/** Libellé lisible d'un objectif / canal. */
export function objectiveLabel(value: string): string {
  return CAMPAIGN_OBJECTIVES.find((o) => o.value === value)?.label ?? value;
}
export function channelLabel(value: string): string {
  return CAMPAIGN_CHANNELS.find((c) => c.value === value)?.label ?? value;
}
