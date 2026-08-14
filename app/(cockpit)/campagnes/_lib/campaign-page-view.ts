import { buildCampaignCockpit } from "@/lib/campaign-cockpit";
import {
  CAMPAIGN_ANALYTIC_QUESTIONS,
  answerCampaignAnalyticQuestion,
  buildCampaignWeeklyReport,
} from "@/lib/campaign-insights";
import { emptyCockpitView, presentCockpit, presentFilters } from "./campaign-cockpit-presentation";
import { campaignChannel, campaignStatus, datasetNotice, prospectDatasetLabel } from "./campaign-labels";
import { presentOperationalSummary } from "./campaign-operational-presentation";
import type { CampaignSearchParam } from "./campaign-page-constants";
import type { CampaignPageSnapshot } from "./campaign-page-query";
import { presentWeeklyInsights, unavailableWeeklyInsights } from "./campaign-weekly-presentation";
import { presentBudgetResults } from "./budget-results-presentation";

export function buildCampaignPageView(
  snapshot: CampaignPageSnapshot,
  requestedChannelValue: CampaignSearchParam,
  requestedStatusValue: CampaignSearchParam,
) {
  const { snapshotInput, weeklyWindow, weeklyComparison } = snapshot;
  const baseResult = buildCampaignCockpit({
    ...snapshotInput,
    filters: { channels: "all", statuses: "all" },
  });
  const allCampaigns = baseResult.ok ? baseResult.cockpit.campaigns : [];
  const sourceCampaigns = allCampaigns.filter(
    (campaign) => campaign.performance !== null,
  );
  const availableChannels = new Set(
    sourceCampaigns.map((campaign) => campaign.channel),
  );
  const availableStatuses = new Set(
    allCampaigns.map((campaign) => campaign.status.value),
  );
  const requestedChannel = campaignChannel(requestedChannelValue);
  const requestedStatus = campaignStatus(requestedStatusValue);
  const selectedChannel = requestedChannel && availableChannels.has(requestedChannel)
    ? requestedChannel
    : null;
  const selectedStatus = requestedStatus && availableStatuses.has(requestedStatus)
    ? requestedStatus
    : null;
  const selectedFilters = {
    channels: selectedChannel ? [selectedChannel] : "all",
    statuses: selectedStatus ? [selectedStatus] : "all",
  } as const;
  const result = baseResult.ok && (selectedChannel || selectedStatus)
    ? buildCampaignCockpit({ ...snapshotInput, filters: selectedFilters })
    : baseResult;
  const weeklyResult = buildCampaignCockpit({
    ...snapshotInput,
    window: weeklyWindow,
    comparison: weeklyComparison,
    filters: selectedFilters,
  });

  const queryIncomplete =
    !snapshot.metricsComplete ||
    !snapshot.actionsComplete ||
    !snapshot.linkedJournalComplete ||
    !snapshot.statusJournalComplete;
  const cockpit = result.ok ? result.cockpit : null;
  const view = cockpit
    ? presentCockpit(cockpit, snapshot.demoSnapshot.presentation)
    : emptyCockpitView(snapshot.window, snapshot.comparison);
  const filters = presentFilters(
    sourceCampaigns,
    allCampaigns,
    selectedChannel,
    selectedStatus,
  );
  const hasActiveCockpitFilter = selectedChannel !== null || selectedStatus !== null;
  const dataState = queryIncomplete
    ? {
        kind: "insufficient" as const,
        description: "La lecture des métriques ou de leur journal est indisponible ou tronquée. Aucun total partiel n’est présenté comme complet.",
      }
    : !result.ok
      ? {
          kind: "insufficient" as const,
          description: `Le snapshot CAMP-2 a été refusé (${result.error}). Aucune valeur ambiguë n’est affichée.`,
        }
      : hasActiveCockpitFilter && result.cockpit.campaigns.length === 0
        ? {
            kind: "empty" as const,
            code: "empty_filter_result" as const,
            description: "Aucune campagne ne correspond aux filtres serveur sélectionnés.",
          }
        : result.cockpit.campaigns.length === 0 && result.cockpit.history.attempts.length === 0
          ? {
              kind: "empty" as const,
              description: "Aucune métrique ni décision de campagne sourcée n’est disponible pour cette organisation.",
            }
          : { kind: "ready" as const };
  const operationalSummary = presentOperationalSummary(
    snapshot.agentControlResult,
    snapshot.connectorsResult,
    snapshot.analysisJournalResult,
  );
  const budgetResults = presentBudgetResults(
    snapshot.budgetResultsData,
    snapshot.organizationId,
    snapshot.asOf,
  );
  const weeklyInsights = weeklyResult.ok
    ? presentWeeklyInsights(
        buildCampaignWeeklyReport(weeklyResult.cockpit),
        CAMPAIGN_ANALYTIC_QUESTIONS.map((question) => ({
          question,
          result: answerCampaignAnalyticQuestion(weeklyResult.cockpit, question.id),
        })),
        snapshot.demoSnapshot.presentation,
      )
    : unavailableWeeklyInsights(
        weeklyWindow,
        weeklyComparison,
        `Le snapshot hebdomadaire a été refusé (${weeklyResult.error}). Aucun résultat partiel n’est présenté.`,
      );

  return {
    view,
    dataState,
    filters,
    operationalSummary,
    weeklyInsights,
    budgetResults,
    prospectSearch: snapshot.prospectSearch,
    prospectPresentation: prospectDatasetLabel(snapshot.demoSnapshot.presentation),
    footerNotice: datasetNotice(
      snapshot.demoSnapshot.presentation,
      snapshot.demoSnapshot.evidence.evidenceComplete,
    ),
  };
}
