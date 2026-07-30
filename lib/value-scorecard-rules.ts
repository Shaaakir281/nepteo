/**
 * Agrégats de preuve terrain du pilote.
 *
 * Cette fonction ne fait aucun I/O et ne transforme jamais une déclaration
 * manuelle en statut fournisseur. Les événements de démonstration sont exclus
 * ici en plus des protections de lecture appliquées par l'appelant.
 */

export interface ValueEventForScorecard {
  id: string;
  action_id: string | null;
  prospect_id: string | null;
  actor_id: string | null;
  event_type: string;
  source: string;
  is_demo: boolean;
  false_positive_reason: string | null;
  edit_level: string | null;
  occurred_at: string;
}

export interface ValueRate {
  numerator: number;
  denominator: number;
  /** Pourcentage arrondi à un chiffre après la virgule, ou null sans donnée. */
  percentage: number | null;
}

export interface OutcomeSourceCounts {
  /** Couples action + prospect distincts, toutes sources confondues. */
  total: number;
  /** Déclarations saisies par un testeur (`source = manual`). */
  declared: number;
  /** Faits observés par Gmail ou Microsoft, sans les assimiler aux déclarations. */
  observed: number;
}

export interface ValueScorecard {
  recommendations: {
    examined: number;
    useful: number;
    notUseful: number;
    falsePositives: number;
    rejected: number;
    missingContextRejections: number;
    usefulRate: ValueRate;
    notUsefulRate: ValueRate;
    falsePositiveRate: ValueRate;
    missingContextRate: ValueRate;
  };
  drafts: {
    examined: number;
    none: number;
    light: number;
    significant: number;
    noneOrLight: number;
    noneOrLightRate: ValueRate;
  };
  outcomes: {
    manualFollowupsDeclared: number;
    replies: OutcomeSourceCounts;
    meetings: OutcomeSourceCounts;
    opportunities: OutcomeSourceCounts;
    downstreamSignals: number;
  };
  testers: number;
  excludedDemoEvents: number;
  unlinked: {
    /**
     * Les événements orphelins sont comptés séparément par identifiant.
     * Ils ne sont jamais regroupés sous une fausse action/prospect « null ».
     */
    recommendationEvents: number;
    draftEvents: number;
    outcomeEvents: number;
  };
  gates: {
    /** Volume visible dans cette organisation, sans prétendre agréger le programme. */
    localRecommendationVolume: boolean;
    qualitativeVolume: boolean;
    longitudinalVolume: boolean;
    utilityTarget: boolean;
    falsePositiveTarget: boolean;
    draftTarget: boolean;
    manualFollowupsTarget: boolean;
    downstreamSignal: boolean;
    missingContextSignal: boolean;
    /**
     * Uniquement les métriques calculables depuis value_events.
     * La durée, les incidents, le RGPD et l'autorisation restent des gates
     * séparés et humains.
     */
    c7MeasuredCriteria: boolean;
  };
  metricSignal: "insufficient_data" | "accelerate" | "iterate" | "pivot";
}

const VERDICT_TYPES = new Set([
  "suggestion_useful",
  "suggestion_not_useful",
  "false_positive",
]);

const OUTCOME_TYPES = new Set([
  "manual_followup_sent",
  "reply_received",
  "meeting_booked",
  "opportunity_created",
]);

function normalizedId(value: string | null): string | null {
  const id = value?.trim().toLowerCase();
  return id ? id : null;
}

function actionKey(event: ValueEventForScorecard): string {
  const actionId = normalizedId(event.action_id);
  return actionId ? `action:${actionId}` : `event:${event.id}`;
}

function actionProspectKey(event: ValueEventForScorecard): string {
  const actionId = normalizedId(event.action_id);
  const prospectId = normalizedId(event.prospect_id);
  return actionId && prospectId
    ? `action:${actionId}:prospect:${prospectId}`
    : `event:${event.id}`;
}

function occurredAtMs(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/** Retourne true si candidate corrige current selon occurred_at, puis id. */
function isLater(
  candidate: ValueEventForScorecard,
  current: ValueEventForScorecard,
): boolean {
  const candidateTime = occurredAtMs(candidate.occurred_at);
  const currentTime = occurredAtMs(current.occurred_at);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return candidate.id.localeCompare(current.id) > 0;
}

function latestByAction(
  events: readonly ValueEventForScorecard[],
): Map<string, ValueEventForScorecard> {
  const latest = new Map<string, ValueEventForScorecard>();
  for (const event of events) {
    const key = actionKey(event);
    const current = latest.get(key);
    if (!current || isLater(event, current)) latest.set(key, event);
  }
  return latest;
}

function rate(numerator: number, denominator: number): ValueRate {
  return {
    numerator,
    denominator,
    percentage:
      denominator === 0
        ? null
        : Math.round((numerator / denominator) * 1_000) / 10,
  };
}

function outcomeCounts(
  events: readonly ValueEventForScorecard[],
  eventType: string,
): OutcomeSourceCounts {
  const all = new Set<string>();
  const declared = new Set<string>();
  const observed = new Set<string>();

  for (const event of events) {
    if (event.event_type !== eventType) continue;
    const key = actionProspectKey(event);
    all.add(key);
    if (event.source === "manual") declared.add(key);
    if (event.source === "gmail" || event.source === "microsoft") {
      observed.add(key);
    }
  }

  return {
    total: all.size,
    declared: declared.size,
    observed: observed.size,
  };
}

export function buildValueScorecard(
  input: readonly ValueEventForScorecard[],
): ValueScorecard {
  const events = input.filter((event) => event.is_demo !== true);
  const excludedDemoEvents = input.length - events.length;

  const verdictEvents = events.filter((event) =>
    VERDICT_TYPES.has(event.event_type),
  );
  const latestVerdicts = [...latestByAction(verdictEvents).values()];
  const examined = latestVerdicts.length;
  const useful = latestVerdicts.filter(
    (event) => event.event_type === "suggestion_useful",
  ).length;
  const notUseful = latestVerdicts.filter(
    (event) => event.event_type === "suggestion_not_useful",
  ).length;
  const falsePositives = latestVerdicts.filter(
    (event) => event.event_type === "false_positive",
  ).length;
  const rejected = notUseful + falsePositives;
  const missingContextRejections = latestVerdicts.filter(
    (event) =>
      event.event_type === "false_positive" &&
      event.false_positive_reason === "missing_context",
  ).length;

  const draftEvents = events.filter(
    (event) => event.event_type === "draft_reviewed",
  );
  const latestDrafts = [...latestByAction(draftEvents).values()];
  const none = latestDrafts.filter((event) => event.edit_level === "none").length;
  const light = latestDrafts.filter(
    (event) => event.edit_level === "light",
  ).length;
  const significant = latestDrafts.filter(
    (event) => event.edit_level === "significant",
  ).length;
  const noneOrLight = none + light;

  const outcomeEvents = events.filter((event) =>
    OUTCOME_TYPES.has(event.event_type),
  );
  const manualFollowupsDeclared = new Set(
    outcomeEvents
      .filter(
        (event) =>
          event.event_type === "manual_followup_sent" &&
          event.source === "manual",
      )
      .map(actionProspectKey),
  ).size;
  const replies = outcomeCounts(outcomeEvents, "reply_received");
  const meetings = outcomeCounts(outcomeEvents, "meeting_booked");
  const opportunities = outcomeCounts(
    outcomeEvents,
    "opportunity_created",
  );
  const downstreamSignals =
    replies.total + meetings.total + opportunities.total;

  const testers = new Set(
    latestVerdicts
      .map((event) => normalizedId(event.actor_id))
      .filter((actorId): actorId is string => actorId !== null),
  ).size;

  const usefulRate = rate(useful, examined);
  const notUsefulRate = rate(notUseful, examined);
  const falsePositiveRate = rate(falsePositives, examined);
  const missingContextRate = rate(missingContextRejections, rejected);
  const noneOrLightRate = rate(noneOrLight, latestDrafts.length);

  const qualitativeVolume = testers >= 3 && examined >= 30;
  const localRecommendationVolume = examined >= 30;
  const longitudinalVolume = examined >= 50;
  // Les portes comparent les fractions exactes, pas le pourcentage arrondi
  // destiné à l'affichage : 59,96 % ne doit pas franchir un seuil à 60 %.
  const utilityTarget = examined > 0 && useful / examined >= 0.6;
  const falsePositiveTarget =
    examined > 0 && falsePositives / examined < 0.15;
  const draftTarget =
    latestDrafts.length > 0 && noneOrLight / latestDrafts.length >= 0.6;
  const manualFollowupsTarget = manualFollowupsDeclared >= 20;
  const downstreamSignal = downstreamSignals > 0;
  const missingContextSignal =
    rejected > 0 && missingContextRejections / rejected >= 0.3;

  let metricSignal: ValueScorecard["metricSignal"] = "insufficient_data";
  if (longitudinalVolume) {
    if (utilityTarget && falsePositiveTarget) metricSignal = "accelerate";
    else if (useful / examined < 0.4) {
      metricSignal = "pivot";
    } else {
      metricSignal = "iterate";
    }
  }

  return {
    recommendations: {
      examined,
      useful,
      notUseful,
      falsePositives,
      rejected,
      missingContextRejections,
      usefulRate,
      notUsefulRate,
      falsePositiveRate,
      missingContextRate,
    },
    drafts: {
      examined: latestDrafts.length,
      none,
      light,
      significant,
      noneOrLight,
      noneOrLightRate,
    },
    outcomes: {
      manualFollowupsDeclared,
      replies,
      meetings,
      opportunities,
      downstreamSignals,
    },
    testers,
    excludedDemoEvents,
    unlinked: {
      recommendationEvents: verdictEvents.filter(
        (event) => normalizedId(event.action_id) === null,
      ).length,
      draftEvents: draftEvents.filter(
        (event) => normalizedId(event.action_id) === null,
      ).length,
      outcomeEvents: outcomeEvents.filter(
        (event) =>
          normalizedId(event.action_id) === null ||
          normalizedId(event.prospect_id) === null,
      ).length,
    },
    gates: {
      localRecommendationVolume,
      qualitativeVolume,
      longitudinalVolume,
      utilityTarget,
      falsePositiveTarget,
      draftTarget,
      manualFollowupsTarget,
      downstreamSignal,
      missingContextSignal,
      c7MeasuredCriteria:
        longitudinalVolume &&
        utilityTarget &&
        falsePositiveTarget &&
        manualFollowupsTarget &&
        downstreamSignal,
    },
    metricSignal,
  };
}
