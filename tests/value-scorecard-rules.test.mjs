import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildValueScorecard } from "../lib/value-scorecard-rules.ts";

const component = (
  await Promise.all(
    ["value-scorecard.tsx", "value-scorecard-details.tsx", "value-scorecard-metrics.tsx"].map(
      (file) =>
        readFile(
          new URL(`../app/(cockpit)/_components/${file}`, import.meta.url),
          "utf8",
        ),
    ),
  )
).join("\n");

let sequence = 0;
function event(overrides = {}) {
  sequence += 1;
  return {
    id: `event-${String(sequence).padStart(4, "0")}`,
    action_id: `action-${sequence}`,
    prospect_id: null,
    actor_id: "tester-1",
    event_type: "suggestion_useful",
    source: "manual",
    is_demo: false,
    false_positive_reason: null,
    edit_level: null,
    occurred_at: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}

test("scorecard vide — dénominateurs visibles, taux non inventés et gates fermés", () => {
  const result = buildValueScorecard([]);

  assert.deepEqual(result.recommendations.usefulRate, {
    numerator: 0,
    denominator: 0,
    percentage: null,
  });
  assert.deepEqual(result.drafts.noneOrLightRate, {
    numerator: 0,
    denominator: 0,
    percentage: null,
  });
  assert.equal(result.testers, 0);
  assert.equal(result.outcomes.downstreamSignals, 0);
  assert.ok(Object.values(result.gates).every((gate) => gate === false));
  assert.equal(result.metricSignal, "insufficient_data");
});

test("verdicts — seule la correction la plus récente par action compte", () => {
  const input = [
    event({
      id: "a-old",
      action_id: "action-a",
      event_type: "suggestion_useful",
      occurred_at: "2026-07-28T10:00:00.000Z",
    }),
    event({
      id: "a-new",
      action_id: "action-a",
      event_type: "false_positive",
      occurred_at: "2026-07-29T10:00:00.000Z",
    }),
    event({
      id: "b-a",
      action_id: "action-b",
      event_type: "false_positive",
      occurred_at: "2026-07-30T10:00:00.000Z",
    }),
    event({
      id: "b-z",
      action_id: "action-b",
      event_type: "suggestion_not_useful",
      occurred_at: "2026-07-30T10:00:00.000Z",
    }),
    event({
      id: "c",
      action_id: "action-c",
      event_type: "suggestion_useful",
    }),
  ];
  const snapshot = structuredClone(input);

  const forward = buildValueScorecard(input);
  const reverse = buildValueScorecard([...input].reverse());

  assert.deepEqual(forward.recommendations, {
    examined: 3,
    useful: 1,
    notUseful: 1,
    falsePositives: 1,
    rejected: 2,
    missingContextRejections: 0,
    usefulRate: { numerator: 1, denominator: 3, percentage: 33.3 },
    notUsefulRate: { numerator: 1, denominator: 3, percentage: 33.3 },
    falsePositiveRate: { numerator: 1, denominator: 3, percentage: 33.3 },
    missingContextRate: { numerator: 0, denominator: 2, percentage: 0 },
  });
  assert.deepEqual(reverse, forward);
  assert.deepEqual(input, snapshot);
});

test("dates invalides — le départage par id reste déterministe", () => {
  const input = [
    event({
      id: "invalid-a",
      action_id: "action-invalid",
      event_type: "suggestion_useful",
      occurred_at: "pas-une-date",
    }),
    event({
      id: "invalid-z",
      action_id: "action-invalid",
      event_type: "suggestion_not_useful",
      occurred_at: "toujours-invalide",
    }),
  ];

  const result = buildValueScorecard([...input].reverse());
  assert.equal(result.recommendations.examined, 1);
  assert.equal(result.recommendations.notUseful, 1);
});

test("brouillons — la dernière revue par action fixe le niveau de retouche", () => {
  const result = buildValueScorecard([
    event({
      id: "draft-a-old",
      action_id: "action-a",
      event_type: "draft_reviewed",
      edit_level: "significant",
      occurred_at: "2026-07-28T10:00:00.000Z",
    }),
    event({
      id: "draft-a-new",
      action_id: "action-a",
      event_type: "draft_reviewed",
      edit_level: "light",
      occurred_at: "2026-07-29T10:00:00.000Z",
    }),
    event({
      id: "draft-b",
      action_id: "action-b",
      event_type: "draft_reviewed",
      edit_level: "none",
    }),
    event({
      id: "draft-c",
      action_id: "action-c",
      event_type: "draft_reviewed",
      edit_level: "significant",
    }),
  ]);

  assert.deepEqual(result.drafts, {
    examined: 3,
    none: 1,
    light: 1,
    significant: 1,
    noneOrLight: 2,
    noneOrLightRate: { numerator: 2, denominator: 3, percentage: 66.7 },
  });
});

test("résultats — déduplique action + prospect et sépare déclaré d'observé", () => {
  const pair = {
    action_id: "action-a",
    prospect_id: "prospect-a",
  };
  const result = buildValueScorecard([
    event({ ...pair, event_type: "manual_followup_sent" }),
    event({ ...pair, id: "followup-replay", event_type: "manual_followup_sent" }),
    event({ ...pair, event_type: "reply_received", source: "manual" }),
    event({ ...pair, id: "reply-provider", event_type: "reply_received", source: "gmail" }),
    event({
      action_id: "action-a",
      prospect_id: "prospect-b",
      event_type: "reply_received",
      source: "microsoft",
    }),
    event({ ...pair, event_type: "meeting_booked", source: "manual" }),
    event({ ...pair, event_type: "opportunity_created", source: "gmail" }),
  ]);

  assert.equal(result.outcomes.manualFollowupsDeclared, 1);
  assert.deepEqual(result.outcomes.replies, {
    total: 2,
    declared: 1,
    observed: 2,
  });
  assert.deepEqual(result.outcomes.meetings, {
    total: 1,
    declared: 1,
    observed: 0,
  });
  assert.deepEqual(result.outcomes.opportunities, {
    total: 1,
    declared: 0,
    observed: 1,
  });
  assert.equal(result.outcomes.downstreamSignals, 4);
});

test("identifiants null — aucun événement orphelin n'est fusionné arbitrairement", () => {
  const result = buildValueScorecard([
    event({ id: "orphan-verdict-a", action_id: null }),
    event({
      id: "orphan-verdict-b",
      action_id: null,
      event_type: "false_positive",
    }),
    event({
      id: "orphan-draft-a",
      action_id: null,
      event_type: "draft_reviewed",
      edit_level: "none",
    }),
    event({
      id: "orphan-draft-b",
      action_id: null,
      event_type: "draft_reviewed",
      edit_level: "light",
    }),
    event({
      id: "orphan-reply-a",
      action_id: "action-a",
      prospect_id: null,
      event_type: "reply_received",
    }),
    event({
      id: "orphan-reply-b",
      action_id: "action-a",
      prospect_id: null,
      event_type: "reply_received",
    }),
  ]);

  assert.equal(result.recommendations.examined, 2);
  assert.equal(result.drafts.examined, 2);
  assert.equal(result.outcomes.replies.total, 2);
  assert.deepEqual(result.unlinked, {
    recommendationEvents: 2,
    draftEvents: 2,
    outcomeEvents: 2,
  });
});

test("démonstration et acteurs absents — aucun effet sur métriques ou testeurs", () => {
  const result = buildValueScorecard([
    event({ actor_id: "TESTER-A" }),
    event({ actor_id: "tester-a", action_id: "action-b" }),
    event({ actor_id: "tester-b", action_id: "action-c" }),
    event({
      actor_id: "provider-service",
      action_id: "action-d",
      event_type: "reply_received",
      prospect_id: "prospect-d",
      source: "gmail",
    }),
    event({ actor_id: null, action_id: "action-e" }),
    event({ actor_id: "tester-demo", action_id: "action-demo", is_demo: true }),
  ]);

  assert.equal(result.testers, 2);
  assert.equal(result.recommendations.examined, 4);
  assert.equal(result.excludedDemoEvents, 1);
});

test("testeurs — seuls les auteurs des verdicts examinés ouvrent le checkpoint", () => {
  const result = buildValueScorecard([
    event({ action_id: "action-a", actor_id: "tester-a" }),
    event({
      action_id: "action-a",
      prospect_id: "prospect-a",
      actor_id: "tester-b",
      event_type: "manual_followup_sent",
    }),
    event({
      action_id: "action-a",
      prospect_id: "prospect-a",
      actor_id: "tester-c",
      event_type: "reply_received",
    }),
  ]);

  assert.equal(result.testers, 1);
});

test("gates — respecte exactement 60 %, moins de 15 %, 50/30 et 20 relances", () => {
  const events = [];
  for (let index = 0; index < 50; index += 1) {
    const eventType =
      index < 30
        ? "suggestion_useful"
        : index < 37
          ? "false_positive"
          : "suggestion_not_useful";
    events.push(
      event({
        id: `verdict-${index}`,
        action_id: `action-${index}`,
        actor_id: `tester-${index % 3}`,
        event_type: eventType,
      }),
    );
  }
  for (let index = 0; index < 5; index += 1) {
    events.push(
      event({
        id: `draft-${index}`,
        action_id: `draft-action-${index}`,
        event_type: "draft_reviewed",
        edit_level: index < 3 ? "light" : "significant",
      }),
    );
  }
  for (let index = 0; index < 20; index += 1) {
    events.push(
      event({
        id: `followup-${index}`,
        action_id: `followup-action-${index}`,
        prospect_id: `prospect-${index}`,
        event_type: "manual_followup_sent",
      }),
    );
  }
  events.push(
    event({
      id: "reply-one",
      action_id: "followup-action-0",
      prospect_id: "prospect-0",
      event_type: "reply_received",
    }),
  );

  const result = buildValueScorecard(events);

  assert.equal(result.recommendations.usefulRate.percentage, 60);
  assert.equal(result.recommendations.falsePositiveRate.percentage, 14);
  assert.equal(result.drafts.noneOrLightRate.percentage, 60);
  assert.deepEqual(result.gates, {
    localRecommendationVolume: true,
    qualitativeVolume: true,
    longitudinalVolume: true,
    utilityTarget: true,
    falsePositiveTarget: true,
    draftTarget: true,
    manualFollowupsTarget: true,
    downstreamSignal: true,
    missingContextSignal: false,
    c7MeasuredCriteria: true,
  });
  assert.equal(result.metricSignal, "accelerate");
});

test("signal connecteur — rapporte le contexte manquant sur tous les rejets", () => {
  const events = Array.from({ length: 10 }, (_, index) =>
    event({
      id: `rejection-${index}`,
      action_id: `rejection-action-${index}`,
      event_type: index < 6 ? "false_positive" : "suggestion_not_useful",
      false_positive_reason:
        index < 3
          ? "missing_context"
          : index < 6
            ? "wrong_person"
            : null,
    }),
  );

  const result = buildValueScorecard(events);
  assert.equal(result.recommendations.rejected, 10);
  assert.deepEqual(result.recommendations.missingContextRate, {
    numerator: 3,
    denominator: 10,
    percentage: 30,
  });
  assert.equal(result.gates.missingContextSignal, true);
});

test("gates — 15 % de faux positifs échoue et les signaux itérer/pivoter sont bornés", () => {
  const atFifteen = Array.from({ length: 20 }, (_, index) =>
    event({
      id: `fifteen-${index}`,
      action_id: `fifteen-action-${index}`,
      event_type: index < 3 ? "false_positive" : "suggestion_useful",
    }),
  );
  assert.equal(
    buildValueScorecard(atFifteen).gates.falsePositiveTarget,
    false,
  );

  const iterate = Array.from({ length: 50 }, (_, index) =>
    event({
      id: `iterate-${index}`,
      action_id: `iterate-action-${index}`,
      event_type: index < 25 ? "suggestion_useful" : "suggestion_not_useful",
    }),
  );
  const pivot = Array.from({ length: 50 }, (_, index) =>
    event({
      id: `pivot-${index}`,
      action_id: `pivot-action-${index}`,
      event_type: index < 19 ? "suggestion_useful" : "suggestion_not_useful",
    }),
  );

  assert.equal(buildValueScorecard(iterate).metricSignal, "iterate");
  assert.equal(buildValueScorecard(pivot).metricSignal, "pivot");
});

test("interface — dit déclaré, sépare le fournisseur et expose les objectifs", () => {
  assert.match(component, /Preuve terrain déclarée/);
  assert.match(component, /ne\s+prouvent ni un envoi ni un résultat observé par un fournisseur/);
  assert.match(component, /observé\(s\) fournisseur/);
  assert.match(component, /30 recommandations locales/);
  assert.match(component, /gate\s+programme « 3 testeurs »/);
  assert.match(component, /consolidation anonymisée hors de cette page/);
  assert.match(component, /50 recommandations/);
  assert.match(component, /≥ 60 %/);
  assert.match(component, /< 15 %/);
  assert.match(component, /target="≥ 20"/);
  assert.match(component, /ne déclenchent rien automatiquement/);
});
