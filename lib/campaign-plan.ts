/**
 * Contrat pur CAMP-0. Ce module valide le brief et les variantes, puis dérive
 * le plan sans I/O. Le navigateur ne constitue jamais une source d'autorité.
 */

export const CAMPAIGN_OBJECTIVES = [
  { value: "offer_sales", label: "Vendre une offre" },
  { value: "new_customers", label: "Trouver de nouveaux clients" },
  { value: "trials", label: "Obtenir des essais" },
  { value: "appointments", label: "Obtenir des rendez-vous" },
  { value: "retargeting", label: "Faire du retargeting" },
  { value: "awareness", label: "Développer la notoriété" },
  { value: "nurturing", label: "Nourrir des prospects" },
  { value: "reactivation", label: "Réactiver des contacts" },
] as const;

export const CAMPAIGN_TYPES = [
  { value: "awareness", label: "Notoriété" },
  { value: "acquisition", label: "Acquisition" },
  { value: "consideration", label: "Considération" },
  { value: "conversion", label: "Conversion" },
  { value: "retargeting", label: "Retargeting" },
  { value: "nurturing", label: "Nurturing" },
  { value: "reactivation", label: "Réactivation" },
] as const;

export const CAMPAIGN_CHANNELS = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google Ads" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

export const CAMPAIGN_METRICS = [
  { value: "contacts", label: "Contacts obtenus", unit: "contacts" },
  { value: "appointments", label: "Rendez-vous obtenus", unit: "rendez-vous" },
  { value: "trials", label: "Essais obtenus", unit: "essais" },
  { value: "sales", label: "Ventes obtenues", unit: "ventes" },
  { value: "conversion_rate", label: "Taux de conversion", unit: "%" },
  { value: "roas", label: "ROAS", unit: "×" },
] as const;

export const CAMPAIGN_DURATIONS = [7, 14, 30] as const;
export const CAMPAIGN_BUDGET_LIMITS = Object.freeze({ min: 5, max: 1_000 });
export const CAMPAIGN_TEXT_LIMITS = Object.freeze({
  audience: { min: 3, max: 500 },
  offer: { min: 3, max: 500 },
  hypothesis: { min: 10, max: 1_000 },
  context: { min: 0, max: 2_000 },
  variant: { min: 10, max: 500 },
});
export const CAMPAIGN_VARIANT_COUNT = 2;

export interface CampaignBrief {
  objective: string;
  campaignType: string;
  audience: string;
  offer: string;
  hypothesis: string;
  channel: string;
  dailyBudget: number;
  durationDays: number;
  primaryMetric: string;
  successThreshold: number;
  context: string;
}

export interface CampaignPlan {
  totalBudget: number;
  durationDays: number;
  costPerContact: number | null;
  contactsMin: number | null;
  contactsMax: number | null;
  confidence: number | null;
  dailyCap: number;
  stopCostPerContact: number | null;
}

export type CampaignBriefField = keyof CampaignBrief;
export type CampaignValidationErrors = Partial<Record<CampaignBriefField, string>>;

export type CampaignBriefValidation =
  | { ok: true; value: CampaignBrief }
  | { ok: false; errors: CampaignValidationErrors };

export type CampaignVariantsValidation =
  | { ok: true; value: [string, string] }
  | { ok: false; error: string };

const objectiveValues = new Set(CAMPAIGN_OBJECTIVES.map(({ value }) => value));
const typeValues = new Set(CAMPAIGN_TYPES.map(({ value }) => value));
const channelValues = new Set(CAMPAIGN_CHANNELS.map(({ value }) => value));
const metricValues = new Set(CAMPAIGN_METRICS.map(({ value }) => value));
const durationValues = new Set<number>(CAMPAIGN_DURATIONS);

const round = (value: number) => Math.round(value);
const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(Math.round(scaled) - scaled) <= 1e-7;
}

/** Nettoyage déterministe des textes avant toute dérivation ou persistance. */
export function cleanCampaignText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function recordValue(input: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
}

function validateRequiredText(
  value: unknown,
  limits: { min: number; max: number },
  missingMessage: string,
): { value: string; error?: string } {
  const cleaned = cleanCampaignText(value);
  if (cleaned.length < limits.min) return { value: cleaned, error: missingMessage };
  if (cleaned.length > limits.max) {
    return { value: cleaned, error: `Maximum ${limits.max} caractères.` };
  }
  return { value: cleaned };
}

function metricThresholdBounds(metric: string): { min: number; max: number } {
  if (metric === "conversion_rate") return { min: 0.1, max: 100 };
  if (metric === "roas") return { min: 0.1, max: 20 };
  return { min: 1, max: 100_000 };
}

/**
 * Valide et nettoie le brief reçu. Cette fonction doit être appelée à la
 * construction ET à la soumission, car les arguments d'une Server Action sont
 * contrôlés par le navigateur.
 */
export function validateCampaignBrief(input: unknown): CampaignBriefValidation {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: CampaignValidationErrors = {};

  const objective = cleanCampaignText(recordValue(raw, "objective"));
  if (!objectiveValues.has(objective as never)) errors.objective = "Choisissez un objectif.";

  const campaignType = cleanCampaignText(recordValue(raw, "campaignType"));
  if (!typeValues.has(campaignType as never)) {
    errors.campaignType = "Choisissez une étape de campagne.";
  }

  const audience = validateRequiredText(
    recordValue(raw, "audience"),
    CAMPAIGN_TEXT_LIMITS.audience,
    "Décrivez l'audience visée.",
  );
  if (audience.error) errors.audience = audience.error;

  const offer = validateRequiredText(
    recordValue(raw, "offer"),
    CAMPAIGN_TEXT_LIMITS.offer,
    "Décrivez l'offre mise en avant.",
  );
  if (offer.error) errors.offer = offer.error;

  const hypothesis = validateRequiredText(
    recordValue(raw, "hypothesis"),
    CAMPAIGN_TEXT_LIMITS.hypothesis,
    "Formulez l'hypothèse à tester.",
  );
  if (hypothesis.error) errors.hypothesis = hypothesis.error;

  const channel = cleanCampaignText(recordValue(raw, "channel"));
  if (!channelValues.has(channel as never)) errors.channel = "Choisissez un canal.";

  const dailyBudget = Number(recordValue(raw, "dailyBudget"));
  if (
    !Number.isFinite(dailyBudget) ||
    dailyBudget < CAMPAIGN_BUDGET_LIMITS.min ||
    dailyBudget > CAMPAIGN_BUDGET_LIMITS.max ||
    !hasAtMostTwoDecimals(dailyBudget)
  ) {
    errors.dailyBudget = `Saisissez un budget entre ${CAMPAIGN_BUDGET_LIMITS.min} et ${CAMPAIGN_BUDGET_LIMITS.max} € par jour.`;
  }

  const durationDays = Number(recordValue(raw, "durationDays"));
  if (!Number.isInteger(durationDays) || !durationValues.has(durationDays)) {
    errors.durationDays = "Choisissez une durée de 7, 14 ou 30 jours.";
  }

  const primaryMetric = cleanCampaignText(recordValue(raw, "primaryMetric"));
  if (!metricValues.has(primaryMetric as never)) {
    errors.primaryMetric = "Choisissez une métrique principale.";
  }

  const successThreshold = Number(recordValue(raw, "successThreshold"));
  const thresholdBounds = metricThresholdBounds(primaryMetric);
  if (
    !Number.isFinite(successThreshold) ||
    successThreshold < thresholdBounds.min ||
    successThreshold > thresholdBounds.max ||
    !hasAtMostTwoDecimals(successThreshold)
  ) {
    errors.successThreshold = `Saisissez un seuil entre ${thresholdBounds.min} et ${thresholdBounds.max}.`;
  }

  const context = validateRequiredText(
    recordValue(raw, "context"),
    CAMPAIGN_TEXT_LIMITS.context,
    "",
  );
  if (context.error) errors.context = context.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      objective,
      campaignType,
      audience: audience.value,
      offer: offer.value,
      hypothesis: hypothesis.value,
      channel,
      dailyBudget,
      durationDays,
      primaryMetric,
      successThreshold,
      context: context.value,
    },
  };
}

/** Exactement deux variantes, toutes deux non vides, nettoyées et bornées. */
export function validateCampaignVariants(input: unknown): CampaignVariantsValidation {
  if (!Array.isArray(input) || input.length !== CAMPAIGN_VARIANT_COUNT) {
    return { ok: false, error: "Conservez exactement deux variantes." };
  }
  const variants = input.map(cleanCampaignText);
  for (const variant of variants) {
    if (variant.length < CAMPAIGN_TEXT_LIMITS.variant.min) {
      return {
        ok: false,
        error: `Chaque variante doit contenir au moins ${CAMPAIGN_TEXT_LIMITS.variant.min} caractères.`,
      };
    }
    if (variant.length > CAMPAIGN_TEXT_LIMITS.variant.max) {
      return {
        ok: false,
        error: `Chaque variante est limitée à ${CAMPAIGN_TEXT_LIMITS.variant.max} caractères.`,
      };
    }
  }
  return { ok: true, value: variants as [string, string] };
}

/** Dérive intégralement le plan depuis un brief déjà validé. */
export function buildCampaignPlan(
  brief: CampaignBrief,
  options: { avgCostPerContact?: number | null; confidence?: number | null } = {},
): CampaignPlan {
  const totalBudget = round(brief.dailyBudget * brief.durationDays * 100) / 100;
  const calibrated =
    typeof options.avgCostPerContact === "number" &&
    Number.isFinite(options.avgCostPerContact) &&
    options.avgCostPerContact > 0;
  const costPerContact = calibrated
    ? round((options.avgCostPerContact as number) * 100) / 100
    : null;
  const midpoint = costPerContact === null ? null : totalBudget / costPerContact;
  const contactsMin = midpoint === null ? null : Math.max(1, Math.floor(midpoint * 0.8));
  const contactsMax =
    midpoint === null || contactsMin === null
      ? null
      : Math.max(contactsMin, Math.ceil(midpoint * 1.1));

  return {
    totalBudget,
    durationDays: brief.durationDays,
    costPerContact,
    contactsMin,
    contactsMax,
    confidence:
      calibrated &&
      typeof options.confidence === "number" &&
      Number.isFinite(options.confidence) &&
      options.confidence >= 0 &&
      options.confidence <= 1
        ? options.confidence
        : calibrated
          ? 0.6
          : null,
    dailyCap: brief.dailyBudget,
    stopCostPerContact:
      costPerContact === null ? null : Math.max(60, roundTo(costPerContact * 2.4, 10)),
  };
}

function labelFor(
  value: string,
  options: readonly { value: string; label: string }[],
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export const objectiveLabel = (value: string) => labelFor(value, CAMPAIGN_OBJECTIVES);
export const campaignTypeLabel = (value: string) => labelFor(value, CAMPAIGN_TYPES);
export const channelLabel = (value: string) => labelFor(value, CAMPAIGN_CHANNELS);
export const metricLabel = (value: string) => labelFor(value, CAMPAIGN_METRICS);

export function metricUnit(value: string): string {
  return CAMPAIGN_METRICS.find((metric) => metric.value === value)?.unit ?? "";
}
