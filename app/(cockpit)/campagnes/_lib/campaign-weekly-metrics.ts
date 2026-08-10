import type { CampaignWeeklyReport } from "@/lib/campaign-insights";
import type { ObservedDeliveryChange, ObservedDeliveryMetric } from "@/lib/campaign-cockpit";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignEvidenceReference, CampaignWeeklyInsights } from "../_components/campaign-decision-types";
import { decimal, formatCtr, formatDate, integer, money } from "./campaign-formatters";
import { channelLabel, datasetEvidence, prospectDatasetLabel, statusLabel } from "./campaign-labels";
export function weeklyMetricViews(
  report: Extract<CampaignWeeklyReport, { status: "available" }>,
): CampaignWeeklyInsights["report"]["metrics"] {
  const { current, previous, changes } = report.totals;
  return [
    {
      id: "impressions",
      label: "Impressions",
      current: integer.format(current.impressions),
      previous: integer.format(previous.impressions),
      change: formatWeeklyChange(relativeDifference(current.impressions, previous.impressions)),
    },
    {
      id: "clicks",
      label: "Clics",
      current: integer.format(current.clicks),
      previous: integer.format(previous.clicks),
      change: formatWeeklyChange(relativeDifference(current.clicks, previous.clicks)),
    },
    {
      id: "spend",
      label: "Dépense",
      current: money.format(current.spend),
      previous: money.format(previous.spend),
      change: formatWeeklyChange(changes.spend),
    },
    {
      id: "conversions",
      label: "Conversions",
      current: integer.format(current.conversions),
      previous: integer.format(previous.conversions),
      change: formatWeeklyChange(changes.conversions),
    },
    {
      id: "revenue",
      label: "Revenu",
      current: money.format(current.revenue),
      previous: money.format(previous.revenue),
      change: formatWeeklyChange(changes.revenue),
    },
    {
      id: "cac",
      label: "Coût / conversion",
      current: current.cac === null ? "Indisponible" : money.format(current.cac),
      previous: previous.cac === null ? "Indisponible" : money.format(previous.cac),
      change: formatWeeklyChange(changes.cac),
    },
    {
      id: "roas",
      label: "ROAS",
      current: current.roas === null ? "Indisponible" : `${decimal.format(current.roas)}×`,
      previous: previous.roas === null ? "Indisponible" : `${decimal.format(previous.roas)}×`,
      change: formatWeeklyChange(changes.roas),
    },
    {
      id: "cpm",
      label: "CPM",
      current: formatWeeklyDeliveryMetric(current.cpm, "money"),
      previous: formatWeeklyDeliveryMetric(previous.cpm, "money"),
      change: formatWeeklyDeliveryChange(changes.cpm),
    },
    {
      id: "ctr",
      label: "CTR",
      current: formatWeeklyDeliveryMetric(current.ctr, "percent"),
      previous: formatWeeklyDeliveryMetric(previous.ctr, "percent"),
      change: formatWeeklyDeliveryChange(changes.ctr),
    },
  ];
}

export function weeklyCoverage(
  report: Extract<CampaignWeeklyReport, { status: "available" }>,
): string {
  const comparable = report.campaigns.filter((campaign) => campaign.status === "available").length;
  const unavailable = report.campaigns.length - comparable;
  return `${report.campaigns.length} campagne(s) incluse(s) : ${comparable} avec des lignes disponibles sur chacune des deux périodes, ${unavailable} sans lignes sur chacune des deux périodes.`;
}

export function weeklyEvidence(
  source: CampaignWeeklyReport["source"],
  period: CampaignWeeklyReport["period"],
  presentation: DemoPresentation,
): CampaignEvidenceReference {
  const evidence = source.provider === null
    ? { label: `${prospectDatasetLabel(presentation)} · ad_metrics · fournisseur indisponible` }
    : datasetEvidence(presentation, source.provider);
  return {
    ...evidence,
    periodLabel: `${rangeLabel(period.current)} · comparaison ${
      period.previous ? rangeLabel(period.previous) : "indisponible"
    }`,
  };
}

export function weeklySourceDetail(source: CampaignWeeklyReport["source"]): string {
  const current = source.currentRowCount === null
    ? "courant indisponible"
    : `${source.currentRowCount} ligne(s) courante(s)`;
  const previous = source.previousRowCount === null
    ? "précédent indisponible"
    : `${source.previousRowCount} ligne(s) précédente(s)`;
  const channels = source.filters.channels === "all"
    ? "tous les canaux présents"
    : source.filters.channels.map(channelLabel).join(", ");
  const statuses = source.filters.statuses === "all"
    ? "tous les états documentés"
    : source.filters.statuses.map(statusLabel).join(", ");
  return `Dénominateurs ad_metrics : ${current} · ${previous}. Filtres : ${channels} · ${statuses}.`;
}

export function weeklyUnavailableReason(reason: string): string {
  const reasons: Record<string, string> = {
    invalid_period: "Une période calendaire est invalide.",
    current_period_not_seven_days: "La période courante ne couvre pas exactement 7 jours.",
    comparison_not_configured: "La période de comparaison n’est pas configurée.",
    previous_period_not_seven_days: "La période précédente ne couvre pas exactement 7 jours.",
    periods_not_adjacent: "Les deux périodes de 7 jours ne sont pas adjacentes.",
    no_current_rows: "Aucune ligne ad_metrics n’est disponible sur les 7 jours courants.",
    no_previous_rows: "Aucune ligne ad_metrics n’est disponible sur les 7 jours précédents.",
    source_inconsistent: "La cohérence entre périodes, lignes et calculs n’a pas été démontrée.",
    delivery_metrics_unavailable: "CPM ou CTR est indisponible faute de dénominateur exploitable.",
  };
  return reasons[reason] ?? "Réponse indisponible sans motif reconnu.";
}

export function formatWeeklyDeliveryMetric(
  metric: ObservedDeliveryMetric,
  format: "money" | "percent",
): string {
  if (metric.status === "unavailable") return "Indisponible";
  return format === "money" ? money.format(metric.value) : formatCtr(metric.value);
}

export function formatWeeklyDeliveryChange(change: ObservedDeliveryChange): string {
  return change.status === "available"
    ? formatWeeklyChange(change.value)
    : "Indisponible";
}

export function formatWeeklyChange(value: number | null): string {
  if (value === null) return "Indisponible";
  const formatted = decimal.format(Math.abs(value) * 100);
  if (value === 0) return "0 %";
  return `${value > 0 ? "+" : "−"}${formatted} %`;
}

export function relativeDifference(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 10_000;
}

export function deliveryDirectionLabel(direction: "higher" | "lower" | "unchanged"): string {
  if (direction === "higher") return "plus élevé";
  if (direction === "lower") return "plus bas";
  return "inchangé";
}

export function rangeLabel(range: { from: string; to: string }): string {
  return `${formatDate(range.from)} → ${formatDate(range.to)}`;
}
