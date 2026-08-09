import type { CreativeImageFormat } from "./creative-image-rules.ts";

export interface CampaignCreativeSource {
  id: string;
  title: string;
  status: string;
  objective: string;
  channel: string;
  context: string;
  headline: string;
  recommendedFormat: CreativeImageFormat;
}

interface CampaignActionRow {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  kind?: unknown;
  payload?: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function recommendedFormatForChannel(
  channel: string,
): CreativeImageFormat {
  if (channel === "meta") return "story";
  return "landscape";
}

export function campaignCreativeSource(
  row: CampaignActionRow,
): CampaignCreativeSource | null {
  if (text(row.kind) !== "launch_campaign") return null;
  const id = text(row.id);
  const title = text(row.title);
  if (!id || !title) return null;

  const payload = record(row.payload);
  const brief = record(payload.brief);
  const variants = Array.isArray(payload.variants)
    ? payload.variants.map(text).filter(Boolean)
    : [];
  // CAMP-1 persiste les clés anglaises. Les alias français restent lus pour
  // les rares snapshots locaux produits avant l'alignement du contrat.
  const objective = text(brief.objective) || text(brief.objectif);
  const channel = text(brief.channel) || text(brief.canal);
  const context = text(brief.context) || text(brief.contexte);

  return {
    id,
    title,
    status: text(row.status) || "proposed",
    objective,
    channel,
    context,
    headline: variants[0] || context || title,
    recommendedFormat: recommendedFormatForChannel(channel),
  };
}

export function campaignImageObjective(
  campaign: CampaignCreativeSource,
  editedHeadline: string,
): string {
  return [
    `Campagne : ${campaign.title}`,
    campaign.context && `Contexte : ${campaign.context}`,
    `Message : ${editedHeadline.trim() || campaign.headline}`,
  ]
    .filter(Boolean)
    .join(". ");
}
