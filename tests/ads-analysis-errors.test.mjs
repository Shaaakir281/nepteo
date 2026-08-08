import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runAdsAnalysis } from "../lib/ads/analysis.ts";

const failure = (message) => ({ message });

const losingMetric = () => ({
  provider: "meta_ads",
  campaign_id: "campaign-losing",
  campaign_name: "Campagne en perte",
  date: new Date().toISOString().slice(0, 10),
  impressions: 1_000,
  clicks: 50,
  spend: "100",
  conversions: 1,
  revenue: "20",
  synced_at: new Date().toISOString(),
});

function createAdmin(overrides = {}) {
  const responses = {
    "ad_metrics:select": { data: [losingMetric()], error: null, count: 1 },
    "actions:select": { data: [], error: null, count: 0 },
    "rpc:propose_ads_pause_actions": {
      data: { created_count: 1, results: [] },
      error: null,
    },
    ...overrides,
  };
  const calls = [];

  return {
    calls,
    from(table) {
      let operation = null;
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
        gte() {
          return builder;
        },
        lte() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        then(resolve, reject) {
          const key = `${table}:${operation}`;
          calls.push({ key });
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
    rpc(name, args) {
      const key = `rpc:${name}`;
      calls.push({ key, args });
      if (!(key in responses)) {
        return Promise.reject(
          new Error(`Réponse Supabase factice absente pour ${key}`),
        );
      }
      return Promise.resolve(responses[key]);
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

test("analyse Ads — une erreur de la transaction action+journal remonte", async () => {
  const admin = createAdmin({
    "rpc:propose_ads_pause_actions": {
      data: null,
      error: failure("transaction annulée"),
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] proposition atomique actions\+journal: transaction annulée/,
  );
  assert.equal(
    admin.calls.some(({ key }) => key === "actions:insert" || key.startsWith("journal:")),
    false,
  );
});

test("analyse Ads — une réponse transactionnelle ambiguë échoue fermé", async () => {
  const admin = createAdmin({
    "rpc:propose_ads_pause_actions": {
      data: { created_count: "1" },
      error: null,
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] résultat atomique invalide/,
  );
});

test("analyse Ads — une lecture tronquée échoue avant toute proposition", async () => {
  const admin = createAdmin({
    "ad_metrics:select": {
      data: [losingMetric()],
      error: null,
      count: 2,
    },
  });
  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] lecture ad_metrics: résultat tronqué/,
  );
  assert.equal(
    admin.calls.some(({ key }) => key === "rpc:propose_ads_pause_actions"),
    false,
  );
});

test("analyse Ads — le succès délègue un lot borné à l'unique RPC atomique", async () => {
  const admin = createAdmin();

  const created = await runAdsAnalysis(admin, "org-1", "user-1");

  assert.equal(created, 1);
  const rpcCall = admin.calls.find(
    ({ key }) => key === "rpc:propose_ads_pause_actions",
  );
  assert.ok(rpcCall);
  assert.equal(rpcCall.args.p_organization_id, "org-1");
  assert.equal(rpcCall.args.p_actor_id, "user-1");
  assert.equal(rpcCall.args.p_proposals.length, 1);
  assert.equal(rpcCall.args.p_proposals[0].confidence, null);
  assert.equal(rpcCall.args.p_proposals[0].kind, "ads_pause_campaign-losing");
  assert.equal(
    rpcCall.args.p_proposals[0].title,
    "Examiner la mise en pause de « Campagne en perte »",
  );
  assert.equal(
    admin.calls.some(({ key }) => key === "actions:insert" || key.startsWith("journal:")),
    false,
  );
});

test("analyse Ads — les décisions existantes ne privent pas les campagnes au-delà des 20 premières", async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...losingMetric(),
    campaign_id: `campaign-${String(index + 1).padStart(2, "0")}`,
    campaign_name: `Campagne ${index + 1}`,
  }));
  const existingActions = rows.slice(0, 20).map((row) => ({
    kind: `ads_pause_${row.campaign_id}`,
    confidence: null,
  }));
  const admin = createAdmin({
    "ad_metrics:select": { data: rows, error: null, count: rows.length },
    "actions:select": {
      data: existingActions,
      error: null,
      count: existingActions.length,
    },
  });

  assert.equal(await runAdsAnalysis(admin, "org-1", "user-1"), 1);
  const rpcCall = admin.calls.find(
    ({ key }) => key === "rpc:propose_ads_pause_actions",
  );
  assert.deepEqual(
    rpcCall.args.p_proposals.map(({ kind }) => kind),
    ["ads_pause_campaign-21"],
  );
});

test("analyse Ads — une mémoire de décisions tronquée échoue avant la transaction", async () => {
  const admin = createAdmin({
    "actions:select": {
      data: [{ kind: "ads_pause_campaign-losing", confidence: null }],
      error: null,
      count: 2,
    },
  });

  await assert.rejects(
    runAdsAnalysis(admin, "org-1", "user-1"),
    /\[ads-analysis\] lecture actions: résultat tronqué/,
  );
  assert.equal(
    admin.calls.some(({ key }) => key === "rpc:propose_ads_pause_actions"),
    false,
  );
});

test("analyse Ads — un rejeu idempotent identique retourne zéro création", async () => {
  const admin = createAdmin({
    "rpc:propose_ads_pause_actions": {
      data: { created_count: 0, results: [{ created: false }] },
      error: null,
    },
  });

  assert.equal(await runAdsAnalysis(admin, "org-1", "user-1"), 0);
});

test("analyse Ads — une confiance legacy repasse par la RPC d'adoption", async () => {
  const admin = createAdmin({
    "actions:select": {
      data: [{ kind: "ads_pause_campaign-losing", confidence: 0.8 }],
      error: null,
      count: 1,
    },
    "rpc:propose_ads_pause_actions": {
      data: {
        created_count: 0,
        results: [{ created: false, upgraded: true }],
      },
      error: null,
    },
  });

  assert.equal(await runAdsAnalysis(admin, "org-1", "user-1"), 0);
  assert.equal(
    admin.calls.filter(({ key }) => key === "rpc:propose_ads_pause_actions").length,
    1,
  );
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
