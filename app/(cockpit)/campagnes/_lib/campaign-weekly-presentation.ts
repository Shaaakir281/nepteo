import { CAMPAIGN_ANALYTIC_QUESTIONS, type AnswerCampaignAnalyticQuestionResult, type CampaignWeeklyReport } from "@/lib/campaign-insights";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignEvidenceReference, CampaignWeeklyInsights } from "../_components/campaign-decision-types";
import { formatCtr, integer, money } from "./campaign-formatters";
import { deliveryDirectionLabel, formatWeeklyChange, formatWeeklyDeliveryChange, formatWeeklyDeliveryMetric, rangeLabel, weeklyCoverage, weeklyEvidence, weeklyMetricViews, weeklySourceDetail, weeklyUnavailableReason } from "./campaign-weekly-metrics";
export function presentWeeklyInsights(
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
export function unavailableWeeklyInsights(
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
