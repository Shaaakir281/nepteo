import { createHash } from "node:crypto";
import {
  channelLabel,
  cleanCampaignText,
  type CampaignBrief,
} from "@/lib/campaign-plan";

export interface CampaignCompetitionResearchRequest {
  subject: string;
  query: string;
}

/**
 * Requête CAMP-1 bornée aux faits publics utiles à l'arbitrage. Elle ne part
 * que via l'action de recherche confirmée et `runResearch`.
 */
export function buildCampaignCompetitionResearchRequest(
  brief: CampaignBrief,
): CampaignCompetitionResearchRequest {
  const offer = cleanCampaignText(brief.offer).slice(0, 200);
  const audience = cleanCampaignText(brief.audience).slice(0, 300);
  const channel = channelLabel(brief.channel);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([brief.channel, audience, offer]), "utf8")
    .digest("hex")
    .slice(0, 32);

  return {
    subject: `campaign-${brief.channel}-${fingerprint}`,
    query:
      `Recherche des exemples publics récents de campagnes comparables sur ${channel} ` +
      `pour l'offre « ${offer} » et l'audience « ${audience} ». ` +
      `Présente uniquement des faits vérifiables et leurs sources : promesses, ` +
      `angles, formats et appels à l'action observés. Sépare clairement observation ` +
      `et interprétation. N'invente ni performance, ni ciblage, ni budget, ni règle ` +
      `de plateforme. Réponds en français, de façon concise.`,
  };
}
