import type { CampaignCockpit, CampaignComparisonResult, CampaignDeliveryDiagnostic, ObservedDeliveryChange, ObservedMetricsSource } from "@/lib/campaign-cockpit";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignEvidenceReference, CampaignObservedKpi, CampaignTone } from "../_components/campaign-decision-types";
import { decimal, formatCtr, formatDate, formatDateTime, integer, money } from "./campaign-formatters";
import { datasetEvidence } from "./campaign-labels";

export function presentKpis(
  cockpit: CampaignCockpit,
  presentation: DemoPresentation,
): CampaignObservedKpi[] {
  if (cockpit.totals.status !== "available") return [];
  const { metrics, source } = cockpit.totals;
  const comparison = cockpit.comparison;
  return [
    observedKpi("spend", "Dépense enregistrée", money.format(metrics.spend), source, comparisonValue(comparison, "spend", false), presentation),
    observedKpi("conversions", "Conversions enregistrées", integer.format(metrics.conversions), source, comparisonValue(comparison, "conversions", true), presentation),
    metrics.cac === null
      ? unavailableKpi("cost", "Coût / conversion", "Aucune conversion enregistrée ne permet ce calcul.", source, presentation)
      : observedKpi("cost", "Coût / conversion", money.format(metrics.cac), source, comparisonValue(comparison, "cac", false, true), presentation),
    observedKpi("revenue", "Revenu enregistré", money.format(metrics.revenue), source, comparisonValue(comparison, "revenue", true), presentation),
    metrics.roas === null
      ? unavailableKpi("roas", "ROAS observé", "Aucune dépense positive ne permet ce calcul.", source, presentation)
      : observedKpi("roas", "ROAS observé", `${decimal.format(metrics.roas)}×`, source, comparisonValue(comparison, "roas", true), presentation),
    metrics.cpm.status === "unavailable"
      ? unavailableKpi("cpm", "CPM observé", "Aucune impression enregistrée sur la période ne permet de calculer le coût pour 1 000 impressions.", source, presentation)
      : observedKpi("cpm", "CPM observé", money.format(metrics.cpm.value), source, deliveryComparisonFor(comparison, "cpm"), presentation),
    metrics.ctr.status === "unavailable"
      ? unavailableKpi("ctr", "CTR observé", "Aucune impression enregistrée sur la période ne permet de calculer le ratio clics / impressions.", source, presentation)
      : observedKpi("ctr", "CTR observé", formatCtr(metrics.ctr.value), source, deliveryComparisonFor(comparison, "ctr"), presentation),
  ];
}

export function observedKpi(
  id: string,
  label: string,
  value: string,
  source: ObservedMetricsSource,
  comparison: { value: string; tone?: CampaignTone } | null,
  presentation: DemoPresentation,
): CampaignObservedKpi {
  return {
    id,
    label,
    observation: {
      state: "available",
      value,
      source: evidenceForMetrics(source, presentation),
      comparison,
    },
  };
}

export function unavailableKpi(
  id: string,
  label: string,
  reason: string,
  source: ObservedMetricsSource,
  presentation: DemoPresentation,
): CampaignObservedKpi {
  return {
    id,
    label,
    observation: {
      state: "insufficient",
      reason,
      source: evidenceForMetrics(source, presentation),
    },
  };
}

export function comparisonValue(
  comparison: CampaignComparisonResult,
  key: "spend" | "conversions" | "revenue" | "cac" | "roas",
  higherIsPositive: boolean,
  lowerIsPositive = false,
): { value: string; tone?: CampaignTone } | null {
  if (comparison.status !== "available") return null;
  const change = comparison.changes[key];
  if (change === null) return null;
  const tone: CampaignTone =
    change === 0
      ? "neutral"
      : lowerIsPositive
        ? change < 0
          ? "positive"
          : "negative"
        : higherIsPositive
          ? change > 0
            ? "positive"
            : "negative"
          : "neutral";
  return {
    value: `${change >= 0 ? "+" : "−"}${Math.abs(change * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % vs période précédente`,
    tone,
  };
}

export function deliveryComparisonFor(
  comparison: CampaignComparisonResult,
  key: "cpm" | "ctr",
): { value: string; tone?: CampaignTone } | null {
  if (comparison.status !== "available") return null;
  return deliveryComparisonValue(comparison.changes[key]);
}

export function deliveryComparisonValue(
  change: ObservedDeliveryChange,
): { value: string; tone?: CampaignTone } {
  if (change.status === "unavailable") {
    const reasons: Record<typeof change.reason, string> = {
      current_metric_unavailable:
        "la période actuelle ne contient aucune impression",
      previous_metric_unavailable:
        "la période précédente ne contient aucune impression",
      zero_previous_value: "la valeur précédente est nulle",
    };
    return {
      value: `Comparaison indisponible : ${reasons[change.reason]}.`,
      tone: "neutral",
    };
  }
  return {
    value: `${change.value >= 0 ? "+" : "−"}${Math.abs(change.value * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % vs période précédente`,
    tone: "neutral",
  };
}

export function evidenceForMetrics(
  source: ObservedMetricsSource,
  presentation: DemoPresentation,
): CampaignEvidenceReference {
  return {
    ...datasetEvidence(presentation, source.provider),
    periodLabel: `${formatDate(source.from)} → ${formatDate(source.to)} · ${source.rowCount} ligne(s)`,
    observedAtLabel: source.lastSyncedAt
      ? formatDateTime(source.lastSyncedAt)
      : undefined,
  };
}

export function evidenceForDeliveryDiagnostic(
  diagnostic: CampaignDeliveryDiagnostic,
  presentation: DemoPresentation,
  provider: ObservedMetricsSource["provider"] | null,
): CampaignEvidenceReference | null {
  const { source } = diagnostic;
  if (provider === null || source.currentRowCount + source.previousRowCount === 0) {
    return null;
  }
  const current = `période actuelle ${formatDate(source.currentPeriod.from)} → ${formatDate(source.currentPeriod.to)} · ${source.currentRowCount} ligne(s)`;
  const previous = source.previousPeriod
    ? `période précédente ${formatDate(source.previousPeriod.from)} → ${formatDate(source.previousPeriod.to)} · ${source.previousRowCount} ligne(s)`
    : "aucune période précédente sélectionnée";
  return {
    ...datasetEvidence(presentation, provider),
    periodLabel: `${current} ; ${previous}`,
  };
}
