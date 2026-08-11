import type { CampaignAttempt, CampaignCockpit } from "@/lib/campaign-cockpit";
import { campaignDecisionWatch } from "@/lib/campaign-decision-watch";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import type { CampaignActivityEvent, CampaignDailySummary, CampaignPastAttempt } from "../_components/campaign-decision-types";
import { formatDateTime, integer, money } from "./campaign-formatters";
import { evidenceForMetrics } from "./campaign-kpi-presentation";
import { attemptOutcome, channelLabel, journalEventDetail, journalEventLabel, unlinkedJournalEventDetail } from "./campaign-labels";

export function presentAttempts(attempts: CampaignAttempt[]): CampaignPastAttempt[] {
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

export function attemptChannel(attempt: CampaignAttempt): CampaignPastAttempt["channel"] {
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

export function presentActivity(
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

export function presentDailySummary(
  cockpit: CampaignCockpit,
  presentation: DemoPresentation,
): CampaignDailySummary | null {
  if (cockpit.totals.status !== "available") return null;
  const { metrics, source } = cockpit.totals;
  const measuredCampaigns = cockpit.campaigns.filter(
    (campaign) => campaign.performance?.scope === "selected_window",
  ).length;
  return {
    title: "Aucune décision prioritaire avec les données disponibles",
    text: `${campaignCountLabel(measuredCampaigns)} sur la période : ${money.format(metrics.spend)} de dépense, ${integer.format(metrics.conversions)} ${metrics.conversions === 1 ? "conversion" : "conversions"} et ${money.format(metrics.revenue)} de revenu enregistrés.`,
    watch: campaignDecisionWatch(cockpit.comparison),
    source: evidenceForMetrics(source, presentation),
  };
}

function campaignCountLabel(value: number): string {
  return value === 1 ? "1 campagne mesurée" : `${integer.format(value)} campagnes mesurées`;
}
