import type { CampaignCockpit, CampaignDeliveryDiagnostic, ObservedMetricsSource } from "@/lib/campaign-cockpit";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignDeliveryReading, CampaignPriorityRecommendation } from "../_components/campaign-decision-types";
import { evidenceForDeliveryDiagnostic } from "./campaign-kpi-presentation";
import { datasetEvidence } from "./campaign-labels";
import { formatCtr, formatDate, formatDateTime, money } from "./campaign-formatters";

export function presentDeliveryDiagnostic(
  diagnostic: CampaignDeliveryDiagnostic,
  presentation: DemoPresentation,
  provider: ObservedMetricsSource["provider"] | null,
): CampaignDeliveryReading {
  const source = evidenceForDeliveryDiagnostic(
    diagnostic,
    presentation,
    provider,
  );
  const disclaimer =
    "Cette comparaison est descriptive : elle ne prouve aucune cause et n’attribue pas l’évolution à un contenu, une audience ou un canal.";
  const confidence = {
    state: "not_calculated" as const,
    reason:
      "Comparaison déterministe du CPM et du CTR ; aucune confiance statistique n’est calculée.",
  };

  if (diagnostic.status === "unavailable") {
    const reasons: Record<typeof diagnostic.reason, string> = {
      comparison_disabled: "La comparaison de livraison n’est pas activée.",
      no_current_rows:
        "Aucune ligne n’est disponible sur la période actuelle.",
      no_previous_rows:
        "Aucune ligne n’est disponible sur la période précédente.",
      current_zero_impressions:
        "La période actuelle ne contient aucune impression enregistrée.",
      previous_zero_impressions:
        "La période précédente ne contient aucune impression enregistrée.",
    };
    return {
      state: "unavailable",
      summary: `${reasons[diagnostic.reason]} Aucune évolution de livraison n’est déduite.`,
      disclaimer,
      source,
      confidence,
    };
  }

  const cpm = deliveryDirectionSummary(
    "CPM",
    diagnostic.previous.cpm,
    diagnostic.current.cpm,
    diagnostic.directions.cpm,
    money.format,
  );
  const ctr = deliveryDirectionSummary(
    "CTR",
    diagnostic.previous.ctr,
    diagnostic.current.ctr,
    diagnostic.directions.ctr,
    formatCtr,
  );
  return {
    state: "available",
    summary: `${cpm} ; ${ctr}.`,
    disclaimer,
    source,
    confidence,
  };
}

export function deliveryDirectionSummary(
  label: "CPM" | "CTR",
  previous: number,
  current: number,
  direction: "higher" | "lower" | "unchanged",
  format: (value: number) => string,
): string {
  const directionLabel = {
    higher: "en hausse",
    lower: "en baisse",
    unchanged: "stable",
  }[direction];
  return `${label} observé ${directionLabel} (${format(previous)} → ${format(current)})`;
}

export function presentRecommendation(
  cockpit: CampaignCockpit,
  presentation: DemoPresentation,
): CampaignPriorityRecommendation | null {
  const recommendation = cockpit.recommendation;
  if (!recommendation) return null;
  if (recommendation.evidence.kind === "journal") {
    return {
      title: `Résoudre le blocage documenté de « ${recommendation.campaignName} »`,
      summary: recommendation.evidence.reason,
      source: {
        label: `Journal · ${recommendation.evidence.event}`,
        observedAtLabel: formatDateTime(recommendation.evidence.at),
      },
      confidence: {
        state: "not_calculated",
        reason: "Priorité déterministe ; aucune probabilité de succès n’est calculée.",
      },
    };
  }
  return {
    title: `Examiner « ${recommendation.campaignName} » en priorité`,
    summary: `${money.format(recommendation.evidence.spend)} dépensés pour ${money.format(recommendation.evidence.revenue)} de revenu enregistré sur la fenêtre. Une revue humaine est proposée ; aucun statut actif ni économie future n’est supposé.`,
    source: {
      ...datasetEvidence(presentation),
      periodLabel: `${formatDate(recommendation.evidence.period.from)} → ${formatDate(recommendation.evidence.period.to)} · ${recommendation.evidence.rowCount} ligne(s)`,
    },
    confidence: {
      state: "not_calculated",
      reason: "Classement déterministe sur la perte observée ; confiance non calibrée.",
    },
  };
}
