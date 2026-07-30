import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runAdsAnalysis } from "../lib/ads/analysis.ts";

const failure = (message) => ({ message });

const losingMetric = () => ({
  campaign_id: "campaign-losing",
  campaign_name: "Campagne en perte",
  date: new Date().toISOString().slice(0, 10),
  impressions: 1_000,
  clicks: 50,
  spend: "100",
  conversions: 1,
  revenue: "20",
});

function createAdmin(overrides = {}) {
  const responses = {
    "ad_metrics:select": { data: [losingMetric()], error: null },
    "actions:select": { data: [], error: null },
    "actions:insert": { data: null, error: null },
    "journal:insert": { data: null, error: null },
    ...overrides,
  };
  const calls = [];

  return {
    calls,
    from(table) {
      let operation = null;
      let payload;
      const builder = {
        select() {
          operation = "select";
          return builder;
        },
        eq() {
          return builder;
        },
        like() {
          return builder;
        },
        insert(value) {
          operation = "insert";
          payload = value;
          return builder;
        },
        then(resolve, reject) {
          const key = `${table}:${operation}`;
          calls.push({ key, payload });
          if (!(key in responses)) {
            return Promise.reject(
              new Error(`Réponse Supabase factice absente pour ${key}`),
            ).then(resolve, reject);
          }
          return Promise.resolve(responses[key]).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

test("analyse Ads — une erreur de lecture des métriques remonte", async () => {
  const admin = createAdmin({
    "ad_metrics:select": {
      data: null,
      error: failure("metrics indisponibles"),
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] lecture ad_metrics: metrics indisponibles/,
  );
  assert.deepEqual(
    admin.calls.map(({ key }) => key),
    ["ad_metrics:select"],
  );
});

test("analyse Ads — une erreur de déduplication des actions remonte", async () => {
  const admin = createAdmin({
    "actions:select": {
      data: null,
      error: failure("actions illisibles"),
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] lecture actions existantes: actions illisibles/,
  );
  assert.equal(
    admin.calls.some(({ key }) => key === "actions:insert"),
    false,
  );
});

test("analyse Ads — une erreur d'insertion des propositions remonte", async () => {
  const admin = createAdmin({
    "actions:insert": {
      data: null,
      error: failure("actions non écrites"),
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] insertion actions: actions non écrites/,
  );
  assert.equal(
    admin.calls.some(({ key }) => key === "journal:insert"),
    false,
  );
});

test("analyse Ads — la traçabilité journalisée est obligatoire", async () => {
  const admin = createAdmin({
    "journal:insert": {
      data: null,
      error: failure("journal non écrit"),
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] insertion journal: journal non écrit/,
  );
});

test("analyse Ads — le succès écrit les traces en un lot et retourne le compte", async () => {
  const admin = createAdmin();

  const created = await runAdsAnalysis(admin, "org-1", "user-1");

  assert.equal(created, 1);
  const journalCall = admin.calls.find(({ key }) => key === "journal:insert");
  assert.ok(journalCall);
  assert.equal(journalCall.payload.length, 1);
  assert.deepEqual(journalCall.payload[0].payload, {
    kind: "ads_pause_campaign-losing",
    title: "Mettre en pause « Campagne en perte »",
  });
});

test("analyse manuelle — toute exception Ads devient l'avertissement ads_failed", async () => {
  const action = await readFile(
    new URL("../app/(cockpit)/_actions/analysis.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    action,
    /try \{\s*adsCreated = await runAdsAnalysis[\s\S]*?\}\s*catch \{\s*[\s\S]*?adsFailed = true;/,
  );
  assert.match(
    action,
    /adsFailed \? \{ warning: "ads_failed" as const \} : \{\}/,
  );
});
