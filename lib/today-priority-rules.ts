/**
 * File « Aujourd'hui » : classement pur et explicable des propositions déjà
 * présentes. Ce module ne crée aucune action et ne dépend d'aucune I/O.
 */

export const MAX_TODAY_ACTIONS = 5;

export interface TodayPriorityCandidate {
  id: string;
  kind: string;
  created_at: string;
  payload?: Record<string, unknown> | null;
  confidence?: number | null;
  risk?: string | null;
}

export type TodayPriority<T> = T & { whyNow: string };

interface CandidateFacts {
  proximity: number;
  actionability: number;
  oldestContactDays: number | null;
  createdAtMs: number | null;
  ageDays: number | null;
  confidence: number;
  risk: number;
  whyNow: string;
}

const DAY_MS = 86_400_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const positiveInteger = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value > 0
    ? value
    : null;

const nonNegativeInteger = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value >= 0
    ? value
    : null;

const nonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const plural = (count: number) => (count > 1 ? "s" : "");

function proposalAge(
  createdAt: unknown,
  nowMs: number,
): { createdAtMs: number | null; ageDays: number | null } {
  if (typeof createdAt !== "string") {
    return { createdAtMs: null, ageDays: null };
  }
  const parsed = Date.parse(createdAt);
  if (!Number.isFinite(parsed) || parsed > nowMs) {
    return { createdAtMs: null, ageDays: null };
  }
  return {
    createdAtMs: parsed,
    ageDays: Math.floor((nowMs - parsed) / DAY_MS),
  };
}

function ageReason(ageDays: number | null, subject: string): string | null {
  if (ageDays === null || ageDays < 1) return null;
  return `${subject} en attente depuis ${ageDays} jour${plural(ageDays)}.`;
}

function factsFor(
  action: TodayPriorityCandidate,
  nowMs: number,
): CandidateFacts {
  const kind = typeof action.kind === "string" ? action.kind : "";
  const payload = isRecord(action.payload) ? action.payload : {};
  const count = positiveInteger(payload.count);
  const staleCount = positiveInteger(payload.stale_count);
  const minSilenceDays = positiveInteger(payload.min_silence_days);
  const oldestContactDays = nonNegativeInteger(
    payload.oldest_contact_days,
  );
  const { createdAtMs, ageDays } = proposalAge(action.created_at, nowMs);
  const confidence =
    typeof action.confidence === "number" &&
    Number.isFinite(action.confidence) &&
    action.confidence >= 0 &&
    action.confidence <= 1
      ? action.confidence
      : -1;
  const risk =
    action.risk === "low" ? 2 : action.risk === "medium" ? 1 : 0;

  const isDormantRelaunch = kind === "relaunch_dormant";
  const isVerifiedRelaunch =
    kind === "relaunch_priority" || isDormantRelaunch;
  const isLegacyStageRelaunch = kind.startsWith("relaunch_stage_");
  const isSpendPause = kind.startsWith("ads_pause_");
  const isHygiene =
    kind === "complete_missing_emails" ||
    kind === "classify_unlabeled" ||
    kind === "dedupe_emails" ||
    kind === "complete_missing_company";

  if (isVerifiedRelaunch || isLegacyStageRelaunch) {
    let whyNow: string;
    if (
      isDormantRelaunch &&
      count !== null &&
      minSilenceDays !== null &&
      oldestContactDays !== null
    ) {
      whyNow =
        `${count} prospect${plural(count)} sans contact depuis au moins ` +
        `${minSilenceDays} jours ; le plus ancien depuis ` +
        `${oldestContactDays} jour${plural(oldestContactDays)}.`;
    } else if (staleCount !== null && oldestContactDays !== null) {
      whyNow =
        `${staleCount} contact${plural(staleCount)} sans nouvelle ; ` +
        `le plus ancien depuis ${oldestContactDays} jour${plural(oldestContactDays)}.`;
    } else if (oldestContactDays !== null) {
      whyNow =
        `Le contact le plus ancien est sans nouvelle depuis ` +
        `${oldestContactDays} jour${plural(oldestContactDays)}.`;
    } else if (staleCount !== null) {
      whyNow = `${staleCount} contact${plural(staleCount)} sans nouvelle à traiter.`;
    } else if (count !== null) {
      whyNow = `${count} prospect${plural(count)} concerné${plural(count)} par cette relance.`;
    } else {
      whyNow =
        ageReason(ageDays, "Relance commerciale") ??
        "Relance commerciale directement examinable.";
    }
    return {
      // Les relances vérifiées sont calculées sur des contacts actifs et joignables.
      // Les anciennes actions `relaunch_stage_*` n'offrent pas encore cette
      // garantie : elles restent donc derrière, même avec un gros volume.
      proximity: isVerifiedRelaunch ? 3 : 2,
      actionability: isVerifiedRelaunch ? 2 : 1,
      oldestContactDays,
      createdAtMs,
      ageDays,
      confidence,
      risk,
      whyNow,
    };
  }

  if (isSpendPause) {
    const campaignId = nonEmptyString(payload.campaign_id);
    return {
      proximity: 3,
      actionability: campaignId ? 3 : 2,
      oldestContactDays,
      createdAtMs,
      ageDays,
      confidence,
      risk,
      whyNow: campaignId
        ? "Une campagne identifiée peut être mise en pause maintenant."
        : (ageReason(ageDays, "Pause de dépense") ??
          "Une pause de dépense est disponible pour examen."),
    };
  }

  if (kind === "launch_campaign") {
    return {
      proximity: 2,
      actionability: 1,
      oldestContactDays,
      createdAtMs,
      ageDays,
      confidence,
      risk,
      whyNow:
        ageReason(ageDays, "Action commerciale") ??
        "Action commerciale disponible pour examen.",
    };
  }

  if (isHygiene) {
    return {
      proximity: 1,
      actionability: 1,
      oldestContactDays,
      createdAtMs,
      ageDays,
      confidence,
      risk,
      whyNow:
        count !== null
          ? `${count} fiche${plural(count)} concernée${plural(count)} par cette correction.`
          : (ageReason(ageDays, "Correction de données") ??
            "Correction de données disponible pour examen."),
    };
  }

  return {
    proximity: 0,
    actionability: 0,
    oldestContactDays,
    createdAtMs,
    ageDays,
    confidence,
    risk,
    whyNow:
      ageReason(ageDays, "Proposition") ??
      "Proposition disponible pour examen.",
  };
}

const desc = (left: number, right: number) => right - left;
const optionalDesc = (left: number | null, right: number | null) =>
  desc(left ?? -1, right ?? -1);

const lexical = (left: unknown, right: unknown) => {
  const a = typeof left === "string" ? left : "";
  const b = typeof right === "string" ? right : "";
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * Retient au plus cinq propositions existantes. L'appelant reste responsable du
 * filtre d'autorisation : il doit être appliqué avant cette fonction.
 */
export function prioritizeTodayActions<T extends TodayPriorityCandidate>(
  actions: readonly T[],
  now: string | Date,
): TodayPriority<T>[] {
  const nowMs =
    now instanceof Date ? now.getTime() : Date.parse(now);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : 0;
  const ranked = actions.map((action, inputIndex) => ({
    action,
    inputIndex,
    facts: factsFor(action, safeNowMs),
  }));

  ranked.sort((left, right) => {
    const a = left.facts;
    const b = right.facts;
    return (
      desc(a.proximity, b.proximity) ||
      desc(a.actionability, b.actionability) ||
      optionalDesc(a.oldestContactDays, b.oldestContactDays) ||
      desc(Number(a.createdAtMs !== null), Number(b.createdAtMs !== null)) ||
      optionalDesc(a.ageDays, b.ageDays) ||
      desc(a.confidence, b.confidence) ||
      desc(a.risk, b.risk) ||
      (a.createdAtMs ?? Number.POSITIVE_INFINITY) -
        (b.createdAtMs ?? Number.POSITIVE_INFINITY) ||
      lexical(left.action.id, right.action.id) ||
      left.inputIndex - right.inputIndex
    );
  });

  return ranked.slice(0, MAX_TODAY_ACTIONS).map(({ action, facts }) => ({
    ...action,
    whyNow: facts.whyNow,
  }));
}
