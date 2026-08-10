import { type CampaignCockpit, type CampaignCockpitChannel, type CampaignCockpitItem, type CampaignCockpitStatus } from "@/lib/campaign-cockpit";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignActivityEvent, CampaignCockpitFilters, CampaignDailySummary, CampaignDecisionPeriod, CampaignDecisionRow, CampaignDeliveryReading, CampaignObservedKpi, CampaignPastAttempt, CampaignPriorityRecommendation } from "../_components/campaign-decision-types";
import { formatDate } from "./campaign-formatters";
import { presentActivity, presentAttempts, presentDailySummary } from "./campaign-history-presentation";
import { presentKpis } from "./campaign-kpi-presentation";
import { channelLabel, comparisonReason, statusLabel } from "./campaign-labels";
import { WINDOW_DAYS } from "./campaign-page-constants";
import { presentCampaign } from "./campaign-row-presentation";
import { presentDeliveryDiagnostic, presentRecommendation } from "./campaign-delivery-presentation";

export function presentCockpit(cockpit: CampaignCockpit, presentation: DemoPresentation) {
  const hasCockpitFilter =
    cockpit.filters.channels !== "all" || cockpit.filters.statuses !== "all";
  const includedCampaigns = new Set(
    cockpit.campaigns.map((campaign) => campaign.key),
  );
  const attempts = hasCockpitFilter
    ? cockpit.history.attempts.filter(
        (attempt) =>
          attempt.campaignKey !== null &&
          includedCampaigns.has(attempt.campaignKey),
      )
    : cockpit.history.attempts;
  return {
    period: presentPeriod(cockpit),
    kpis: presentKpis(cockpit, presentation),
    deliveryDiagnostic: presentDeliveryDiagnostic(
      cockpit.deliveryDiagnostic,
      presentation,
      cockpit.totals.status === "available"
        ? cockpit.totals.source.provider
        : null,
    ),
    recommendation: presentRecommendation(cockpit, presentation),
    campaigns: cockpit.campaigns.map((campaign) =>
      presentCampaign(campaign, presentation),
    ),
    pastAttempts: presentAttempts(attempts),
    dailySummary: presentDailySummary(cockpit, presentation),
    activity: presentActivity(
      attempts,
      hasCockpitFilter ? [] : cockpit.history.unlinkedJournalEvents,
    ),
  };
}

export function presentFilters(
  channelCampaigns: CampaignCockpitItem[],
  statusCampaigns: CampaignCockpitItem[],
  selectedChannel: CampaignCockpitChannel | null,
  selectedStatus: CampaignCockpitStatus | null,
): CampaignCockpitFilters {
  const channelOptions = Array.from(
    new Map(
      channelCampaigns.map((campaign) => [
        campaign.channel,
        { id: campaign.channel, label: channelLabel(campaign.channel) },
      ]),
    ).values(),
  );
  const statusOptions = Array.from(
    new Map(
      statusCampaigns.map((campaign) => [
        campaign.status.value,
        {
          id: campaign.status.value,
          label: statusLabel(campaign.status.value),
        },
      ]),
    ).values(),
  );
  return {
    channel: selectedChannel ?? "__all__",
    status: selectedStatus ?? "__all__",
    channelOptions,
    statusOptions,
  };
}

export function emptyCockpitView(
  window: { from: string; to: string },
  comparison: { kind: "period"; from: string; to: string },
) {
  return {
    period: {
      label: `${WINDOW_DAYS} jours calendaires inclusifs`,
      startLabel: formatDate(window.from),
      endLabel: formatDate(window.to),
      comparison: {
        label: `${WINDOW_DAYS} jours précédents`,
        startLabel: formatDate(comparison.from),
        endLabel: formatDate(comparison.to),
      },
    } satisfies CampaignDecisionPeriod,
    kpis: [] as CampaignObservedKpi[],
    deliveryDiagnostic: null as CampaignDeliveryReading | null,
    recommendation: null as CampaignPriorityRecommendation | null,
    campaigns: [] as CampaignDecisionRow[],
    pastAttempts: [] as CampaignPastAttempt[],
    dailySummary: null as CampaignDailySummary | null,
    activity: [] as CampaignActivityEvent[],
  };
}

export function presentPeriod(cockpit: CampaignCockpit): CampaignDecisionPeriod {
  const comparison = cockpit.comparisonPeriod;
  return {
    label: `${WINDOW_DAYS} jours calendaires inclusifs`,
    startLabel: formatDate(cockpit.window.from),
    endLabel: formatDate(cockpit.window.to),
    comparison:
      comparison.kind === "period"
        ? {
            label: `${WINDOW_DAYS} jours précédents`,
            startLabel: formatDate(comparison.from),
            endLabel: formatDate(comparison.to),
          }
        : null,
    comparisonUnavailableReason:
      cockpit.comparison.status === "unavailable"
        ? comparisonReason(cockpit.comparison)
        : undefined,
  };
}
