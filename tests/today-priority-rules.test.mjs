/**
 * File « Aujourd'hui » — classement pur, borné et sans I/O.
 * Runner : node:test, avec type-stripping natif du module TypeScript.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAX_TODAY_ACTIONS,
  prioritizeTodayActions,
} from "../lib/today-priority-rules.ts";

const NOW = "2026-07-29T12:00:00.000Z";
const todayQueueData = await readFile(
  new URL("../app/(cockpit)/_lib/today-queue-data.ts", import.meta.url),
  "utf8",
);
const priorityRules = await readFile(
  new URL("../lib/today-priority-rules.ts", import.meta.url),
  "utf8",
);

const action = (id, overrides = {}) => ({
  id,
  kind: "classify_unlabeled",
  created_at: "2026-07-28T12:00:00.000Z",
  payload: { count: 1 },
  confidence: 0.7,
  risk: "low",
  title: `Action ${id}`,
  finding: "Constat sans effet sur le score",
  ...overrides,
});

test("0 à 4 propositions restent 0 à 4, sans action fabriquée", () => {
  for (let size = 0; size <= 4; size += 1) {
    const input = Array.from({ length: size }, (_, index) =>
      action(`a-${index}`),
    );
    const output = prioritizeTodayActions(input, NOW);
    assert.equal(output.length, size);
    assert.deepEqual(
      output.map((item) => item.id).sort(),
      input.map((item) => item.id).sort(),
    );
    assert.ok(output.every((item) => item.whyNow.length > 0));
  }
});

test("la file est strictement limitée à cinq propositions", () => {
  const input = Array.from({ length: 9 }, (_, index) =>
    action(`a-${index}`, {
      created_at: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
    }),
  );
  assert.equal(
    prioritizeTodayActions(input, NOW).length,
    MAX_TODAY_ACTIONS,
  );
});

test("contrat Today : 50 lignes, autorisation avant classement, puis cap à 5", () => {
  const queueQuery = todayQueueData.indexOf("const { data: queueRows }");
  const boundedRead = todayQueueData.indexOf(".limit(50)", queueQuery);
  const authorization = todayQueueData.indexOf("const authorizedQueue", boundedRead);
  const authorizationFilter = todayQueueData.indexOf(".filter(", authorization);
  const ranking = todayQueueData.indexOf(
    "prioritizeTodayActions(",
    authorizationFilter,
  );

  assert.ok(queueQuery >= 0, "la requête de propositions doit rester identifiable");
  assert.ok(boundedRead > queueQuery, "la lecture doit être bornée à 50");
  assert.ok(
    authorizationFilter > boundedRead && authorizationFilter < ranking,
    "le filtre d'autorisation doit précéder le classement",
  );
  assert.equal(MAX_TODAY_ACTIONS, 5);
  assert.match(priorityRules, /\.slice\(0, MAX_TODAY_ACTIONS\)/);
});

test("une relance ancienne et étayée dépasse une relance récente faible", () => {
  const oldStrong = action("old-strong", {
    kind: "relaunch_priority",
    created_at: "2026-07-10T12:00:00.000Z",
    payload: {
      count: 8,
      stale_count: 3,
      oldest_contact_days: 42,
    },
  });
  const recentWeak = action("recent-weak", {
    kind: "relaunch_priority",
    created_at: "2026-07-29T11:00:00.000Z",
    payload: {},
  });

  const output = prioritizeTodayActions([recentWeak, oldStrong], NOW);
  assert.equal(output[0].id, "old-strong");
  assert.match(output[0].whyNow, /3 contacts.*42 jours/);
});

test("une ancienne relance par statut reste sous la relance vérifiée", () => {
  const legacyStage = action("legacy-stage", {
    kind: "relaunch_stage_client",
    created_at: "2026-01-01T00:00:00.000Z",
    payload: {
      stage: "Client",
      count: 500,
      stale_count: 500,
      oldest_contact_days: 500,
    },
  });
  const verified = action("verified", {
    kind: "relaunch_priority",
    created_at: "2026-07-29T11:00:00.000Z",
    payload: { count: 1 },
  });

  assert.equal(
    prioritizeTodayActions([legacyStage, verified], NOW)[0].id,
    "verified",
  );
});

test("le play dormant est une relance vérifiée et explique son seuil", () => {
  const dormant = action("dormant", {
    kind: "relaunch_dormant",
    payload: {
      count: 12,
      min_silence_days: 45,
      oldest_contact_days: 83,
    },
  });
  const legacyStage = action("legacy-stage", {
    kind: "relaunch_stage_nouveau",
    payload: { count: 500, oldest_contact_days: 200 },
  });

  const output = prioritizeTodayActions([legacyStage, dormant], NOW);
  assert.equal(output[0].id, "dormant");
  assert.match(output[0].whyNow, /12 prospects.*45 jours.*83 jours/);
});

test("relances et pauses de dépense passent avant l'hygiène de données", () => {
  const hygiene = action("hygiene", {
    kind: "complete_missing_emails",
    created_at: "2026-01-01T00:00:00.000Z",
    payload: { count: 100 },
  });
  const relaunch = action("relaunch", {
    kind: "relaunch_stage_nouveau",
    payload: { count: 2 },
  });
  const pause = action("pause", {
    kind: "ads_pause_campaign-1",
    payload: { campaign_id: "campaign-1" },
  });

  const ids = prioritizeTodayActions([hygiene, pause, relaunch], NOW).map(
    (item) => item.id,
  );
  assert.ok(ids.indexOf("relaunch") < ids.indexOf("hygiene"));
  assert.ok(ids.indexOf("pause") < ids.indexOf("hygiene"));
});

test("à kind égal, l'ancienneté précède confiance et risque", () => {
  const old = action("old", {
    created_at: "2026-07-20T12:00:00.000Z",
    confidence: 0.1,
    risk: "high",
  });
  const recent = action("recent", {
    created_at: "2026-07-29T11:00:00.000Z",
    confidence: 1,
    risk: "low",
  });

  assert.equal(prioritizeTodayActions([recent, old], NOW)[0].id, "old");
});

test("les départages confiance, risque, created_at et id sont stables", () => {
  const input = [
    action("z", { confidence: 0.8, risk: "medium" }),
    action("a", { confidence: 0.8, risk: "low" }),
    action("later", {
      confidence: 0.7,
      risk: "low",
      created_at: "2026-07-28T18:00:00.000Z",
    }),
    action("earlier", {
      confidence: 0.7,
      risk: "low",
      created_at: "2026-07-28T06:00:00.000Z",
    }),
    action("b", { confidence: 0.8, risk: "low" }),
  ];

  const first = prioritizeTodayActions(input, NOW).map((item) => item.id);
  const second = prioritizeTodayActions([...input].reverse(), NOW).map(
    (item) => item.id,
  );
  assert.deepEqual(first, ["a", "b", "z", "earlier", "later"]);
  assert.deepEqual(second, first);
});

test("dates futures et valeurs payload invalides ne créent ni urgence ni chiffre", () => {
  const valid = action("valid", {
    payload: { count: 1 },
    created_at: "2026-07-28T12:00:00.000Z",
  });
  const future = action("future", {
    payload: {
      count: "99",
      stale_count: -3,
      oldest_contact_days: Number.NaN,
    },
    created_at: "2027-01-01T00:00:00.000Z",
  });
  const invalid = action("invalid", {
    payload: null,
    created_at: "pas-une-date",
  });

  const output = prioritizeTodayActions([future, invalid, valid], NOW);
  assert.equal(output[0].id, "valid");
  for (const item of output.filter(({ id }) => id !== "valid")) {
    assert.doesNotMatch(item.whyNow, /99|-3|NaN|2027/);
    assert.doesNotMatch(item.whyNow, /depuis \d+ jour/);
  }
});

test("le classement ne modifie ni le tableau ni ses objets", () => {
  const input = [
    action("hygiene"),
    action("relaunch", {
      kind: "relaunch_priority",
      payload: { count: 3, stale_count: 1, oldest_contact_days: 30 },
    }),
  ];
  const snapshot = structuredClone(input);

  const output = prioritizeTodayActions(input, NOW);

  assert.deepEqual(input, snapshot);
  assert.notStrictEqual(output, input);
  assert.notStrictEqual(output[0], input[1]);
});
