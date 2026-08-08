import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { connectorCapability } from "../lib/connectors.ts";
import {
  META_ADS_SCOPES,
  META_MAX_ACCOUNTS,
  META_MAX_INSIGHT_ROWS,
  parseMetaAdAccounts,
  readMetaCampaignInsights,
  readMetaInsightSnapshot,
  readSelectedMetaAdAccount,
  utcInsightWindow,
} from "../lib/connectors/meta-ads.ts";

const account = {
  id: "act_123456789",
  name: "Compte pilote",
  currency: "EUR",
  timezone_name: "Europe/Paris",
};

test("META-READ -- contrat : ads_read seulement, lecture manuelle et aucune écriture", () => {
  assert.deepEqual(META_ADS_SCOPES, ["ads_read"]);
  assert.deepEqual(connectorCapability("meta_ads"), {
    activation: "oauth",
    read: true,
    write: false,
    sync: "manual",
  });
  assert.equal(META_MAX_ACCOUNTS, 25);
  assert.equal(META_MAX_INSIGHT_ROWS, 100);
});

test("META-READ -- les bornes de fenêtre sont calculées côté serveur", () => {
  assert.deepEqual(
    utcInsightWindow(7, new Date("2026-08-08T19:00:00.000Z")),
    { days: 7, since: "2026-08-02", until: "2026-08-08" },
  );
  assert.throws(() => utcInsightWindow(31), /Fenêtre Meta Ads invalide/);
});

test("META-READ -- comptes et snapshot sont minimisés et rejetés hors contrat", () => {
  const candidates = parseMetaAdAccounts({ data: [account] });
  assert.deepEqual(candidates, [{ id: "act_123456789", name: "Compte pilote", currency: "EUR", timezone: "Europe/Paris" }]);
  assert.throws(
    () => parseMetaAdAccounts({ data: Array.from({ length: 26 }, () => account) }),
    /invalide ou incomplète/,
  );
  assert.throws(
    () => parseMetaAdAccounts({ data: [{ ...account, id: "act_bad" }] }),
    /invalide ou incomplète/,
  );

  const config = {
    meta_ad_account: { id: "act_123456789", name: "Compte pilote", currency: "EUR", timezone: "Europe/Paris" },
    meta_insights_snapshot: {
      version: 1,
      account_id: "act_123456789",
      currency: "EUR",
      window_days: 7,
      observation_from: "2026-08-02",
      observation_to: "2026-08-08",
      rows: [{ campaign_id: "987", campaign_name: "Acquisition", date: "2026-08-08", impressions: 120, clicks: 8, spend: 12.5 }],
    },
  };
  assert.equal(readSelectedMetaAdAccount(config)?.id, "act_123456789");
  assert.equal(readMetaInsightSnapshot(config)?.rows[0]?.spend, 12.5);
  assert.equal(
    readMetaInsightSnapshot({ ...config, meta_insights_snapshot: { ...config.meta_insights_snapshot, rows: [{ ...config.meta_insights_snapshot.rows[0], spend: -1 }] } }),
    null,
  );
});

test("META-READ -- une pagination, une devise incohérente ou un doublon échouent fermés", async () => {
  const originalFetch = globalThis.fetch;
  const originalVersion = process.env.META_GRAPH_API_VERSION;
  const selected = { id: "act_123456789", name: "Compte pilote", currency: "EUR", timezone: "Europe/Paris" };
  try {
    process.env.META_GRAPH_API_VERSION = "v99.0";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({
        data: [{
          campaign_id: "987",
          campaign_name: "Acquisition",
          date_start: "2026-08-08",
          impressions: "120",
          clicks: "8",
          spend: "12.50",
          account_currency: "EUR",
        }],
      }));
    const snapshot = await readMetaCampaignInsights(
      "test-token",
      selected,
      7,
      new Date("2026-08-08T12:00:00.000Z"),
    );
    assert.equal(snapshot.rows.length, 1);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: [], paging: { next: "https://example.test/page/2" } }));
    await assert.rejects(
      () => readMetaCampaignInsights("test-token", selected, 7),
      /incomplètes/,
    );

    globalThis.fetch = async () =>
      new Response(JSON.stringify({
        data: [{ campaign_id: "987", campaign_name: "Acquisition", date_start: "2026-08-08", impressions: "1", clicks: "1", spend: "1.00", account_currency: "USD" }],
      }));
    await assert.rejects(
      () => readMetaCampaignInsights("test-token", selected, 7),
      /invalides ou partielles/,
    );

    globalThis.fetch = async () =>
      new Response(JSON.stringify({
        data: Array.from({ length: 2 }, () => ({ campaign_id: "987", campaign_name: "Acquisition", date_start: "2026-08-08", impressions: "1", clicks: "1", spend: "1.00", account_currency: "EUR" })),
      }));
    await assert.rejects(
      () => readMetaCampaignInsights("test-token", selected, 7),
      /ambiguës/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = originalVersion;
  }
});

test("META-READ -- gestes explicites, rôles, démo, pause et lecture sans pagination sont gardés côté serveur", async () => {
  const [actions, authorize, callback, adapter] = await Promise.all([
    readFile(new URL("../app/(cockpit)/connecteurs/[provider]/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/connectors/meta_ads/authorize/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/connectors/meta_ads/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors/meta-ads.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /requireEditor\("meta_ads"\)/);
  assert.match(actions, /withRealDataMutationLock/);
  assert.match(actions, /isConnectorPaused/);
  assert.match(actions, /readMetaAdAccountCandidates\(meta\.config\).*accountId/s);
  assert.match(actions, /event: "meta_ads_metrics_read"/);
  assert.match(authorize, /assertConnectorFlowAllowed/);
  assert.match(callback, /verifyMetaReadScope/);
  assert.match(callback, /META_ADS_SCOPES/);
  assert.match(adapter, /method: "GET"/);
  assert.match(adapter, /object\(payload\.paging\)\?\.next/);
  assert.doesNotMatch(adapter, /\/campaigns\b|\/adsets\b|\/ads\b/);
});
