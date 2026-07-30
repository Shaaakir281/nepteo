import assert from "node:assert/strict";
import test from "node:test";
import {
  validateValueEventInput,
  valueEventDimension,
  valueEventIdempotencyKey,
} from "../lib/value-events-rules.ts";

const ACTION_ID = "11111111-1111-4111-8111-111111111111";
const PROSPECT_ID = "22222222-2222-4222-8222-222222222222";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";

function validInput(overrides = {}) {
  return {
    actionId: ACTION_ID,
    submissionId: SUBMISSION_ID,
    eventType: "suggestion_useful",
    ...overrides,
  };
}

test("value events — normalise une déclaration manuelle et sa clé de tentative", () => {
  const result = validateValueEventInput(
    validInput({ prospectId: PROSPECT_ID.toUpperCase() }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    actionId: ACTION_ID,
    submissionId: SUBMISSION_ID,
    prospectId: PROSPECT_ID,
    eventType: "suggestion_useful",
    source: "manual",
    falsePositiveReason: null,
    editLevel: null,
    idempotencyKey: `value:${ACTION_ID}:${SUBMISSION_ID}`,
  });
});

test("value events — refuse les identifiants, types et sources invalides", () => {
  const cases = [
    [validInput({ actionId: "not-a-uuid" }), "invalid_action"],
    [validInput({ submissionId: "not-a-uuid" }), "invalid_submission"],
    [validInput({ prospectId: "not-a-uuid" }), "invalid_prospect"],
    [validInput({ eventType: "sent" }), "invalid_event_type"],
    [validInput({ source: "linkedin" }), "invalid_source"],
  ];

  for (const [input, reason] of cases) {
    assert.deepEqual(validateValueEventInput(input), { ok: false, reason });
  }
});

test("value events — impose un motif normalisé uniquement au faux positif", () => {
  assert.equal(
    validateValueEventInput(
      validInput({
        eventType: "false_positive",
        falsePositiveReason: "already_replied",
      }),
    ).ok,
    true,
  );
  assert.deepEqual(
    validateValueEventInput(validInput({ eventType: "false_positive" })),
    { ok: false, reason: "invalid_false_positive_reason" },
  );
  assert.deepEqual(
    validateValueEventInput(
      validInput({ falsePositiveReason: "already_replied" }),
    ),
    { ok: false, reason: "invalid_false_positive_reason" },
  );
  assert.deepEqual(
    validateValueEventInput(
      validInput({
        eventType: "false_positive",
        falsePositiveReason: "free text",
      }),
    ),
    { ok: false, reason: "invalid_false_positive_reason" },
  );
});

test("value events — impose un niveau uniquement à la revue de brouillon", () => {
  for (const editLevel of ["none", "light", "significant"]) {
    assert.equal(
      validateValueEventInput(
        validInput({ eventType: "draft_reviewed", editLevel }),
      ).ok,
      true,
    );
  }
  assert.deepEqual(
    validateValueEventInput(validInput({ eventType: "draft_reviewed" })),
    { ok: false, reason: "invalid_edit_level" },
  );
  assert.deepEqual(
    validateValueEventInput(validInput({ editLevel: "light" })),
    { ok: false, reason: "invalid_edit_level" },
  );
});

test("value events — une tentative rejouée garde sa clé, une correction en reçoit une autre", () => {
  const first = valueEventIdempotencyKey({
    actionId: ACTION_ID,
    submissionId: SUBMISSION_ID,
  });
  const replay = valueEventIdempotencyKey({
    actionId: ACTION_ID,
    submissionId: SUBMISSION_ID,
  });
  const correction = valueEventIdempotencyKey({
    actionId: ACTION_ID,
    submissionId: "44444444-4444-4444-8444-444444444444",
  });

  assert.equal(first, replay);
  assert.notEqual(first, correction);
});

test("value events — utile, pas utile et faux positif corrigent la même dimension", () => {
  assert.equal(valueEventDimension("suggestion_useful"), "suggestion_verdict");
  assert.equal(
    valueEventDimension("suggestion_not_useful"),
    "suggestion_verdict",
  );
  assert.equal(valueEventDimension("false_positive"), "suggestion_verdict");
  assert.equal(valueEventDimension("draft_reviewed"), "draft_review");
  assert.equal(valueEventDimension("reply_received"), "reply");
});
