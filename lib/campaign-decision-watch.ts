import type { CampaignComparisonResult } from "./campaign-cockpit.ts";

export interface CampaignDecisionWatch {
  title: string;
  detail: string;
}

export function campaignDecisionWatch(
  comparison: CampaignComparisonResult,
): CampaignDecisionWatch | null {
  if (comparison.status !== "available") return null;
  const { spend, conversions, revenue, cac, roas } = comparison.changes;

  if (conversions !== null && cac !== null && conversions < 0 && cac > 0) {
    const spendLead = spend !== null && spend > 0
      ? `La dépense augmente de ${percentChange(spend)}, tandis que `
      : "";
    return {
      title: "L’efficacité d’acquisition se dégrade",
      detail: `${spendLead}les conversions reculent de ${percentChange(conversions)} et le coût par conversion augmente de ${percentChange(cac)} par rapport à la période précédente.`,
    };
  }

  if (revenue !== null && roas !== null && revenue < 0 && roas < 0) {
    return {
      title: "Le rendement publicitaire se dégrade",
      detail: `Le revenu enregistré recule de ${percentChange(revenue)} et le ROAS recule de ${percentChange(roas)} par rapport à la période précédente.`,
    };
  }

  return null;
}

function percentChange(value: number): string {
  return `${Math.abs(value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}
