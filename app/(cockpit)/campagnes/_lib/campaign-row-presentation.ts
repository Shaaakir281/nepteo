import type { CampaignCockpitItem, ObservedDeliveryMetric, CampaignStatusEvidence as DomainStatusEvidence } from "@/lib/campaign-cockpit";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignAgentReading, CampaignDecisionRow, CampaignTone } from "../_components/campaign-decision-types";
import { decimal, formatCtr, formatDateTime, integer, money } from "./campaign-formatters";
import { comparisonValue, deliveryComparisonFor, evidenceForMetrics } from "./campaign-kpi-presentation";
import { channelLabel, providerLabel, statusLabel } from "./campaign-labels";
import { presentDeliveryDiagnostic } from "./campaign-delivery-presentation";

export function presentCampaign(
  campaign: CampaignCockpitItem,
  presentation: DemoPresentation,
): CampaignDecisionRow {
  const source = campaign.performance
    ? evidenceForMetrics(campaign.performance.source, presentation)
    : null;
  const metric = (
    label: string,
    value: string | null,
    missingReason: string,
    comparisonKey?: "spend" | "conversions" | "revenue" | "cac" | "roas",
    inverse = false,
  ) => ({
    label,
    observation:
      campaign.performance && value !== null
        ? {
            state: "available" as const,
            value,
            source: evidenceForMetrics(campaign.performance.source, presentation),
            comparison: comparisonKey
              ? comparisonValue(campaign.comparison, comparisonKey, !inverse, inverse)
              : null,
          }
        : {
            state: campaign.performance ? ("insufficient" as const) : ("unavailable" as const),
            reason: missingReason,
            source,
          },
  });
  const deliveryMetric = (
    label: string,
    observed: ObservedDeliveryMetric | null,
    comparisonKey: "cpm" | "ctr",
    missingReason: string,
  ) => ({
    label,
    observation:
      !campaign.performance
        ? {
            state: "unavailable" as const,
            reason: "Aucune métrique de livraison observée.",
            source,
          }
        : observed?.status !== "available"
          ? {
              state: "insufficient" as const,
              reason: missingReason,
              source,
            }
          : {
              state: "available" as const,
              value:
                comparisonKey === "cpm"
                  ? money.format(observed.value)
                  : formatCtr(observed.value),
              source: evidenceForMetrics(
                campaign.performance.source,
                presentation,
              ),
              comparison: deliveryComparisonFor(
                campaign.comparison,
                comparisonKey,
              ),
            },
  });
  const values = campaign.performance?.metrics ?? null;
  return {
    id: campaign.key,
    name: campaign.campaignName,
    channel: { id: campaign.channel, label: channelLabel(campaign.channel) },
    status: presentStatus(campaign.status, presentation),
    source,
    spend: metric("Dépense", values ? money.format(values.spend) : null, "Aucune métrique de dépense observée.", "spend"),
    acquisitionCost: metric("Coût / conversion", values?.cac == null ? null : money.format(values.cac), "Aucune conversion ne permet ce calcul.", "cac", true),
    results: metric("Conversions", values ? integer.format(values.conversions) : null, "Aucune conversion observée.", "conversions"),
    revenue: metric("Revenu", values ? money.format(values.revenue) : null, "Aucune métrique de revenu observée.", "revenue"),
    roas: metric("ROAS", values?.roas == null ? null : `${decimal.format(values.roas)}×`, "Aucune dépense positive ne permet ce calcul.", "roas"),
    cpm: deliveryMetric(
      "CPM",
      values?.cpm ?? null,
      "cpm",
      "Aucune impression enregistrée sur la période ne permet de calculer le CPM.",
    ),
    ctr: deliveryMetric(
      "CTR",
      values?.ctr ?? null,
      "ctr",
      "Aucune impression enregistrée sur la période ne permet de calculer le CTR.",
    ),
    deliveryDiagnostic: presentDeliveryDiagnostic(
      campaign.deliveryDiagnostic,
      presentation,
      campaign.performance?.source.provider ?? null,
    ),
    agentReading: presentReading(campaign, presentation),
  };
}

export function presentStatus(
  status: DomainStatusEvidence,
  presentation: DemoPresentation,
) {
  const tone: CampaignTone =
    status.value === "blocked"
      ? "negative"
      : status.value === "waiting"
        ? "warning"
        : status.value === "active"
          ? "positive"
          : "neutral";
  if (status.basis === "provider_status") {
    return {
      id: status.value,
      label: statusLabel(status.value),
      tone,
      evidence: {
        kind: "observed" as const,
        source: {
          label: `Statut fournisseur ${providerLabel(status.source.provider)}`,
          observedAtLabel: formatDateTime(status.source.observedAt),
        },
      },
    };
  }
  if (status.basis === "journal") {
    return {
      id: status.value,
      label: statusLabel(status.value),
      tone,
      evidence: {
        kind: "observed" as const,
        source: {
          label: `Journal · ${status.source.event} · ${status.source.reason}`,
          observedAtLabel: formatDateTime(status.source.at),
        },
      },
    };
  }
  if (status.basis === "action") {
    return {
      id: status.value,
      label: statusLabel(status.value),
      tone,
      evidence: {
        kind: "observed" as const,
        source: {
          label: `Action launch_campaign · ${status.source.status}`,
          observedAtLabel: formatDateTime(status.source.at),
        },
      },
    };
  }
  return {
    id: status.value,
    label: statusLabel(status.value),
    tone,
    evidence: {
      kind: "derived" as const,
      rule:
        status.value === "recent_data"
          ? "au moins une métrique tombe dans la fenêtre sélectionnée ; cela ne prouve pas une campagne active"
          : "les métriques sont antérieures à la fenêtre ; cela ne prouve pas un arrêt fournisseur",
      source: evidenceForMetrics(status.source, presentation),
    },
  };
}

export function presentReading(
  campaign: CampaignCockpitItem,
  presentation: DemoPresentation,
): CampaignAgentReading | null {
  if (!campaign.reading) return null;
  const summaries = {
    revenue_below_spend: "Le revenu enregistré est inférieur à la dépense sur la fenêtre observée.",
    revenue_at_or_above_spend: "Le revenu enregistré est au moins égal à la dépense sur la fenêtre observée.",
    spend_without_conversion: "Une dépense est enregistrée sans conversion sur la fenêtre observée.",
    no_positive_spend: "Aucune dépense positive n’est enregistrée sur la fenêtre observée.",
  } as const;
  return {
    summary: summaries[campaign.reading.verdict],
    source: evidenceForMetrics(campaign.reading.source, presentation),
    confidence: {
      state: "not_calculated",
      reason: "Aucun modèle de confiance n’est calibré pour ces métriques.",
    },
  };
}
