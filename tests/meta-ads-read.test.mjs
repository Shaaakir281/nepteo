import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { connectorCapability } from "../lib/connectors.ts";
import { META_ADS_SCOPES, MetaReadError } from "../lib/connectors/meta-ads.ts";
import {
  META_ACTION_ATTRIBUTION_WINDOWS,
  META_MAX_CAMPAIGNS,
  META_MAX_METRIC_ROWS,
  applyMetaMetricsSnapshot,
  failureQuality,
  metaMetricWindow,
  readMetaMetricsSnapshot,
  readMetaMetricsState,
} from "../lib/connectors/meta-metrics.ts";

const selectedAccount = {
  id: "act_123456789",
  name: "Compte pilote",
  currency: "EUR",
  timezone: "Europe/Paris",
};

const remoteAccount = {
  ...selectedAccount,
  timezone_name: selectedAccount.timezone,
};

const deployWorkflow = await readFile(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);

const campaign = {
  id: "987",
  name: "Acquisition",
  status: "ACTIVE",
  effective_status: "ACTIVE",
  objective: "OUTCOME_LEADS",
};

function insight(overrides = {}) {
  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    date_start: "2026-08-09",
    impressions: "120",
    clicks: "8",
    spend: "12.50",
    account_currency: "EUR",
    actions: [
      { action_type: "lead", value: "3" },
      { action_type: "link_click", value: "8" },
    ],
    ...overrides,
  };
}

function mockMetaFetch(responses) {
  const calls = [];
  const fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const key = url.pathname.endsWith("/me/adaccounts")
      ? "accounts"
      : url.pathname.endsWith("/campaigns")
        ? `campaigns:${url.searchParams.get("after") ?? "first"}`
        : `insights:${url.searchParams.get("after") ?? "first"}`;
    const value = responses[key];
    if (!value) throw new Error(`Unexpected Meta request: ${key}`);
    return new Response(JSON.stringify(value.body), { status: value.status ?? 200 });
  };
  return { fetch, calls };
}

test("META-METRICS — contrat : ads_read seulement et aucune écriture fournisseur", async () => {
  assert.deepEqual(META_ADS_SCOPES, ["ads_read"]);
  assert.deepEqual(connectorCapability("meta_ads"), {
    activation: "oauth",
    read: true,
    write: false,
    sync: "manual",
  });
  assert.deepEqual(META_ACTION_ATTRIBUTION_WINDOWS, ["7d_click", "1d_view"]);
  assert.equal(META_MAX_CAMPAIGNS, 500);
  assert.equal(META_MAX_METRIC_ROWS, 5_000);

  const adapter = await readFile(new URL("../lib/connectors/meta-ads.ts", import.meta.url), "utf8");
  const metrics = await readFile(new URL("../lib/connectors/meta-metrics.ts", import.meta.url), "utf8");
  assert.match(adapter, /method: "GET"/);
  assert.match(metrics, /\/campaigns/);
  assert.match(metrics, /\/insights/);
  // Le POST OAuth d'échange de code n'est pas une mutation Ads. Le flux de
  // métriques passe uniquement par metaGraphGet, lui-même explicitement GET.
  assert.doesNotMatch(metrics, /method:\s*"(?:POST|PATCH|PUT|DELETE)"/);
  const graphRead = adapter.slice(
    adapter.indexOf("export async function metaGraphGet"),
    adapter.indexOf("function text", adapter.indexOf("export async function metaGraphGet")),
  );
  assert.doesNotMatch(graphRead, /method:\s*"(?:POST|PATCH|PUT|DELETE)"/);
  assert.doesNotMatch(`${adapter}\n${metrics}`, /ads_management/);
});

test("META-METRICS — le déploiement conserve les trois paramètres OAuth sans exposer le secret", () => {
  assert.match(deployWorkflow, /META_OAUTH_APP_ID: \$\{\{ vars\.META_OAUTH_APP_ID \}\}/);
  assert.match(deployWorkflow, /META_OAUTH_APP_SECRET: \$\{\{ secrets\.META_OAUTH_APP_SECRET \}\}/);
  assert.match(deployWorkflow, /META_GRAPH_API_VERSION: \$\{\{ vars\.META_GRAPH_API_VERSION \}\}/);
  assert.match(
    deployWorkflow,
    /add_optional_secret meta-oauth-app-secret "\$\{META_OAUTH_APP_SECRET:-\}"/,
  );
  assert.match(
    deployWorkflow,
    /add_secret_ref META_OAUTH_APP_SECRET meta-oauth-app-secret "\$\{META_OAUTH_APP_SECRET:-\}"/,
  );
  assert.match(deployWorkflow, /Meta OAuth requires app ID, app secret and Graph API version together\./);
  assert.match(deployWorkflow, /META_GRAPH_API_VERSION must use the vN\.N format\./);
});

test("META-METRICS — fenêtre calendaire calculée dans le fuseau du compte", () => {
  assert.deepEqual(
    metaMetricWindow(7, "Europe/Paris", new Date("2026-08-08T23:30:00.000Z")),
    { days: 7, since: "2026-08-03", until: "2026-08-09" },
  );
  assert.throws(() => metaMetricWindow(31, "Europe/Paris"), MetaReadError);
  assert.throws(() => metaMetricWindow(7, "Not/A_Timezone"), /Fuseau/);
});

test("META-METRICS — compte, campagnes et insights sont paginés sans troncature", async () => {
  const originalFetch = globalThis.fetch;
  const originalVersion = process.env.META_GRAPH_API_VERSION;
  const secondCampaign = { ...campaign, id: "988", name: "Retargeting" };
  const mock = mockMetaFetch({
    accounts: { body: { data: [remoteAccount] } },
    "campaigns:first": {
      body: {
        data: [campaign],
        paging: { next: "opaque", cursors: { after: "campaign-page-2" } },
      },
    },
    "campaigns:campaign-page-2": { body: { data: [secondCampaign] } },
    "insights:first": {
      body: {
        data: [insight()],
        paging: { next: "opaque", cursors: { after: "metric-page-2" } },
      },
    },
    "insights:metric-page-2": {
      body: { data: [insight({ campaign_id: "988", campaign_name: "Retargeting" })] },
    },
  });
  try {
    process.env.META_GRAPH_API_VERSION = "v99.0";
    globalThis.fetch = mock.fetch;
    const snapshot = await readMetaMetricsSnapshot(
      "test-token",
      selectedAccount,
      7,
      new Date("2026-08-09T10:00:00.000Z"),
    );
    assert.equal(snapshot.version, 2);
    assert.equal(snapshot.quality, "complete");
    assert.deepEqual(snapshot.campaigns.map((item) => item.id), ["987", "988"]);
    assert.equal(snapshot.rows.length, 2);
    assert.deepEqual(snapshot.rows[0].results, [
      { type: "lead", value: 3, source: "provider_reported" },
      { type: "link_click", value: 8, source: "provider_reported" },
    ]);
    assert.equal(snapshot.account.currency, "EUR");
    assert.equal(snapshot.account.timezone, "Europe/Paris");
    assert.ok(mock.calls.every((call) => call.init?.method === "GET"));
    assert.ok(mock.calls.some((call) => call.url.searchParams.get("after") === "campaign-page-2"));
    assert.ok(mock.calls.some((call) => call.url.searchParams.get("after") === "metric-page-2"));
    const insightCall = mock.calls.find((call) => call.url.pathname.endsWith("/insights"));
    assert.deepEqual(
      JSON.parse(insightCall.url.searchParams.get("action_attribution_windows")),
      ["7d_click", "1d_view"],
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = originalVersion;
  }
});

test("META-METRICS — un résultat absent reste absent, jamais zéro", async () => {
  const originalFetch = globalThis.fetch;
  const originalVersion = process.env.META_GRAPH_API_VERSION;
  const mock = mockMetaFetch({
    accounts: { body: { data: [remoteAccount] } },
    "campaigns:first": { body: { data: [campaign] } },
    "insights:first": { body: { data: [insight({ actions: undefined })] } },
  });
  try {
    process.env.META_GRAPH_API_VERSION = "v99.0";
    globalThis.fetch = mock.fetch;
    const snapshot = await readMetaMetricsSnapshot("token", selectedAccount, 7, new Date("2026-08-09T10:00:00Z"));
    assert.deepEqual(snapshot.rows[0].results, []);
    assert.equal("conversions" in snapshot.rows[0], false);
    assert.equal("revenue" in snapshot.rows[0], false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = originalVersion;
  }
});

test("META-METRICS — page incomplète, devise et campagne incohérentes échouent fermées", async () => {
  const originalFetch = globalThis.fetch;
  const originalVersion = process.env.META_GRAPH_API_VERSION;
  try {
    process.env.META_GRAPH_API_VERSION = "v99.0";
    for (const [responses, expectedCode] of [
      [{
        accounts: { body: { data: [remoteAccount] } },
        "campaigns:first": { body: { data: [campaign], paging: { next: "opaque" } } },
      }, "partial_response"],
      [{
        accounts: { body: { data: [remoteAccount] } },
        "campaigns:first": { body: { data: [campaign] } },
        "insights:first": { body: { data: [insight({ account_currency: "USD" })] } },
      }, "currency_mismatch"],
      [{
        accounts: { body: { data: [remoteAccount] } },
        "campaigns:first": { body: { data: [campaign] } },
        "insights:first": { body: { data: [insight({ campaign_id: "999" })] } },
      }, "partial_response"],
    ]) {
      globalThis.fetch = mockMetaFetch(responses).fetch;
      await assert.rejects(
        () => readMetaMetricsSnapshot("token", selectedAccount, 7, new Date("2026-08-09T10:00:00Z")),
        (error) => error instanceof MetaReadError && error.code === expectedCode,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = originalVersion;
  }
});

test("META-METRICS — une borne dépassée refuse toute photographie", async () => {
  const originalFetch = globalThis.fetch;
  const originalVersion = process.env.META_GRAPH_API_VERSION;
  const tooManyCampaigns = Array.from({ length: META_MAX_CAMPAIGNS + 1 }, (_, index) => ({
    ...campaign,
    id: String(10_000 + index),
  }));
  try {
    process.env.META_GRAPH_API_VERSION = "v99.0";
    globalThis.fetch = mockMetaFetch({
      accounts: { body: { data: [remoteAccount] } },
      "campaigns:first": { body: { data: tooManyCampaigns } },
    }).fetch;
    await assert.rejects(
      () => readMetaMetricsSnapshot("token", selectedAccount, 7, new Date("2026-08-09T10:00:00Z")),
      (error) => error instanceof MetaReadError && error.code === "snapshot_too_large",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = originalVersion;
  }
});

test("META-METRICS — double application réutilise la même clé d'idempotence", async () => {
  const calls = [];
  const admin = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { replayed: calls.length > 1, metrics: 1, results: 2 }, error: null };
    },
  };
  const snapshot = {
    version: 2,
    provider: "meta_ads",
    account: selectedAccount,
    window_days: 7,
    observation_from: "2026-08-03",
    observation_to: "2026-08-09",
    attribution: { model: "requested_windows", windows: ["7d_click", "1d_view"] },
    quality: "complete",
    campaigns: [{ id: "987", name: "Acquisition", status: "ACTIVE", configured_status: "ACTIVE", objective: "OUTCOME_LEADS" }],
    rows: [{ campaign_id: "987", campaign_name: "Acquisition", date: "2026-08-09", impressions: 120, clicks: 8, spend: 12.5, results: [{ type: "lead", value: 3, source: "provider_reported" }] }],
    collected_at: "2026-08-09T10:00:00.000Z",
  };
  const input = {
    organizationId: "00000000-0000-0000-0000-000000000001",
    connectorId: "00000000-0000-0000-0000-000000000002",
    actorId: "00000000-0000-0000-0000-000000000003",
    startedAt: "2026-08-09T09:59:59.000Z",
    snapshot,
  };
  assert.equal((await applyMetaMetricsSnapshot(admin, input)).replayed, false);
  assert.equal((await applyMetaMetricsSnapshot(admin, input)).replayed, true);
  assert.equal(calls[0].name, "apply_meta_metrics_snapshot");
  assert.equal(calls[0].args.p_idempotency_key, calls[1].args.p_idempotency_key);

  const persistenceFailure = { rpc: async () => ({ data: null, error: { code: "XX000", message: "disk failure" } }) };
  await assert.rejects(
    () => applyMetaMetricsSnapshot(persistenceFailure, input),
    (error) => error instanceof MetaReadError && error.code === "persistence_failed",
  );
  const staleFailure = { rpc: async () => ({ data: null, error: { code: "PT409", message: "stale snapshot" } }) };
  await assert.rejects(
    () => applyMetaMetricsSnapshot(staleFailure, input),
    (error) => error instanceof MetaReadError && error.code === "stale_snapshot",
  );

  const reconciliationBuilder = (result) => ({
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return result; },
  });
  const recovered = {
    rpc: async () => ({ data: null, error: { message: "network response lost" } }),
    from: () => reconciliationBuilder({
      data: { quality: "complete", applied: true, metric_count: 1, result_count: 2 },
      error: null,
    }),
  };
  assert.deepEqual(await applyMetaMetricsSnapshot(recovered, input), {
    replayed: true,
    metrics: 1,
    results: 2,
  });
  const ambiguous = {
    rpc: async () => ({ data: null, error: { message: "network response lost" } }),
    from: () => reconciliationBuilder({ data: null, error: { message: "network unavailable" } }),
  };
  await assert.rejects(
    () => applyMetaMetricsSnapshot(ambiguous, input),
    (error) => error instanceof MetaReadError && error.code === "persistence_ambiguous",
  );
});

test("META-METRICS — état qualité et classification d'échec sont explicites", () => {
  assert.equal(failureQuality("partial_response"), "partial");
  assert.equal(failureQuality("snapshot_too_large"), "partial");
  assert.equal(failureQuality("timeout"), "unavailable");
  assert.deepEqual(readMetaMetricsState({
    meta_metrics_state: {
      version: 1,
      quality: "unavailable",
      account_id: "act_123",
      completed_at: "2026-08-09T10:00:00.000Z",
      error_code: "timeout",
    },
  })?.quality, "unavailable");
  assert.equal(readMetaMetricsState({ meta_metrics_state: { quality: "complete" } }), null);
});

test("META-METRICS — orchestration serveur sépare lecture distante et verrou d'application", async () => {
  const actions = await readFile(
    new URL("../app/(cockpit)/connecteurs/[provider]/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /readMetaMetricsSnapshot[\s\S]*withRealDataMutationLock[\s\S]*applyMetaMetricsSnapshot/);
  assert.match(actions, /recordMetaMetricsFailure/);
  assert.match(actions, /requireEditor\("meta_ads"\)/);
  assert.match(actions, /isConnectorPaused/);
  assert.doesNotMatch(actions, /meta_insights_snapshot:\s*snapshot/);
});
