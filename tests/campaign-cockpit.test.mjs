/** CAMP-2 — cockpit de décision reproductible, sans I/O. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCampaignCockpit,
  CAMPAIGN_COCKPIT_CHANNELS,
  CAMPAIGN_COCKPIT_STATUSES,
} from "../lib/campaign-cockpit.ts";

const WINDOW = { from: "2026-07-03", to: "2026-08-01" };
const COMPARISON = { kind: "period", from: "2026-06-03", to: "2026-07-02" };
const ALL = { channels: "all", statuses: "all" };

const metric = (overrides = {}) => ({
  provider: "meta_ads",
  campaign_id: "campaign-1",
  campaign_name: "Acquisition",
  date: "2026-07-10",
  impressions: 10_000,
  clicks: 500,
  spend: "100.00",
  conversions: 5,
  revenue: "250.00",
  synced_at: "2026-08-01T08:00:00Z",
  ...overrides,
});

const action = (overrides = {}) => ({
  id: "action-1",
  kind: "ads_pause_campaign-1",
  title: "Revoir Acquisition",
  status: "rejected",
  created_at: "2026-07-20T10:00:00Z",
  decided_at: "2026-07-20T11:00:00Z",
  confidence: null,
  data_sources: ["Meta Ads"],
  payload: { provider: "meta_ads", campaign_id: "campaign-1", campaign_name: "Acquisition" },
  ...overrides,
});

const journalEntry = (overrides = {}) => ({
  id: "journal-1",
  action_id: "action-1",
  event: "action_rejected",
  created_at: "2026-07-20T11:00:00Z",
  payload: {},
  ...overrides,
});

const build = (overrides = {}) => buildCampaignCockpit({
  rows: [metric()],
  actions: [],
  journal: [],
  providerStatuses: [],
  window: WINDOW,
  comparison: COMPARISON,
  filters: ALL,
  ...overrides,
});

test("CAMP-2 — expose uniquement les canaux et statuts honnêtes du contrat", () => {
  assert.deepEqual(CAMPAIGN_COCKPIT_CHANNELS, ["meta", "google", "linkedin", "email"]);
  assert.deepEqual(CAMPAIGN_COCKPIT_STATUSES, [
    "active", "ended", "waiting", "blocked", "recent_data", "historical_data",
  ]);
});

test("CAMP-2 — données absentes ou ambiguës échouent sans métrique fictive", () => {
  assert.deepEqual(build({ rows: null }), { ok: false, error: "rows_unavailable" });
  assert.deepEqual(build({ actions: null }), { ok: false, error: "actions_unavailable" });
  assert.deepEqual(build({ journal: null }), { ok: false, error: "journal_unavailable" });
  assert.deepEqual(build({ providerStatuses: null }), {
    ok: false,
    error: "provider_statuses_unavailable",
  });
  assert.deepEqual(build({ rows: [metric({ spend: -1 })] }), {
    ok: false,
    error: "invalid_metric_row",
    invalidIndex: 0,
  });
  assert.deepEqual(build({ rows: [metric({ impressions: undefined })] }), {
    ok: false,
    error: "invalid_metric_row",
    invalidIndex: 0,
  });
  assert.deepEqual(build({ rows: [metric({ clicks: undefined })] }), {
    ok: false,
    error: "invalid_metric_row",
    invalidIndex: 0,
  });
  assert.equal(build({ rows: [metric({ impressions: 10, clicks: 11 })] }).ok, true);
  assert.deepEqual(build({ rows: [metric(), metric()] }), {
    ok: false,
    error: "duplicate_metric_row",
    invalidIndex: 1,
  });

  const empty = build({ rows: [] });
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.cockpit.totals, {
    status: "unavailable",
    reason: "no_rows_in_window",
    metrics: null,
  });
  assert.deepEqual(empty.cockpit.campaigns, []);
  assert.equal(empty.cockpit.recommendation, null);
});

test("CAMP-2 — fenêtre incluse, futur exclu et comparaison sont explicites", () => {
  const result = build({
    rows: [
      metric({ date: "2026-07-03", spend: 30, conversions: 3, revenue: 60 }),
      metric({ date: "2026-08-01", spend: 20, conversions: 2, revenue: 40 }),
      metric({ date: "2026-06-03", spend: 25, conversions: 1, revenue: 25 }),
      metric({ date: "2026-07-02", spend: 25, conversions: 1, revenue: 25 }),
      metric({ date: "2026-08-02", spend: 999, conversions: 99, revenue: 999 }),
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.cockpit.window, WINDOW);
  assert.deepEqual(result.cockpit.comparisonPeriod, COMPARISON);
  assert.deepEqual(result.cockpit.totals.metrics, {
    impressions: 20_000,
    clicks: 1_000,
    spend: 50,
    conversions: 5,
    revenue: 100,
    cac: 10,
    roas: 2,
    cpm: { status: "available", value: 2.5 },
    ctr: { status: "available", value: 0.05 },
  });
  assert.equal(result.cockpit.comparison.status, "available");
  assert.deepEqual(result.cockpit.comparison.previous, {
    impressions: 20_000,
    clicks: 1_000,
    spend: 50,
    conversions: 2,
    revenue: 50,
    cac: 25,
    roas: 1,
    cpm: { status: "available", value: 2.5 },
    ctr: { status: "available", value: 0.05 },
  });
  assert.deepEqual(result.cockpit.comparison.changes, {
    spend: 0,
    conversions: 1.5,
    revenue: 1,
    cac: -0.6,
    roas: 1,
    cpm: { status: "available", value: 0 },
    ctr: { status: "available", value: 0 },
  });
  assert.deepEqual(result.cockpit.comparison.source, {
    kind: "ad_metrics",
    currentPeriod: WINDOW,
    previousPeriod: { from: COMPARISON.from, to: COMPARISON.to },
    currentRowCount: 2,
    previousRowCount: 2,
  });
  assert.equal(result.cockpit.provenance.futureMetricRowsExcluded, 1);
});

test("CAMP-2 — CPM/CTR observés et diagnostic descriptif dérivent des mêmes périodes", () => {
  const result = build({
    rows: [
      metric({ date: "2026-07-10", impressions: 1_000, clicks: 60, spend: 20 }),
      metric({ date: "2026-06-10", impressions: 2_000, clicks: 80, spend: 50 }),
      metric({ date: "2026-08-02", impressions: 1, clicks: 1, spend: 999 }),
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.cockpit.totals.metrics.cpm, { status: "available", value: 20 });
  assert.deepEqual(result.cockpit.totals.metrics.ctr, { status: "available", value: 0.06 });
  assert.deepEqual(result.cockpit.comparison.previous.cpm, { status: "available", value: 25 });
  assert.deepEqual(result.cockpit.comparison.previous.ctr, { status: "available", value: 0.04 });
  assert.deepEqual(result.cockpit.comparison.changes.cpm, { status: "available", value: -0.2 });
  assert.deepEqual(result.cockpit.comparison.changes.ctr, { status: "available", value: 0.5 });
  assert.deepEqual(result.cockpit.deliveryDiagnostic, {
    kind: "observed_delivery_comparison",
    status: "available",
    pattern: "higher_ctr_lower_cpm",
    directions: { cpm: "lower", ctr: "higher" },
    current: { cpm: 20, ctr: 0.06 },
    previous: { cpm: 25, ctr: 0.04 },
    source: {
      kind: "ad_metrics",
      currentPeriod: WINDOW,
      previousPeriod: { from: COMPARISON.from, to: COMPARISON.to },
      currentRowCount: 1,
      previousRowCount: 1,
    },
    interpretation: "descriptive_only_no_causality",
    confidence: { value: null, basis: "not_calibrated" },
  });
  assert.deepEqual(result.cockpit.campaigns[0].deliveryDiagnostic, result.cockpit.deliveryDiagnostic);
  assert.equal(result.cockpit.provenance.futureMetricRowsExcluded, 1);
  assert.doesNotMatch(JSON.stringify(result.cockpit.deliveryDiagnostic), /fatigue|saturation/i);
});

test("CAMP-2 — impressions nulles rendent CPM, CTR et diagnostic explicitement indisponibles", () => {
  const currentUnavailable = build({
    rows: [
      metric({ date: "2026-07-10", impressions: 0, clicks: 0, spend: 10 }),
      metric({ date: "2026-06-10", impressions: 1_000, clicks: 50, spend: 20 }),
    ],
  });
  assert.deepEqual(currentUnavailable.cockpit.totals.metrics.cpm, {
    status: "unavailable",
    value: null,
    reason: "zero_impressions",
  });
  assert.deepEqual(currentUnavailable.cockpit.totals.metrics.ctr, {
    status: "unavailable",
    value: null,
    reason: "zero_impressions",
  });
  assert.deepEqual(currentUnavailable.cockpit.comparison.changes.cpm, {
    status: "unavailable",
    value: null,
    reason: "current_metric_unavailable",
  });
  assert.equal(currentUnavailable.cockpit.deliveryDiagnostic.status, "unavailable");
  assert.equal(currentUnavailable.cockpit.deliveryDiagnostic.reason, "current_zero_impressions");

  const previousUnavailable = build({
    rows: [
      metric({ date: "2026-07-10", impressions: 1_000, clicks: 50, spend: 20 }),
      metric({ date: "2026-06-10", impressions: 0, clicks: 0, spend: 10 }),
    ],
  });
  assert.deepEqual(previousUnavailable.cockpit.comparison.changes.ctr, {
    status: "unavailable",
    value: null,
    reason: "previous_metric_unavailable",
  });
  assert.equal(previousUnavailable.cockpit.deliveryDiagnostic.reason, "previous_zero_impressions");
});

test("CAMP-2 — base CPM/CTR nulle ne devient ni Infinity ni tendance fictive", () => {
  const result = build({
    rows: [
      metric({ date: "2026-07-10", impressions: 1_000, clicks: 50, spend: 20 }),
      metric({ date: "2026-06-10", impressions: 1_000, clicks: 0, spend: 0 }),
    ],
  });
  assert.deepEqual(result.cockpit.comparison.previous.cpm, { status: "available", value: 0 });
  assert.deepEqual(result.cockpit.comparison.previous.ctr, { status: "available", value: 0 });
  assert.deepEqual(result.cockpit.comparison.changes.cpm, {
    status: "unavailable",
    value: null,
    reason: "zero_previous_value",
  });
  assert.deepEqual(result.cockpit.comparison.changes.ctr, {
    status: "unavailable",
    value: null,
    reason: "zero_previous_value",
  });
  assert.equal(result.cockpit.deliveryDiagnostic.status, "available");
  assert.deepEqual(result.cockpit.deliveryDiagnostic.directions, { cpm: "higher", ctr: "higher" });
  assert.equal(result.cockpit.deliveryDiagnostic.pattern, "mixed_or_unchanged");
});

test("CAMP-2 — comparaison désactivée ou sans base ne fabrique aucune tendance", () => {
  const disabled = build({ comparison: { kind: "none" } });
  assert.equal(disabled.cockpit.comparison.status, "unavailable");
  assert.equal(disabled.cockpit.comparison.reason, "disabled");
  assert.equal(disabled.cockpit.deliveryDiagnostic.reason, "comparison_disabled");

  const noPrevious = build();
  assert.equal(noPrevious.cockpit.comparison.status, "unavailable");
  assert.equal(noPrevious.cockpit.comparison.reason, "no_previous_rows");
  assert.equal(noPrevious.cockpit.deliveryDiagnostic.reason, "no_previous_rows");
  assert.deepEqual(build({ comparison: { kind: "period", from: "2026-07-01", to: "2026-07-10" } }), {
    ok: false,
    error: "invalid_comparison",
  });
});

test("CAMP-2 — la récence seule n'invente jamais active ou terminée", () => {
  const result = build({
    rows: [
      metric({ campaign_id: "recent", campaign_name: "Récente", date: "2026-07-31" }),
      metric({ campaign_id: "past", campaign_name: "Historique", date: "2026-05-01" }),
    ],
  });
  assert.equal(result.ok, true);
  const byId = Object.fromEntries(result.cockpit.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  assert.equal(byId.recent.status.value, "recent_data");
  assert.equal(byId.recent.status.basis, "metric_recency");
  assert.equal(byId.past.status.value, "historical_data");
  assert.equal(byId.past.performance.scope, "observed_history");
  assert.ok(!result.cockpit.campaigns.some((campaign) => ["active", "ended"].includes(campaign.status.value)));
});

test("CAMP-2 — active/ended exigent un statut fournisseur valide et daté", () => {
  const result = build({
    rows: [
      metric({ campaign_id: "live", campaign_name: "Live" }),
      metric({ campaign_id: "ended", campaign_name: "Ended", date: "2026-05-01" }),
    ],
    providerStatuses: [
      { provider: "meta_ads", campaign_id: "live", status: "active", observed_at: "2026-08-01T09:00:00Z" },
      { provider: "meta_ads", campaign_id: "ended", status: "ended", observed_at: "2026-08-01T09:00:00Z" },
      { provider: "meta_ads", campaign_id: "live", status: "ended", observed_at: "2026-08-02T09:00:00Z" },
    ],
  });
  const byId = Object.fromEntries(result.cockpit.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  assert.equal(byId.live.status.value, "active", "le snapshot futur est exclu");
  assert.equal(byId.live.status.source.provider, "meta_ads");
  assert.equal(byId.ended.status.value, "ended");

  assert.deepEqual(build({
    providerStatuses: [{ provider: "meta_ads", campaign_id: "live", status: "paused", observed_at: "2026-08-01T09:00:00Z" }],
  }), { ok: false, error: "invalid_provider_status_row", invalidIndex: 0 });

  assert.deepEqual(build({ providerStatuses: [
    { provider: "meta_ads", campaign_id: "campaign-1", status: "active", observed_at: "2026-08-01T09:00:00Z" },
    { provider: "meta_ads", campaign_id: "campaign-1", status: "ended", observed_at: "2026-08-01T09:00:00Z" },
  ] }), { ok: false, error: "conflicting_provider_status", invalidIndex: 1 });
});

test("CAMP-2 — attente et blocage viennent seulement d'une action ou du journal", () => {
  const waitingAction = action({
    id: "launch-1",
    kind: "launch_campaign",
    status: "approved",
    decided_at: "2026-07-25T10:00:00Z",
    payload: { provider: "meta_ads", campaign_id: "waiting", campaign_name: "Proposition validée" },
  });
  const blockedJournal = journalEntry({
    id: "block-1",
    action_id: null,
    event: "campaign_blocked",
    created_at: "2026-07-30T10:00:00Z",
    payload: {
      provider: "meta_ads",
      campaign_id: "blocked",
      campaign_name: "Campagne bloquée",
      reason: "Permission fournisseur manquante",
    },
  });
  const result = build({
    rows: [
      metric({ campaign_id: "waiting", campaign_name: "Proposition validée" }),
      metric({ campaign_id: "blocked", campaign_name: "Campagne bloquée" }),
    ],
    actions: [waitingAction],
    journal: [blockedJournal],
  });
  const byId = Object.fromEntries(result.cockpit.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  assert.equal(byId.waiting.status.value, "waiting");
  assert.equal(byId.waiting.status.basis, "action");
  assert.equal(byId.waiting.status.source.status, "approved");
  assert.equal(byId.waiting.status.source.at, "2026-07-25T10:00:00.000Z");
  assert.equal(byId.blocked.status.value, "blocked");
  assert.equal(byId.blocked.status.basis, "journal");

  const latestDecisionWins = build({
    rows: [metric({ campaign_id: "waiting", campaign_name: "Proposition validée" })],
    actions: [
      waitingAction,
      action({
        id: "launch-created-later",
        kind: "launch_campaign",
        status: "postponed",
        created_at: "2026-07-24T10:00:00Z",
        decided_at: "2026-07-24T11:00:00Z",
        payload: { provider: "meta_ads", campaign_id: "waiting", campaign_name: "Proposition validée" },
      }),
    ],
  });
  assert.equal(latestDecisionWins.ok, true);
  assert.equal(latestDecisionWins.cockpit.campaigns[0].status.source.actionId, "launch-1");
  assert.equal(latestDecisionWins.cockpit.campaigns[0].status.source.at, "2026-07-25T10:00:00.000Z");
  assert.equal(byId.blocked.status.source.reason, "Permission fournisseur manquante");
  assert.equal(result.cockpit.recommendation.kind, "resolve_observed_blocker");
  assert.equal(result.cockpit.recommendation.confidence.value, null);

  const journalOnly = build({ rows: [], journal: [blockedJournal] });
  assert.equal(journalOnly.cockpit.campaigns.length, 1);
  assert.equal(journalOnly.cockpit.campaigns[0].status.value, "blocked");
  assert.equal(journalOnly.cockpit.campaigns[0].performance, null);
});

test("CAMP-2 — un statut journalisé sans motif borné échoue fermé", () => {
  for (const event of ["campaign_waiting", "campaign_blocked"]) {
    for (const reason of [undefined, "   ", "x".repeat(501)]) {
      assert.deepEqual(build({
        journal: [journalEntry({
          action_id: null,
          event,
          payload: {
            provider: "meta_ads",
            campaign_id: "campaign-1",
            campaign_name: "Acquisition",
            reason,
          },
        })],
      }), { ok: false, error: "invalid_journal_row", invalidIndex: 0 });
    }
  }

  const clearedWithoutReason = build({
    journal: [journalEntry({
      action_id: null,
      event: "campaign_status_cleared",
      payload: {
        provider: "meta_ads",
        campaign_id: "campaign-1",
        campaign_name: "Acquisition",
      },
    })],
  });
  assert.equal(clearedWithoutReason.ok, true);
});

test("CAMP-2 — un blocage levé sans autre preuve ne laisse aucun statut fantôme", () => {
  const blocked = journalEntry({
    id: "blocked-before-clear",
    action_id: null,
    event: "campaign_blocked",
    created_at: "2026-07-29T10:00:00Z",
    payload: {
      provider: "meta_ads",
      campaign_id: "cleared",
      campaign_name: "Campagne débloquée",
      reason: "Permission fournisseur manquante",
    },
  });
  const cleared = journalEntry({
    id: "clear-after-block",
    action_id: null,
    event: "campaign_status_cleared",
    created_at: "2026-07-30T10:00:00Z",
    payload: {
      provider: "meta_ads",
      campaign_id: "cleared",
      campaign_name: "Campagne débloquée",
    },
  });

  const result = build({ rows: [], journal: [blocked, cleared] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.cockpit.campaigns, []);
  assert.deepEqual(
    result.cockpit.history.unlinkedJournalEvents.map(({ event }) => event),
    ["campaign_status_cleared", "campaign_blocked"],
  );
});

test("CAMP-2 — le vrai payload CAMP-0/1 reste une proposition interne, jamais un id fournisseur", () => {
  const result = build({
    rows: [],
    actions: [action({
      id: "launch-real-shape",
      kind: "launch_campaign",
      title: "Préparer la campagne « Acquisition » sur LinkedIn",
      status: "approved",
      decided_at: "2026-07-25T10:00:00Z",
      payload: {
        proposalVersion: 1,
        brief: { channel: "linkedin" },
        plan: { totalBudget: 420 },
        execution: "not_available_camp_1",
      },
    })],
  });

  assert.equal(result.ok, true);
  assert.equal(result.cockpit.campaigns.length, 1);
  assert.deepEqual(
    {
      key: result.cockpit.campaigns[0].key,
      campaignId: result.cockpit.campaigns[0].campaignId,
      channel: result.cockpit.campaigns[0].channel,
      internal: result.cockpit.campaigns[0].internal,
      status: result.cockpit.campaigns[0].status.value,
      statusBasis: result.cockpit.campaigns[0].status.basis,
      performance: result.cockpit.campaigns[0].performance,
    },
    {
      key: "internal-action:linkedin:launch-real-shape",
      campaignId: "launch-real-shape",
      channel: "linkedin",
      internal: true,
      status: "waiting",
      statusBasis: "action",
      performance: null,
    },
  );
  assert.equal(result.cockpit.history.attempts[0].campaignKey, result.cockpit.campaigns[0].key);
  assert.equal(result.cockpit.history.attempts[0].channel, "linkedin");

  const withCoincidentalProviderStatus = build({
    rows: [],
    actions: [action({
      id: "launch-real-shape",
      kind: "launch_campaign",
      title: "Préparer une campagne",
      status: "proposed",
      decided_at: null,
      payload: { brief: { channel: "linkedin" } },
    })],
    providerStatuses: [{
      provider: "linkedin_ads",
      campaign_id: "launch-real-shape",
      status: "active",
      observed_at: "2026-08-01T09:00:00Z",
    }],
  });
  assert.equal(withCoincidentalProviderStatus.cockpit.campaigns[0].status.value, "waiting");
  assert.equal(withCoincidentalProviderStatus.cockpit.campaigns[0].status.basis, "action");
});

test("CAMP-2 — une référence sans provider ne traverse jamais deux canaux ambigus", () => {
  const result = build({
    rows: [
      metric({ provider: "meta_ads", campaign_id: "shared", campaign_name: "Meta shared" }),
      metric({ provider: "linkedin_ads", campaign_id: "shared", campaign_name: "LinkedIn shared" }),
    ],
    actions: [action({
      kind: "launch_campaign",
      status: "proposed",
      decided_at: null,
      payload: { campaign_id: "shared", campaign_name: "Ambiguë" },
    })],
  });
  assert.equal(result.ok, true);
  assert.ok(result.cockpit.campaigns.every((campaign) => campaign.status.value === "recent_data"));
  assert.ok(result.cockpit.campaigns.every((campaign) => campaign.attempts.length === 0));
  assert.equal(result.cockpit.history.attempts[0].campaignKey, null);
});

test("CAMP-2 — filtres canal/statut agissent aussi sur les totaux", () => {
  const result = build({
    rows: [
      metric({ campaign_id: "meta", campaign_name: "Meta", spend: 100, revenue: 200 }),
      metric({ provider: "linkedin_ads", campaign_id: "li", campaign_name: "LinkedIn", spend: 50, revenue: 10 }),
    ],
    providerStatuses: [
      { provider: "meta_ads", campaign_id: "meta", status: "active", observed_at: "2026-08-01T08:00:00Z" },
      { provider: "linkedin_ads", campaign_id: "li", status: "ended", observed_at: "2026-08-01T08:00:00Z" },
    ],
    filters: { channels: ["linkedin"], statuses: ["ended"] },
  });
  assert.deepEqual(result.cockpit.campaigns.map((campaign) => campaign.key), ["linkedin_ads:li"]);
  assert.equal(result.cockpit.totals.metrics.spend, 50);
  assert.deepEqual(result.cockpit.filters, { channels: ["linkedin"], statuses: ["ended"] });
});

test("CAMP-2 — KPI n'affichent ni CAC ni ROAS quand leur dénominateur manque", () => {
  const noConversion = build({ rows: [metric({ conversions: 0, spend: 20, revenue: 0 })] });
  assert.deepEqual(noConversion.cockpit.totals.metrics, {
    impressions: 10_000,
    clicks: 500,
    spend: 20,
    conversions: 0,
    revenue: 0,
    cac: null,
    roas: 0,
    cpm: { status: "available", value: 2 },
    ctr: { status: "available", value: 0.05 },
  });
  assert.equal(noConversion.cockpit.campaigns[0].reading.verdict, "spend_without_conversion");

  const noSpend = build({ rows: [metric({ conversions: 2, spend: 0, revenue: 10 })] });
  assert.equal(noSpend.cockpit.totals.metrics.roas, null);
  assert.equal(noSpend.cockpit.campaigns[0].reading.verdict, "no_positive_spend");
});

test("CAMP-2 — recommandation prioritaire est observée, sourcée, non calibrée et non répétée", () => {
  const rows = [
    metric({ campaign_id: "loss-small", campaign_name: "Petite perte", spend: 100, revenue: 80, conversions: 4 }),
    metric({ campaign_id: "loss-big", campaign_name: "Grande perte", spend: 300, revenue: 20, conversions: 2 }),
    metric({ campaign_id: "positive", campaign_name: "Positive", spend: 100, revenue: 400, conversions: 10 }),
  ];
  const result = build({ rows });
  assert.equal(result.cockpit.recommendation.kind, "review_observed_underperformance");
  assert.equal(result.cockpit.recommendation.campaignId, "loss-big");
  assert.deepEqual(result.cockpit.recommendation.confidence, {
    value: null,
    basis: "not_calibrated",
  });
  assert.equal(result.cockpit.recommendation.evidence.kind, "ad_metrics");
  assert.equal(result.cockpit.recommendation.evidence.rowCount, 1);
  assert.ok(!("forecast" in result.cockpit.recommendation));
  assert.doesNotMatch(JSON.stringify(result.cockpit), /forecast|projection/i);

  const alreadyAttempted = build({
    rows,
    actions: [
      action({
        id: "old-big",
        kind: "ads_pause_loss-big",
        payload: { provider: "meta_ads", campaign_id: "loss-big", campaign_name: "Grande perte" },
      }),
    ],
    journal: [journalEntry({ action_id: "old-big" })],
  });
  assert.equal(alreadyAttempted.cockpit.recommendation.campaignId, "loss-small");
});

test("CAMP-2 — historique actions/journal reste rattaché, motivé et sourcé", () => {
  const result = build({
    actions: [action({
      confidence: 0.72,
      decision_reason: "Budget à conserver pour la campagne principale.",
    })],
    journal: [journalEntry()],
  });
  assert.equal(result.cockpit.history.attempts.length, 1);
  assert.equal(
    result.cockpit.history.attempts[0].decisionReason,
    "Budget à conserver pour la campagne principale.",
  );
  assert.equal(
    result.cockpit.history.attempts[0].recordedConfidence,
    null,
    "une ancienne confiance ads_pause n'est pas présentée comme calculée par CAMP-2",
  );
  assert.deepEqual(result.cockpit.history.attempts[0].journalEvents, [
    { id: "journal-1", event: "action_rejected", at: "2026-07-20T11:00:00.000Z" },
  ]);
  assert.equal(result.cockpit.campaigns[0].attempts[0].actionId, "action-1");
  assert.deepEqual(result.cockpit.history.unlinkedJournalEvents, []);
});

test("CAMP-2 — résultat déterministe et entrées non mutées", () => {
  const rows = [
    metric({ campaign_id: "b", campaign_name: "B", spend: "10.10", revenue: "20.20" }),
    metric({ campaign_id: "a", campaign_name: "A", spend: "10.20", revenue: "20.40" }),
  ];
  const actions = [action()];
  const journal = [journalEntry()];
  const before = structuredClone({ rows, actions, journal });
  const first = build({ rows, actions, journal });
  const second = build({ rows: [...rows].reverse(), actions: [...actions], journal: [...journal] });
  assert.deepEqual(first, second);
  assert.deepEqual({ rows, actions, journal }, before);
  assert.deepEqual(first.cockpit.campaigns.map((campaign) => campaign.campaignId), ["a", "b"]);
  assert.equal(first.cockpit.totals.metrics.spend, 20.3, "somme exacte en centimes");
});
