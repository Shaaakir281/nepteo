export interface CampaignBriefDefaults {
  objective: string;
  campaignType: string;
  audience: string;
  offer: string;
  hypothesis: string;
  channel: string;
  dailyBudget: string;
  durationDays: string;
  primaryMetric: string;
  successThreshold: string;
  context: string;
}

const EMPTY_DEFAULTS: CampaignBriefDefaults = {
  objective: "",
  campaignType: "",
  audience: "",
  offer: "",
  hypothesis: "",
  channel: "",
  dailyBudget: "",
  durationDays: "",
  primaryMetric: "",
  successThreshold: "",
  context: "",
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function objectiveFromMemory(objectives: string[]): string {
  const joined = objectives.join(" ").toLocaleLowerCase("fr");
  if (/rendez-vous/.test(joined)) return "appointments";
  if (/vendre|vente/.test(joined)) return "offer_sales";
  if (/relancer|réactiver/.test(joined)) return "reactivation";
  if (/fidéliser/.test(joined)) return "nurturing";
  if (/contenu|notoriété/.test(joined)) return "awareness";
  return "new_customers";
}

function campaignTypeForObjective(objective: string): string {
  if (objective === "offer_sales") return "conversion";
  if (objective === "reactivation") return "reactivation";
  if (objective === "nurturing") return "nurturing";
  if (objective === "awareness") return "awareness";
  return "acquisition";
}

function metricForObjective(objective: string): string {
  if (objective === "appointments") return "appointments";
  if (objective === "offer_sales") return "sales";
  return "contacts";
}

function channelFromMemory(channels: string[], audience: string): string {
  const joined = channels.join(" ").toLocaleLowerCase("fr");
  if (/google/.test(joined)) return "google";
  if (/prospection|linkedin|événement/.test(joined) || /entreprise/.test(audience)) {
    return "linkedin";
  }
  return "meta";
}

function offerFromMemory(section: UnknownRecord): string {
  const first = Array.isArray(section.items) ? record(section.items[0]) : {};
  const parts = [text(first.name), text(first.price), text(first.promise)].filter(Boolean);
  return parts.join(" · ");
}

export function campaignBriefDefaultsFromMemory(
  memory: Record<string, unknown>,
): CampaignBriefDefaults {
  const activity = record(memory.activite);
  const zone = record(memory.zone);
  const offers = record(memory.offres);
  const tone = record(memory.ton);
  const philosophy = record(memory.philosophie);
  const objectives = list(record(memory.objectifs).list);
  const channels = list(record(memory.canaux).list);
  const offer = offerFromMemory(offers);
  const audience = [text(activity.audience), text(zone.text)].filter(Boolean).join(" · ");
  const hasProfile = Boolean(
    text(activity.description) || audience || offer || objectives.length || channels.length,
  );
  if (!hasProfile) return { ...EMPTY_DEFAULTS };

  const objective = objectiveFromMemory(objectives);
  const metric = metricForObjective(objective);
  const metricPhrase =
    metric === "appointments" ? "les demandes de rendez-vous" : metric === "sales" ? "les ventes" : "les contacts qualifiés";
  const hypothesisSubject = offer || "l’offre principale";
  const hypothesisAudience = audience || "l’audience prioritaire";
  const context = [
    text(tone.text) ? `Ton : ${text(tone.text)}` : "",
    text(philosophy.text) ? `Principe : ${text(philosophy.text)}` : "",
  ].filter(Boolean).join(" · ");

  return {
    objective,
    campaignType: campaignTypeForObjective(objective),
    audience: audience || text(activity.description),
    offer: offer || text(activity.description),
    hypothesis: `Mettre en avant ${hypothesisSubject} auprès de ${hypothesisAudience} augmentera ${metricPhrase}.`.slice(0, 1_000),
    channel: channelFromMemory(channels, text(activity.audience)),
    dailyBudget: "40",
    durationDays: "14",
    primaryMetric: metric,
    successThreshold: metric === "sales" ? "5" : "10",
    context: context.slice(0, 2_000),
  };
}
