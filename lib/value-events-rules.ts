export const VALUE_EVENT_TYPES = [
  "suggestion_useful",
  "suggestion_not_useful",
  "false_positive",
  "draft_reviewed",
  "manual_followup_sent",
  "reply_received",
  "meeting_booked",
  "opportunity_created",
] as const;

export type ValueEventType = (typeof VALUE_EVENT_TYPES)[number];

export const VALUE_EVENT_SOURCES = ["manual", "gmail", "microsoft"] as const;
export type ValueEventSource = (typeof VALUE_EVENT_SOURCES)[number];

export const FALSE_POSITIVE_REASONS = [
  "recent_contact",
  "already_replied",
  "opted_out",
  "wrong_person",
  "terminal_stage",
  "missing_context",
  "other",
] as const;

export type FalsePositiveReason = (typeof FALSE_POSITIVE_REASONS)[number];

export const VALUE_EVENT_EDIT_LEVELS = [
  "none",
  "light",
  "significant",
] as const;

export type ValueEventEditLevel = (typeof VALUE_EVENT_EDIT_LEVELS)[number];

export type ValueEventDimension =
  | "suggestion_verdict"
  | "draft_review"
  | "manual_followup"
  | "reply"
  | "meeting"
  | "opportunity";

export interface ValueEventInput {
  actionId: string;
  submissionId: string;
  prospectId?: string | null;
  eventType: string;
  source?: string;
  falsePositiveReason?: string | null;
  editLevel?: string | null;
}

export interface NormalizedValueEvent {
  actionId: string;
  submissionId: string;
  prospectId: string | null;
  eventType: ValueEventType;
  source: ValueEventSource;
  falsePositiveReason: FalsePositiveReason | null;
  editLevel: ValueEventEditLevel | null;
  idempotencyKey: string;
}

export type ValueEventValidation =
  | { ok: true; value: NormalizedValueEvent }
  | {
      ok: false;
      reason:
        | "invalid_action"
        | "invalid_submission"
        | "invalid_prospect"
        | "invalid_event_type"
        | "invalid_source"
        | "invalid_false_positive_reason"
        | "invalid_edit_level";
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function valueEventIdempotencyKey(input: {
  actionId: string;
  submissionId: string;
}): string {
  return [
    "value",
    input.actionId.toLowerCase(),
    input.submissionId.toLowerCase(),
  ].join(":");
}

/**
 * Les événements restent append-only. Pour les dimensions corrigeables,
 * l'événement le plus récent (occurred_at, puis id) remplace le verdict
 * précédent dans les agrégats sans le réécrire.
 */
export function valueEventDimension(
  eventType: ValueEventType,
): ValueEventDimension {
  if (
    eventType === "suggestion_useful" ||
    eventType === "suggestion_not_useful" ||
    eventType === "false_positive"
  ) {
    return "suggestion_verdict";
  }
  if (eventType === "draft_reviewed") return "draft_review";
  if (eventType === "manual_followup_sent") return "manual_followup";
  if (eventType === "reply_received") return "reply";
  if (eventType === "meeting_booked") return "meeting";
  return "opportunity";
}

export function validateValueEventInput(
  input: ValueEventInput,
): ValueEventValidation {
  const actionId = input.actionId.trim().toLowerCase();
  if (!UUID_PATTERN.test(actionId)) {
    return { ok: false, reason: "invalid_action" };
  }

  const submissionId = input.submissionId.trim().toLowerCase();
  if (!UUID_PATTERN.test(submissionId)) {
    return { ok: false, reason: "invalid_submission" };
  }

  const prospectId = input.prospectId?.trim().toLowerCase() || null;
  if (prospectId !== null && !UUID_PATTERN.test(prospectId)) {
    return { ok: false, reason: "invalid_prospect" };
  }

  if (!includes(VALUE_EVENT_TYPES, input.eventType)) {
    return { ok: false, reason: "invalid_event_type" };
  }
  const eventType = input.eventType;

  const requestedSource = input.source ?? "manual";
  if (!includes(VALUE_EVENT_SOURCES, requestedSource)) {
    return { ok: false, reason: "invalid_source" };
  }

  const requestedReason = input.falsePositiveReason ?? null;
  if (
    (eventType === "false_positive" &&
      (requestedReason === null ||
        !includes(FALSE_POSITIVE_REASONS, requestedReason))) ||
    (eventType !== "false_positive" && requestedReason !== null)
  ) {
    return { ok: false, reason: "invalid_false_positive_reason" };
  }

  const requestedEditLevel = input.editLevel ?? null;
  if (
    (eventType === "draft_reviewed" &&
      (requestedEditLevel === null ||
        !includes(VALUE_EVENT_EDIT_LEVELS, requestedEditLevel))) ||
    (eventType !== "draft_reviewed" && requestedEditLevel !== null)
  ) {
    return { ok: false, reason: "invalid_edit_level" };
  }

  const falsePositiveReason: FalsePositiveReason | null =
    eventType === "false_positive"
      ? (requestedReason as FalsePositiveReason)
      : null;
  const editLevel: ValueEventEditLevel | null =
    eventType === "draft_reviewed"
      ? (requestedEditLevel as ValueEventEditLevel)
      : null;

  const normalized: Omit<NormalizedValueEvent, "idempotencyKey"> = {
    actionId,
    submissionId,
    prospectId,
    eventType,
    source: requestedSource,
    falsePositiveReason,
    editLevel,
  };

  return {
    ok: true,
    value: {
      ...normalized,
      idempotencyKey: valueEventIdempotencyKey(normalized),
    },
  };
}
