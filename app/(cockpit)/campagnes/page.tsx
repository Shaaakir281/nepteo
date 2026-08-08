import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  CAMPAIGN_COCKPIT_CHANNELS,
  CAMPAIGN_COCKPIT_STATUSES,
  buildCampaignCockpit,
  type CampaignAttempt,
  type CampaignCockpitChannel,
  type CampaignCockpit,
  type CampaignCockpitItem,
  type CampaignCockpitStatus,
  type CampaignComparisonResult,
  type CampaignDeliveryDiagnostic,
  type CampaignStatusEvidence as DomainStatusEvidence,
  type ObservedDeliveryChange,
  type ObservedDeliveryMetric,
  type ObservedMetricsSource,
} from "@/lib/campaign-cockpit";
import {
  CAMPAIGN_ANALYTIC_QUESTIONS,
  answerCampaignAnalyticQuestion,
  buildCampaignWeeklyReport,
  type AnswerCampaignAnalyticQuestionResult,
  type CampaignWeeklyReport,
} from "@/lib/campaign-insights";
import { readDemoPresentation } from "@/lib/demo/presentation";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import { DEMO_PROVIDER } from "@/lib/demo/isolation-rules";
import { analyzeAdsForm } from "./actions";
import {
  CampaignDecisionCockpit,
  type CampaignActivityEvent,
  type CampaignAgentReading,
  type CampaignCockpitFilters,
  type CampaignDailySummary,
  type CampaignDecisionPeriod,
  type CampaignDecisionRow,
  type CampaignDeliveryReading,
  type CampaignEvidenceReference,
  type CampaignObservedKpi,
  type CampaignOperationalSummary,
  type CampaignPastAttempt,
  type CampaignPriorityRecommendation,
  type CampaignProspectSearch,
  type CampaignTone,
  type CampaignWeeklyInsights,
} from "./_components/campaign-decision-cockpit";
import { NewCampaignModal } from "./_components/new-campaign-modal";

const METRIC_ROW_LIMIT = 5_000;
const ACTION_ROW_LIMIT = 200;
const JOURNAL_ROW_LIMIT = 500;
const CONNECTOR_ROW_LIMIT = 100;
const PROSPECT_SEARCH_LIMIT = 20;
const PROSPECT_QUERY_MIN_LENGTH = 2;
const PROSPECT_QUERY_MAX_LENGTH = 80;
const WINDOW_DAYS = 30;
const WEEKLY_WINDOW_DAYS = 7;

type CampaignSearchParam = string | string[] | undefined;

type CampaignPageSupabase = Awaited<
  ReturnType<typeof getCurrentAuthContext>
>["supabase"];

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<{
    proposed?: string | string[];
    channel?: string | string[];
    status?: string | string[];
    prospect?: string | string[];
  }>;
}) {
  const {
    proposed: requestedProposedValue,
    channel: requestedChannelValue,
    status: requestedStatusValue,
    prospect: requestedProspectValue,
  } = await searchParams;
  const proposed = scalarSearchParam(requestedProposedValue);
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canViewFinancials) redirect("/");

  const canEdit = membership.canEdit;
  const organizationId = membership.organizationId;
  const today = new Date();
  const window = {
    from: isoDaysAgo(today, WINDOW_DAYS - 1),
    to: isoDaysAgo(today, 0),
  };
  const comparison = {
    kind: "period" as const,
    from: isoDaysAgo(today, WINDOW_DAYS * 2 - 1),
    to: isoDaysAgo(today, WINDOW_DAYS),
  };
  const weeklyWindow = {
    from: isoDaysAgo(today, WEEKLY_WINDOW_DAYS - 1),
    to: isoDaysAgo(today, 0),
  };
  const weeklyComparison = {
    kind: "period" as const,
    from: isoDaysAgo(today, WEEKLY_WINDOW_DAYS * 2 - 1),
    to: isoDaysAgo(today, WEEKLY_WINDOW_DAYS),
  };

  const [
    metricsResult,
    actionsResult,
    statusJournalResult,
    demoSnapshot,
    connectorsResult,
    agentControlResult,
    analysisJournalResult,
    prospectSearch,
  ] =
    await Promise.all([
      supabase
        .from("ad_metrics")
        .select(
          "provider, campaign_id, campaign_name, date, impressions, clicks, spend, conversions, revenue, synced_at",
          { count: "exact" },
        )
        .eq("organization_id", organizationId)
        .order("date", { ascending: false })
        .limit(METRIC_ROW_LIMIT),
      supabase
        .from("actions")
        .select(
          "id, kind, title, status, created_at, decided_at, decision_reason, confidence, data_sources, payload",
          { count: "exact" },
        )
        .eq("organization_id", organizationId)
        .or("kind.eq.launch_campaign,kind.like.ads\\_%")
        .order("created_at", { ascending: false })
        .limit(ACTION_ROW_LIMIT),
      supabase
        .from("journal")
        .select("id, action_id, event, created_at, payload", {
          count: "exact",
        })
        .eq("organization_id", organizationId)
        .is("action_id", null)
        .in("event", [
          "campaign_blocked",
          "campaign_waiting",
          "campaign_status_cleared",
        ])
        .order("created_at", { ascending: false })
        .limit(JOURNAL_ROW_LIMIT),
      readDemoPresentation(organizationId),
      supabase
        .from("connectors")
        .select("provider, status", { count: "exact" })
        .eq("organization_id", organizationId)
        .neq("provider", DEMO_PROVIDER)
        .order("provider", { ascending: true })
        .limit(CONNECTOR_ROW_LIMIT),
      supabase
        .from("organizations")
        .select("id, execution_paused, autonomy_level", { count: "exact" })
        .eq("id", organizationId)
        .order("id", { ascending: true })
        .limit(1),
      supabase
        .from("journal")
        .select("id, created_at, actor")
        .eq("organization_id", organizationId)
        .eq("event", "analysis_run")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1),
      readProspectSearch(
        supabase,
        organizationId,
        requestedProspectValue,
      ),
    ]);

  const actionsComplete = completeRead(actionsResult, ACTION_ROW_LIMIT);
  const actionIds = actionsComplete
    ? actionsResult.data.map((action) => action.id)
    : [];
  const journalResult =
    actionsComplete && actionIds.length > 0
      ? await supabase
          .from("journal")
          .select("id, action_id, event, created_at, payload", {
            count: "exact",
          })
          .eq("organization_id", organizationId)
          .in("action_id", actionIds)
          .order("created_at", { ascending: false })
          .limit(JOURNAL_ROW_LIMIT)
      : actionsComplete
        ? { data: [], error: null, count: 0 }
        : { data: null, error: actionsResult.error, count: null };

  const metricsComplete = completeRead(metricsResult, METRIC_ROW_LIMIT);
  const linkedJournalComplete = completeRead(journalResult, JOURNAL_ROW_LIMIT);
  const statusJournalComplete = completeRead(
    statusJournalResult,
    JOURNAL_ROW_LIMIT,
  );
  const journalRows =
    linkedJournalComplete && statusJournalComplete
      ? Array.from(
          new Map(
            [...journalResult.data, ...statusJournalResult.data].map((entry) => [
              entry.id,
              entry,
            ]),
          ).values(),
        )
      : null;
  const snapshotInput = {
    rows: metricsComplete ? metricsResult.data : null,
    actions: actionsComplete ? actionsResult.data : null,
    journal: journalRows,
    // Le schéma actuel ne stocke aucun statut fournisseur relu. Laisser ce
    // tableau vide interdit explicitement de déduire active/terminée des dates.
    providerStatuses: [],
    window,
    comparison,
  };
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
  const selectedChannel =
    requestedChannel && availableChannels.has(requestedChannel)
      ? requestedChannel
      : null;
  const selectedStatus =
    requestedStatus && availableStatuses.has(requestedStatus)
      ? requestedStatus
      : null;
  const selectedFilters = {
    channels: selectedChannel ? [selectedChannel] : "all",
    statuses: selectedStatus ? [selectedStatus] : "all",
  } as const;
  const result =
    baseResult.ok && (selectedChannel || selectedStatus)
      ? buildCampaignCockpit({
          ...snapshotInput,
          filters: selectedFilters,
        })
      : baseResult;
  const weeklyResult = buildCampaignCockpit({
    ...snapshotInput,
    window: weeklyWindow,
    comparison: weeklyComparison,
    filters: selectedFilters,
  });

  const queryIncomplete =
    !metricsComplete ||
    !actionsComplete ||
    !linkedJournalComplete ||
    !statusJournalComplete;
  const cockpit = result.ok ? result.cockpit : null;
  const view = cockpit
    ? presentCockpit(cockpit, demoSnapshot.presentation)
    : emptyCockpitView(window, comparison);
  const filters = presentFilters(
    sourceCampaigns,
    allCampaigns,
    selectedChannel,
    selectedStatus,
  );
  const hasActiveCockpitFilter =
    selectedChannel !== null || selectedStatus !== null;
  const dataState = queryIncomplete
    ? {
        kind: "insufficient" as const,
        description:
          "La lecture des métriques ou de leur journal est indisponible ou tronquée. Aucun total partiel n’est présenté comme complet.",
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
            description:
              "Aucune campagne ne correspond aux filtres serveur sélectionnés.",
          }
        : result.cockpit.campaigns.length === 0 &&
          result.cockpit.history.attempts.length === 0
        ? {
            kind: "empty" as const,
            description:
              "Aucune métrique ni décision de campagne sourcée n’est disponible pour cette organisation.",
          }
        : { kind: "ready" as const };
  const operationalSummary = presentOperationalSummary(
    agentControlResult,
    connectorsResult,
    analysisJournalResult,
  );
  const weeklyInsights = weeklyResult.ok
    ? presentWeeklyInsights(
        buildCampaignWeeklyReport(weeklyResult.cockpit),
        CAMPAIGN_ANALYTIC_QUESTIONS.map((question) => ({
          question,
          result: answerCampaignAnalyticQuestion(
            weeklyResult.cockpit,
            question.id,
          ),
        })),
        demoSnapshot.presentation,
      )
    : unavailableWeeklyInsights(
        weeklyWindow,
        weeklyComparison,
        `Le snapshot hebdomadaire a été refusé (${weeklyResult.error}). Aucun résultat partiel n’est présenté.`,
      );

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Campagnes</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Décidez à partir des métriques enregistrées, avec leur période et
            leur provenance. Aucun statut fournisseur n’est supposé.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/contenu"
              className="rounded-[10px] border border-line px-3.5 py-2 text-[12.5px] font-semibold text-body transition hover:bg-tint-soft hover:text-ink"
            >
              Idées de contenu
            </Link>
            <NewCampaignModal />
            {metricsComplete && metricsResult.data.length > 0 && (
              <form action={analyzeAdsForm}>
                <button
                  type="submit"
                  title="Proposer une revue humaine à partir des métriques observées"
                  className="rounded-[10px] bg-tint px-3.5 py-2 text-[12.5px] font-semibold text-violet transition hover:bg-violet hover:text-white"
                >
                  Analyser
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <AnalysisNotice proposed={proposed} />

      <CampaignDecisionCockpit
        {...view}
        dataState={dataState}
        filters={filters}
        operationalSummary={operationalSummary}
        prospectSearch={prospectSearch}
        prospectPresentation={prospectDatasetLabel(demoSnapshot.presentation)}
        weeklyInsights={weeklyInsights}
      />

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        {datasetNotice(
          demoSnapshot.presentation,
          demoSnapshot.evidence.evidenceComplete,
        )}{" "}
        CAMP-2 ne lance, ne met en pause et ne dépense rien : toute recommandation
        rejoint uniquement la file de validation Aujourd&apos;hui.
      </p>
    </>
  );
}

function AnalysisNotice({ proposed }: { proposed?: string }) {
  if (proposed === undefined) return null;
  if (
    proposed !== "err" &&
    proposed !== "0" &&
    !/^(?:[1-9]|1\d|20)$/.test(proposed)
  ) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-tint-soft px-4 py-3">
      <span className="text-[13px] text-body">
        Signal de retour d&apos;analyse reçu ({proposed}). Ce paramètre d&apos;URL
        n&apos;est pas une preuve : seules les actions et leurs journaux enregistrés
        dans Aujourd&apos;hui font foi.
      </span>
      <Link href="/" className="rounded-[9px] bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep">
        Examiner sur Aujourd&apos;hui →
      </Link>
    </div>
  );
}

function presentCockpit(cockpit: CampaignCockpit, presentation: DemoPresentation) {
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

function presentWeeklyInsights(
  report: CampaignWeeklyReport,
  answers: Array<{
    question: (typeof CAMPAIGN_ANALYTIC_QUESTIONS)[number];
    result: AnswerCampaignAnalyticQuestionResult;
  }>,
  presentation: DemoPresentation,
): CampaignWeeklyInsights {
  const source = weeklyEvidence(report.source, report.period, presentation);
  const sourceDetail = weeklySourceDetail(report.source);
  const currentPeriodLabel = rangeLabel(report.period.current);
  const previousPeriodLabel = report.period.previous
    ? rangeLabel(report.period.previous)
    : null;
  return {
    report: report.status === "available"
      ? {
          state: "available",
          reason: null,
          currentPeriodLabel,
          previousPeriodLabel,
          source,
          sourceDetail,
          metrics: weeklyMetricViews(report),
          coverage: weeklyCoverage(report),
        }
      : {
          state: "unavailable",
          reason: weeklyUnavailableReason(report.reason),
          currentPeriodLabel,
          previousPeriodLabel,
          source,
          sourceDetail,
          metrics: [],
          coverage: null,
        },
    questions: answers.map(({ question, result }) =>
      presentWeeklyQuestion(question, result, presentation)),
  };
}

function unavailableWeeklyInsights(
  window: { from: string; to: string },
  comparison: { kind: "period"; from: string; to: string },
  reason: string,
): CampaignWeeklyInsights {
  const currentPeriodLabel = rangeLabel(window);
  const previousPeriodLabel = rangeLabel(comparison);
  return {
    report: {
      state: "unavailable",
      reason,
      currentPeriodLabel,
      previousPeriodLabel,
      source: null,
      sourceDetail: "Dénominateurs indisponibles : le snapshot complet n’a pas été construit.",
      metrics: [],
      coverage: null,
    },
    questions: CAMPAIGN_ANALYTIC_QUESTIONS.map((question) => ({
      id: question.id,
      label: question.label,
      answer: {
        state: "unavailable",
        summary: reason,
        details: [],
        periodLabel: `${currentPeriodLabel} · comparaison ${previousPeriodLabel}`,
        source: null,
        sourceDetail: "Dénominateurs indisponibles : aucune réponse partielle n’est présentée.",
      },
    })),
  };
}

function presentWeeklyQuestion(
  question: (typeof CAMPAIGN_ANALYTIC_QUESTIONS)[number],
  result: AnswerCampaignAnalyticQuestionResult,
  presentation: DemoPresentation,
): CampaignWeeklyInsights["questions"][number] {
  if (!result.ok) {
    return {
      id: question.id,
      label: question.label,
      answer: {
        state: "unavailable",
        summary: "Question non prise en charge par le contrat analytique borné.",
        details: [],
        periodLabel: "Période indisponible",
        source: null,
        sourceDetail: "Aucune source n’est attribuée à une question refusée.",
      },
    };
  }
  const answer = result.answer;
  const source = weeklyEvidence(answer.source, answer.period, presentation);
  const sourceDetail = weeklySourceDetail(answer.source);
  const periodLabel = `${rangeLabel(answer.period.current)} · comparaison ${
    answer.period.previous ? rangeLabel(answer.period.previous) : "indisponible"
  }`;
  if (answer.status === "unavailable") {
    return {
      id: question.id,
      label: question.label,
      answer: {
        state: "unavailable",
        summary: weeklyUnavailableReason(answer.reason),
        details: [],
        periodLabel,
        source,
        sourceDetail,
      },
    };
  }

  if (answer.questionId === "weekly_observed_totals") {
    const metrics = answer.facts.current;
    return weeklyAvailableQuestion(question, periodLabel, source, sourceDetail,
      `${money.format(metrics.spend)} dépensés · ${integer.format(metrics.conversions)} conversions · ${money.format(metrics.revenue)} de revenu enregistrés.`,
      [
        `${integer.format(metrics.impressions)} impressions · ${integer.format(metrics.clicks)} clics.`,
        `CPM : ${formatWeeklyDeliveryMetric(metrics.cpm, "money")} · CTR : ${formatWeeklyDeliveryMetric(metrics.ctr, "percent")}.`,
      ]);
  }
  if (answer.questionId === "weekly_observed_changes") {
    return weeklyAvailableQuestion(question, periodLabel, source, sourceDetail,
      "Variations observées entre les deux fenêtres de 7 jours.",
      [
        `Dépense : ${formatWeeklyChange(answer.facts.changes.spend)} · conversions : ${formatWeeklyChange(answer.facts.changes.conversions)}.`,
        `Revenu : ${formatWeeklyChange(answer.facts.changes.revenue)} · coût / conversion : ${formatWeeklyChange(answer.facts.changes.cac)}.`,
        `ROAS : ${formatWeeklyChange(answer.facts.changes.roas)} · CPM : ${formatWeeklyDeliveryChange(answer.facts.changes.cpm)} · CTR : ${formatWeeklyDeliveryChange(answer.facts.changes.ctr)}.`,
      ]);
  }
  if (answer.questionId === "weekly_delivery_changes") {
    return weeklyAvailableQuestion(question, periodLabel, source, sourceDetail,
      `CPM ${deliveryDirectionLabel(answer.facts.directions.cpm)} ; CTR ${deliveryDirectionLabel(answer.facts.directions.ctr)}.`,
      [
        `CPM : ${money.format(answer.facts.current.cpm)} contre ${money.format(answer.facts.previous.cpm)} (${formatWeeklyChange(answer.facts.changes.cpm)}).`,
        `CTR : ${formatCtr(answer.facts.current.ctr)} contre ${formatCtr(answer.facts.previous.ctr)} (${formatWeeklyChange(answer.facts.changes.ctr)}).`,
        "Comparaison descriptive uniquement ; aucun mécanisme n’est attribué.",
      ]);
  }

  const comparable = answer.facts.comparable;
  const unavailable = answer.facts.unavailable;
  const details = [
    ...comparable.slice(0, 5).map((campaign) =>
      `${campaign.campaignName} : observations présentes dans chacune des deux périodes.`),
    ...unavailable.slice(0, 5).map((campaign) =>
      `${campaign.campaignName} : ${weeklyUnavailableReason(campaign.reason)}.`),
  ];
  if (comparable.length + unavailable.length > details.length) {
    details.push(`${comparable.length + unavailable.length - details.length} autre(s) campagne(s) comptée(s), non détaillée(s) dans ce résumé borné.`);
  }
  return weeklyAvailableQuestion(question, periodLabel, source, sourceDetail,
    `${comparable.length} campagne(s) avec observations dans chacune des deux périodes · ${unavailable.length} sans observations sur chacune des deux périodes.`,
    details);
}

function weeklyAvailableQuestion(
  question: (typeof CAMPAIGN_ANALYTIC_QUESTIONS)[number],
  periodLabel: string,
  source: CampaignEvidenceReference,
  sourceDetail: string,
  summary: string,
  details: string[],
): CampaignWeeklyInsights["questions"][number] {
  return {
    id: question.id,
    label: question.label,
    answer: {
      state: "available",
      summary,
      details,
      periodLabel,
      source,
      sourceDetail,
    },
  };
}

function weeklyMetricViews(
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

function weeklyCoverage(
  report: Extract<CampaignWeeklyReport, { status: "available" }>,
): string {
  const comparable = report.campaigns.filter((campaign) => campaign.status === "available").length;
  const unavailable = report.campaigns.length - comparable;
  return `${report.campaigns.length} campagne(s) incluse(s) : ${comparable} avec des lignes disponibles sur chacune des deux périodes, ${unavailable} sans lignes sur chacune des deux périodes.`;
}

function weeklyEvidence(
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

function weeklySourceDetail(source: CampaignWeeklyReport["source"]): string {
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

function weeklyUnavailableReason(reason: string): string {
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

function formatWeeklyDeliveryMetric(
  metric: ObservedDeliveryMetric,
  format: "money" | "percent",
): string {
  if (metric.status === "unavailable") return "Indisponible";
  return format === "money" ? money.format(metric.value) : formatCtr(metric.value);
}

function formatWeeklyDeliveryChange(change: ObservedDeliveryChange): string {
  return change.status === "available"
    ? formatWeeklyChange(change.value)
    : "Indisponible";
}

function formatWeeklyChange(value: number | null): string {
  if (value === null) return "Indisponible";
  const formatted = decimal.format(Math.abs(value) * 100);
  if (value === 0) return "0 %";
  return `${value > 0 ? "+" : "−"}${formatted} %`;
}

function relativeDifference(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10_000) / 10_000;
}

function deliveryDirectionLabel(direction: "higher" | "lower" | "unchanged"): string {
  if (direction === "higher") return "plus élevé";
  if (direction === "lower") return "plus bas";
  return "inchangé";
}

function rangeLabel(range: { from: string; to: string }): string {
  return `${formatDate(range.from)} → ${formatDate(range.to)}`;
}

function presentFilters(
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

function emptyCockpitView(
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

function presentPeriod(cockpit: CampaignCockpit): CampaignDecisionPeriod {
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

function presentKpis(
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

function presentCampaign(
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

function presentStatus(
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

function presentReading(
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

function presentDeliveryDiagnostic(
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

function deliveryDirectionSummary(
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

function presentRecommendation(
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

function presentAttempts(attempts: CampaignAttempt[]): CampaignPastAttempt[] {
  return attempts
    .filter((attempt) => attempt.status !== "proposed")
    .map((attempt) => {
      const latestEvent = attempt.journalEvents[0];
      return {
        id: attempt.actionId,
        name: attempt.title,
        channel: attemptChannel(attempt),
        periodLabel: formatDateTime(attempt.decidedAt ?? attempt.createdAt),
        outcome: attemptOutcome(attempt),
        learning: attempt.decisionReason,
        source: latestEvent
          ? {
              label: `Journal · ${latestEvent.event}`,
              observedAtLabel: formatDateTime(latestEvent.at),
            }
          : {
              label: `Action enregistrée · statut de décision ${attempt.status}`,
              observedAtLabel: formatDateTime(
                attempt.decidedAt ?? attempt.createdAt,
              ),
            },
      };
    });
}

function attemptChannel(attempt: CampaignAttempt): CampaignPastAttempt["channel"] {
  if (attempt.channel) {
    return {
      id: attempt.channel,
      label: channelLabel(attempt.channel),
    };
  }
  const provider = attempt.campaignKey?.split(":", 1)[0];
  const channels: Record<string, CampaignPastAttempt["channel"]> = {
    meta_ads: { id: "meta", label: "Meta Ads" },
    google_ads: { id: "google", label: "Google Ads" },
    linkedin_ads: { id: "linkedin", label: "LinkedIn Ads" },
    email: { id: "email", label: "Email" },
    outbound_email: { id: "email", label: "Email sortant" },
  };
  return provider && channels[provider]
    ? channels[provider]
    : {
        id: "campaign",
        label:
          attempt.kind === "launch_campaign"
            ? "Campagne proposée"
            : "Campagne documentée",
      };
}

function presentActivity(
  attempts: CampaignAttempt[],
  unlinkedEvents: CampaignCockpit["history"]["unlinkedJournalEvents"],
): CampaignActivityEvent[] {
  const linked = attempts.flatMap((attempt) =>
    attempt.journalEvents.map((event) => ({
      id: event.id,
      title: journalEventLabel(event.event),
      detail: journalEventDetail(event.event, attempt.title),
      at: event.at,
      source: {
        label: `Journal append-only · ${event.event}`,
        observedAtLabel: formatDateTime(event.at),
      },
    })),
  );
  const unlinked = unlinkedEvents.map((event) => ({
    id: event.id,
    title: journalEventLabel(event.event),
    detail: unlinkedJournalEventDetail(event.event),
    at: event.at,
    source: {
      label: `Journal append-only · ${event.event} · sans action liée`,
      observedAtLabel: formatDateTime(event.at),
    },
  }));

  return Array.from(
    new Map([...linked, ...unlinked].map((event) => [event.id, event])).values(),
  )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 20)
    .map(({ at, ...event }) => ({
      ...event,
      atLabel: formatDateTime(at),
    }));
}

function presentDailySummary(
  cockpit: CampaignCockpit,
  presentation: DemoPresentation,
): CampaignDailySummary | null {
  if (cockpit.totals.status !== "available") return null;
  const { metrics, source } = cockpit.totals;
  const measuredCampaigns = cockpit.campaigns.filter(
    (campaign) => campaign.performance?.scope === "selected_window",
  ).length;
  const recommendation = cockpit.recommendation
    ? ` Une priorité sourcée concerne « ${cockpit.recommendation.campaignName} ».`
    : " Aucune priorité supplémentaire n’est étayée par les faits disponibles.";
  return {
    text: `${measuredCampaigns} campagne(s) avec métriques dans la fenêtre, ${money.format(metrics.spend)} de dépense, ${integer.format(metrics.conversions)} conversion(s) et ${money.format(metrics.revenue)} de revenu enregistrés sur cette même fenêtre.${recommendation}`,
    source: evidenceForMetrics(source, presentation),
  };
}

function observedKpi(
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

function unavailableKpi(
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

function comparisonValue(
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

function deliveryComparisonFor(
  comparison: CampaignComparisonResult,
  key: "cpm" | "ctr",
): { value: string; tone?: CampaignTone } | null {
  if (comparison.status !== "available") return null;
  return deliveryComparisonValue(comparison.changes[key]);
}

function deliveryComparisonValue(
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

function evidenceForMetrics(
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

function evidenceForDeliveryDiagnostic(
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

function datasetEvidence(
  presentation: DemoPresentation,
  provider: ObservedMetricsSource["provider"] = "multiple",
): CampaignEvidenceReference {
  const prefix =
    presentation === "certified-demo"
      ? "Scénario d’exemple Nepteo"
      : presentation === "test-environment"
        ? "Environnement de test"
        : "Métriques enregistrées";
  return { label: `${prefix} · ad_metrics · ${providerLabel(provider)}` };
}

function attemptOutcome(attempt: CampaignAttempt): string {
  if (attempt.status === "approved" && attempt.kind === "launch_campaign") {
    return "Validée — non lancée";
  }
  if (attempt.status === "approved" && attempt.kind.startsWith("ads_pause_")) {
    return "Validée — non appliquée";
  }
  if (attempt.status === "executed" && attempt.kind.startsWith("ads_pause_")) {
    return "Trace historique — aucune preuve d’application fournisseur";
  }
  const labels: Record<string, string> = {
    approved: "Validée",
    rejected: "Refusée",
    postponed: "Reportée",
    executed: "Préparée",
    failed: "Échec enregistré",
    proposed: "En attente de décision",
  };
  return labels[attempt.status] ?? attempt.status;
}

function journalEventLabel(event: string): string {
  const labels: Record<string, string> = {
    action_proposed: "Proposition enregistrée",
    action_approved: "Validation enregistrée",
    action_rejected: "Refus enregistré",
    action_postponed: "Report enregistré",
    action_resumed: "Proposition reprise",
    campaign_blocked: "Blocage de campagne enregistré",
    campaign_waiting: "Attente de campagne enregistrée",
    campaign_status_cleared: "État de campagne levé",
  };
  return labels[event] ?? `Événement enregistré · ${event}`;
}

function unlinkedJournalEventDetail(event: string): string {
  if (event === "campaign_blocked") {
    return "Un blocage CAMP-2 a été journalisé sans action associée.";
  }
  if (event === "campaign_waiting") {
    return "Une attente CAMP-2 a été journalisée sans action associée.";
  }
  if (event === "campaign_status_cleared") {
    return "La levée d’un état CAMP-2 a été journalisée sans action associée.";
  }
  return "Cet événement CAMP-2 est enregistré sans action associée.";
}

function journalEventDetail(event: string, title: string): string {
  const subject = `« ${title} »`;
  if (event === "action_proposed") {
    return `${subject} a été ajoutée à la file de validation.`;
  }
  if (event === "action_approved") {
    return `Une validation humaine a été enregistrée pour ${subject} ; aucune application fournisseur n’est déduite.`;
  }
  if (event === "action_rejected") {
    return `Un refus humain a été enregistré pour ${subject}.`;
  }
  if (event === "action_postponed") {
    return `Un report humain a été enregistré pour ${subject}.`;
  }
  if (event === "action_resumed") {
    return `${subject} a été replacée dans la file de validation.`;
  }
  return `${subject} possède cet événement journalisé, sans interprétation supplémentaire.`;
}

function comparisonReason(comparison: CampaignComparisonResult): string {
  if (comparison.status === "available") return "";
  if (comparison.reason === "no_previous_rows") {
    return "Aucune ligne n’est disponible sur la période précédente.";
  }
  if (comparison.reason === "no_current_rows") {
    return "Aucune ligne n’est disponible sur la période courante.";
  }
  return "La comparaison a été désactivée.";
}

function providerLabel(provider: ObservedMetricsSource["provider"]): string {
  const labels: Record<ObservedMetricsSource["provider"], string> = {
    meta_ads: "Meta Ads déclaré",
    google_ads: "Google Ads déclaré",
    linkedin_ads: "LinkedIn Ads déclaré",
    email: "Email déclaré",
    outbound_email: "Email sortant déclaré",
    multiple: "plusieurs sources déclarées",
  };
  return labels[provider];
}

function channelLabel(channel: CampaignCockpitItem["channel"]): string {
  return {
    meta: "Meta Ads",
    google: "Google Ads",
    linkedin: "LinkedIn Ads",
    email: "Email",
  }[channel];
}

function statusLabel(status: CampaignCockpitStatus): string {
  return {
    active: "Active (statut fournisseur)",
    ended: "Terminée (statut fournisseur)",
    waiting: "En attente",
    blocked: "Bloquée",
    recent_data: "Données récentes",
    historical_data: "Historique",
  }[status];
}

function campaignChannel(value: CampaignSearchParam): CampaignCockpitChannel | null {
  return typeof value === "string" &&
    CAMPAIGN_COCKPIT_CHANNELS.includes(value as CampaignCockpitChannel)
    ? (value as CampaignCockpitChannel)
    : null;
}

function campaignStatus(value: CampaignSearchParam): CampaignCockpitStatus | null {
  return typeof value === "string" &&
    CAMPAIGN_COCKPIT_STATUSES.includes(value as CampaignCockpitStatus)
    ? (value as CampaignCockpitStatus)
    : null;
}

function datasetNotice(
  presentation: DemoPresentation,
  evidenceComplete: boolean,
): string {
  if (!evidenceComplete) {
    return "Origine des données incomplètement vérifiable : environnement de test prudent.";
  }
  if (presentation === "certified-demo") {
    return "Données du scénario d’exemple Nepteo, jamais présentées comme terrain réel.";
  }
  if (presentation === "test-environment") {
    return "Environnement de test : vérifiez l’origine avant toute décision terrain.";
  }
  return "Valeurs relues dans ad_metrics ; aucun statut fournisseur actif/terminé n’est disponible.";
}

function prospectDatasetLabel(presentation: DemoPresentation): string {
  if (presentation === "certified-demo") {
    return "Scénario d’exemple Nepteo certifié";
  }
  if (presentation === "test-environment") {
    return "Environnement de test — origine à vérifier";
  }
  return "Données enregistrées de votre organisation";
}

type CountedReadResult = {
  data: unknown[] | null;
  error: unknown;
  count: number | null;
};

interface SafeProspectRow {
  id: string;
  name: string | null;
  company: string | null;
  source: string;
  synced_at: string;
}

function presentOperationalSummary(
  agentControlResult: CountedReadResult,
  connectorsResult: CountedReadResult,
  analysisJournalResult: Omit<CountedReadResult, "count">,
): CampaignOperationalSummary {
  const unavailable = (label: string, detail: string) => ({
    state: "unavailable" as const,
    label,
    value: "Indisponible",
    detail,
  });

  let agent: CampaignOperationalSummary["agent"] = unavailable(
    "État agent",
    "Le contrôle persistant de l’organisation n’a pas pu être relu intégralement.",
  );
  if (completeRead(agentControlResult, 1) && agentControlResult.count === 1) {
    const row = agentControlResult.data[0];
    if (
      isRecord(row) &&
      typeof row.execution_paused === "boolean" &&
      (row.autonomy_level === "suggest" || row.autonomy_level === "prepare")
    ) {
      agent = {
        state: "available",
        label: "État agent",
        value: row.execution_paused
          ? "Contrôle d’exécution suspendu"
          : "Contrôle d’exécution non suspendu",
        detail: `Autonomie persistée : ${
          row.autonomy_level === "suggest"
            ? "suggestion uniquement"
            : "préparation"
        }. Ce contrôle ne prouve aucune activité et ne rend pas CAMP-2 exécutable.`,
      };
    }
  }

  let connectors: CampaignOperationalSummary["connectors"] = unavailable(
    "Connecteurs du tenant",
    "Le nombre exact n’est pas affiché car la lecture a échoué ou dépasse la borne autorisée.",
  );
  if (
    completeRead(connectorsResult, CONNECTOR_ROW_LIMIT) &&
    connectorsResult.data.every(
      (row) =>
        isRecord(row) &&
        typeof row.provider === "string" &&
        row.provider !== DEMO_PROVIDER &&
        (row.status === "connected" ||
          row.status === "disconnected" ||
          row.status === "error"),
    )
  ) {
    const connected = connectorsResult.data.filter(
      (row) => isRecord(row) && row.status === "connected",
    ).length;
    const errors = connectorsResult.data.filter(
      (row) => isRecord(row) && row.status === "error",
    ).length;
    const total = connectorsResult.count;
    connectors = {
      state: "available",
      label: "Connecteurs du tenant",
      value: `${total} hors scénario enregistré${total === 1 ? "" : "s"}`,
      detail: `${connected} connecté${connected > 1 ? "s" : ""} · ${errors} en erreur · connecteur de scénario exclu · lecture complète bornée à ${CONNECTOR_ROW_LIMIT} lignes.`,
    };
  }

  let lastAnalysis: CampaignOperationalSummary["lastAnalysis"] = unavailable(
    "Dernière analyse journalisée",
    "Le journal n’a pas pu être relu ; aucune date n’est supposée.",
  );
  if (
    analysisJournalResult.error === null &&
    Array.isArray(analysisJournalResult.data) &&
    analysisJournalResult.data.length <= 1
  ) {
    const row = analysisJournalResult.data[0];
    if (row === undefined) {
      lastAnalysis = {
        state: "available",
        label: "Dernière analyse journalisée",
        value: "Aucune trace enregistrée",
        detail: "Aucun événement analysis_run n’est présent pour cette organisation.",
      };
    } else if (
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.created_at === "string" &&
      !Number.isNaN(new Date(row.created_at).getTime()) &&
      (row.actor === "agent" || row.actor === "user")
    ) {
      lastAnalysis = {
        state: "available",
        label: "Dernière analyse journalisée",
        value: formatDateTime(row.created_at),
        detail: `Événement analysis_run · acteur ${
          row.actor === "agent" ? "agent" : "utilisateur"
        }. Cette trace indique un démarrage, pas sa réussite.`,
      };
    }
  }

  return { agent, connectors, lastAnalysis };
}

async function readProspectSearch(
  supabase: CampaignPageSupabase,
  organizationId: string,
  requestedValue: CampaignSearchParam,
): Promise<CampaignProspectSearch> {
  if (Array.isArray(requestedValue)) {
    return {
      state: "invalid",
      query: "",
      message: "Un seul paramètre de recherche prospect est accepté.",
      results: [],
    };
  }
  const rawQuery = requestedValue ?? "";
  if (rawQuery.length > PROSPECT_QUERY_MAX_LENGTH) {
    return {
      state: "invalid",
      query: "",
      message: `Saisissez ${PROSPECT_QUERY_MIN_LENGTH} à ${PROSPECT_QUERY_MAX_LENGTH} caractères (lettres, chiffres, espaces, apostrophes ou tirets).`,
      results: [],
    };
  }
  const query = rawQuery.normalize("NFC").trim().replace(/\s+/g, " ");
  if (query === "") {
    return {
      state: "idle",
      query: "",
      message:
        "Recherchez par nom ou société dans les prospects synchronisés de cette organisation.",
      results: [],
    };
  }

  const safeQuery = /^[\p{L}\p{N}][\p{L}\p{N}\s.'&’-]*$/u.test(query);
  if (
    !safeQuery ||
    query.length < PROSPECT_QUERY_MIN_LENGTH ||
    query.length > PROSPECT_QUERY_MAX_LENGTH
  ) {
    return {
      state: "invalid",
      query,
      message: `Saisissez ${PROSPECT_QUERY_MIN_LENGTH} à ${PROSPECT_QUERY_MAX_LENGTH} caractères (lettres, chiffres, espaces, apostrophes ou tirets).`,
      results: [],
    };
  }

  const select = "id, name, company, source, synced_at";
  const pattern = `%${query}%`;
  const [nameResult, companyResult] = await Promise.all([
    supabase
      .from("prospects")
      .select(select, { count: "exact" })
      .eq("organization_id", organizationId)
      .ilike("name", pattern)
      .order("synced_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(PROSPECT_SEARCH_LIMIT),
    supabase
      .from("prospects")
      .select(select, { count: "exact" })
      .eq("organization_id", organizationId)
      .ilike("company", pattern)
      .order("synced_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(PROSPECT_SEARCH_LIMIT),
  ]);

  if (
    !completeRead(nameResult, PROSPECT_SEARCH_LIMIT) ||
    !completeRead(companyResult, PROSPECT_SEARCH_LIMIT)
  ) {
    return {
      state: "unavailable",
      query,
      message:
        "Recherche indisponible ou tronquée : aucun résultat partiel n’est affiché.",
      results: [],
    };
  }

  const rows = Array.from(
    new Map(
      [...nameResult.data, ...companyResult.data].map((row) => [row.id, row]),
    ).values(),
  );
  if (
    rows.length > PROSPECT_SEARCH_LIMIT ||
    !rows.every(isSafeProspectRow)
  ) {
    return {
      state: "unavailable",
      query,
      message:
        "Recherche indisponible ou trop large : précisez les termes, aucune liste partielle n’est affichée.",
      results: [],
    };
  }

  const sortedRows = (rows as SafeProspectRow[]).sort(
    (left, right) =>
      right.synced_at.localeCompare(left.synced_at) ||
      left.id.localeCompare(right.id),
  );
  const results = sortedRows.map((row) => ({
    id: row.id,
    name: row.name?.trim() || "Prospect sans nom enregistré",
    company: row.company?.trim() || null,
    source: row.source,
    syncedAtLabel: formatDateTime(row.synced_at),
  }));
  return {
    state: results.length === 0 ? "empty" : "ready",
    query,
    message:
      results.length === 0
        ? "Aucun prospect synchronisé ne correspond à cette recherche."
        : `${results.length} prospect${results.length > 1 ? "s" : ""} trouvé${results.length > 1 ? "s" : ""} dans la lecture complète.`,
    results,
  };
}

function isSafeProspectRow(row: unknown): row is SafeProspectRow {
  if (!isRecord(row)) return false;
  const syncedAt =
    typeof row.synced_at === "string" ? new Date(row.synced_at) : null;
  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    row.id.length <= 128 &&
    (row.name === null ||
      typeof row.name === "string" && row.name.length <= 200) &&
    (row.company === null ||
      typeof row.company === "string" && row.company.length <= 200) &&
    typeof row.source === "string" &&
    row.source.trim().length > 0 &&
    row.source.length <= 80 &&
    syncedAt !== null &&
    !Number.isNaN(syncedAt.getTime())
  );
}

function scalarSearchParam(value: CampaignSearchParam): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function completeRead<T extends { data: unknown[] | null; error: unknown; count: number | null }>(
  result: T,
  limit: number,
): result is T & { data: NonNullable<T["data"]>; error: null; count: number } {
  return (
    result.error === null &&
    Array.isArray(result.data) &&
    result.count !== null &&
    result.count <= limit &&
    result.count === result.data.length
  );
}

function isoDaysAgo(now: Date, daysAgo: number): string {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return day.format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}

function formatCtr(value: number): string {
  return `${decimal.format(value * 100)} %`;
}
