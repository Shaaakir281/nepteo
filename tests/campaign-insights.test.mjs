/** CAMP-2 — questions analytiques bornées et rapport hebdomadaire pur. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  answerCampaignAnalyticQuestion,
  buildCampaignWeeklyReport,
  CAMPAIGN_ANALYTIC_QUESTIONS,
} from "../lib/campaign-insights.ts";
import { buildCampaignCockpit } from "../lib/campaign-cockpit.ts";

const WINDOW = { from: "2026-07-26", to: "2026-08-01" };
const COMPARISON = { kind: "period", from: "2026-07-19", to: "2026-07-25" };
const FILTERS = { channels: "all", statuses: "all" };

const metric = (overrides = {}) => ({
  provider: "meta_ads",
  campaign_id: "campaign-1",
  campaign_name: "Acquisition",
  date: "2026-07-28",
  impressions: 10_000,
  clicks: 500,
  spend: 100,
  conversions: 5,
  revenue: 250,
  synced_at: "2026-08-01T08:00:00Z",
  ...overrides,
});

const cockpit = (overrides = {}) => {
  const result = buildCampaignCockpit({
    rows: [
      metric(),
      metric({
        date: "2026-07-21",
        impressions: 8_000,
        clicks: 320,
        spend: 120,
        conversions: 4,
        revenue: 180,
        synced_at: "2026-07-25T08:00:00Z",
      }),
    ],
    actions: [],
    journal: [],
    providerStatuses: [],
    window: WINDOW,
    comparison: COMPARISON,
    filters: FILTERS,
    ...overrides,
  });
  assert.equal(result.ok, true);
  return result.cockpit;
};

test("CAMP-2 insights — le rapport 7 jours contre 7 jours est exact, sourcé et déterministe", () => {
  const input = cockpit();
  const before = structuredClone(input);
  const first = buildCampaignWeeklyReport(input);
  const second = buildCampaignWeeklyReport(input);

  assert.equal(first.status, "available");
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.deepEqual(first.period, {
    current: WINDOW,
    previous: { from: COMPARISON.from, to: COMPARISON.to },
  });
  assert.deepEqual(first.source, {
    kind: "ad_metrics",
    provider: "meta_ads",
    currentRowCount: 1,
    previousRowCount: 1,
    currentLastSyncedAt: "2026-08-01T08:00:00.000Z",
    filters: { channels: "all", statuses: "all" },
  });
  assert.deepEqual(first.totals.current, {
    impressions: 10_000,
    clicks: 500,
    spend: 100,
    conversions: 5,
    revenue: 250,
    cac: 20,
    roas: 2.5,
    cpm: { status: "available", value: 10 },
    ctr: { status: "available", value: 0.05 },
  });
  assert.deepEqual(first.totals.previous, {
    impressions: 8_000,
    clicks: 320,
    spend: 120,
    conversions: 4,
    revenue: 180,
    cac: 30,
    roas: 1.5,
    cpm: { status: "available", value: 15 },
    ctr: { status: "available", value: 0.04 },
  });
  assert.deepEqual(first.campaigns.map(({ key, status }) => ({ key, status })), [
    { key: "meta_ads:campaign-1", status: "available" },
  ]);
  assert.equal(first.evidence, "observed_values_only");
});

test("CAMP-2 insights — comparaison absente ou période précédente vide échoue fermée", () => {
  const withoutComparison = cockpit({ comparison: { kind: "none" } });
  const noComparisonReport = buildCampaignWeeklyReport(withoutComparison);
  assert.deepEqual(noComparisonReport, {
    kind: "campaign_weekly_report",
    status: "unavailable",
    reason: "comparison_not_configured",
    period: { current: WINDOW, previous: null },
    source: {
      kind: "ad_metrics",
      provider: "meta_ads",
      currentRowCount: 1,
      previousRowCount: null,
      currentLastSyncedAt: "2026-08-01T08:00:00.000Z",
      filters: { channels: "all", statuses: "all" },
    },
  });

  const withoutPreviousRows = cockpit({ rows: [metric()] });
  const missingReport = buildCampaignWeeklyReport(withoutPreviousRows);
  assert.equal(missingReport.status, "unavailable");
  assert.equal(missingReport.reason, "no_previous_rows");
  assert.deepEqual(missingReport.period, {
    current: WINDOW,
    previous: { from: COMPARISON.from, to: COMPARISON.to },
  });
  assert.deepEqual(missingReport.source, {
    kind: "ad_metrics",
    provider: "meta_ads",
    currentRowCount: 1,
    previousRowCount: 0,
    currentLastSyncedAt: "2026-08-01T08:00:00.000Z",
    filters: { channels: "all", statuses: "all" },
  });
});

test("CAMP-2 insights — seules deux périodes adjacentes de sept jours sont acceptées", () => {
  const longWindow = cockpit({
    window: { from: "2026-07-03", to: "2026-08-01" },
    comparison: { kind: "period", from: "2026-06-03", to: "2026-07-02" },
  });
  assert.equal(buildCampaignWeeklyReport(longWindow).reason, "current_period_not_seven_days");

  const longComparison = cockpit({
    comparison: { kind: "period", from: "2026-07-18", to: "2026-07-25" },
  });
  assert.equal(buildCampaignWeeklyReport(longComparison).reason, "previous_period_not_seven_days");

  const nonAdjacent = cockpit({
    comparison: { kind: "period", from: "2026-07-18", to: "2026-07-24" },
  });
  assert.equal(buildCampaignWeeklyReport(nonAdjacent).reason, "periods_not_adjacent");
});

test("CAMP-2 insights — une incohérence entre totaux, comparaison et source est refusée", () => {
  const input = cockpit();
  input.comparison.source.currentRowCount = 2;
  const report = buildCampaignWeeklyReport(input);
  assert.equal(report.status, "unavailable");
  assert.equal(report.reason, "source_inconsistent");
});

test("CAMP-2 insights — aucune variation agrégée incohérente n’est recopiée", () => {
  for (const key of ["spend", "conversions", "revenue", "cac", "roas"]) {
    const input = cockpit();
    input.comparison.changes[key] = 42;
    const report = buildCampaignWeeklyReport(input);
    assert.equal(report.status, "unavailable", key);
    assert.equal(report.reason, "source_inconsistent", key);
  }
  for (const key of ["cpm", "ctr"]) {
    const input = cockpit();
    input.comparison.changes[key] = { status: "available", value: 42 };
    const report = buildCampaignWeeklyReport(input);
    assert.equal(report.status, "unavailable", key);
    assert.equal(report.reason, "source_inconsistent", key);
  }
});

test("CAMP-2 insights — une ligne campagne mutée fait échouer le rapport complet", () => {
  const currentMutation = cockpit();
  currentMutation.campaigns[0].comparison.current.spend = 999;
  let report = buildCampaignWeeklyReport(currentMutation);
  assert.equal(report.status, "unavailable");
  assert.equal(report.reason, "source_inconsistent");

  const changeMutation = cockpit();
  changeMutation.campaigns[0].comparison.changes.spend = 42;
  report = buildCampaignWeeklyReport(changeMutation);
  assert.equal(report.status, "unavailable");
  assert.equal(report.reason, "source_inconsistent");
});

test("CAMP-2 insights — la provenance courante campagne et agrégat est cohérente", () => {
  for (const [field, value] of [
    ["from", "2026-07-25"],
    ["to", "2026-08-02"],
    ["provider", "google_ads"],
  ]) {
    const input = cockpit();
    input.campaigns[0].performance.source[field] = value;
    const report = buildCampaignWeeklyReport(input);
    assert.equal(report.status, "unavailable", field);
    assert.equal(report.reason, "source_inconsistent", field);
  }

  const providerMutation = cockpit();
  providerMutation.totals.source.provider = "google_ads";
  let report = buildCampaignWeeklyReport(providerMutation);
  assert.equal(report.status, "unavailable");
  assert.equal(report.reason, "source_inconsistent");

  const syncMutation = cockpit();
  syncMutation.totals.source.lastSyncedAt = "2026-08-02T08:00:00.000Z";
  report = buildCampaignWeeklyReport(syncMutation);
  assert.equal(report.status, "unavailable");
  assert.equal(report.reason, "source_inconsistent");
});

test("CAMP-2 insights — la période précédente agrégée concorde avec les campagnes", () => {
  const input = cockpit();
  input.comparison.previous.spend = 999;
  input.comparison.previous.cac = 249.75;
  input.comparison.previous.roas = 0.18;
  input.comparison.changes.spend = -0.8999;
  input.comparison.changes.cac = -0.9199;
  input.comparison.changes.roas = 12.8889;
  const report = buildCampaignWeeklyReport(input);
  assert.equal(report.status, "unavailable");
  assert.equal(report.reason, "source_inconsistent");
});

test("CAMP-2 insights — les filtres du snapshot restent dans la provenance", () => {
  const report = buildCampaignWeeklyReport(cockpit({
    filters: { channels: ["meta"], statuses: ["recent_data"] },
  }));
  assert.equal(report.status, "available");
  assert.deepEqual(report.source.filters, {
    channels: ["meta"],
    statuses: ["recent_data"],
  });
});

test("CAMP-2 insights — le dock expose quatre choix fixes et refuse tout texte libre", () => {
  assert.deepEqual(CAMPAIGN_ANALYTIC_QUESTIONS.map(({ id }) => id), [
    "weekly_observed_totals",
    "weekly_observed_changes",
    "weekly_delivery_changes",
    "weekly_campaign_coverage",
  ]);
  assert.deepEqual(answerCampaignAnalyticQuestion(cockpit(), "Pourquoi cela baisse-t-il ?"), {
    ok: false,
    error: "unsupported_question",
  });
  assert.deepEqual(answerCampaignAnalyticQuestion(cockpit(), null), {
    ok: false,
    error: "unsupported_question",
  });
});

test("CAMP-2 insights — chaque réponse garde période, source et faits observés", () => {
  const input = cockpit();
  for (const { id } of CAMPAIGN_ANALYTIC_QUESTIONS) {
    const result = answerCampaignAnalyticQuestion(input, id);
    assert.equal(result.ok, true);
    assert.equal(result.answer.status, "available");
    assert.deepEqual(result.answer.period, {
      current: WINDOW,
      previous: { from: COMPARISON.from, to: COMPARISON.to },
    });
    assert.deepEqual(result.answer.source, {
      kind: "ad_metrics",
      provider: "meta_ads",
      currentRowCount: 1,
      previousRowCount: 1,
      currentLastSyncedAt: "2026-08-01T08:00:00.000Z",
      filters: { channels: "all", statuses: "all" },
    });
    assert.equal(result.answer.evidence, "observed_values_only");
  }

  const delivery = answerCampaignAnalyticQuestion(input, "weekly_delivery_changes");
  assert.deepEqual(delivery.answer.facts, {
    current: { cpm: 10, ctr: 0.05 },
    previous: { cpm: 15, ctr: 0.04 },
    changes: { cpm: -0.3333, ctr: 0.25 },
    directions: { cpm: "lower", ctr: "higher" },
  });
});

test("CAMP-2 insights — les métriques de diffusion sans dénominateur restent indisponibles", () => {
  const input = cockpit({
    rows: [
      metric({ impressions: 0, clicks: 0 }),
      metric({ date: "2026-07-21", impressions: 0, clicks: 0 }),
    ],
  });
  const report = buildCampaignWeeklyReport(input);
  assert.equal(report.status, "available");
  assert.deepEqual(report.totals.current.cpm, {
    status: "unavailable",
    value: null,
    reason: "zero_impressions",
  });

  const answer = answerCampaignAnalyticQuestion(input, "weekly_delivery_changes");
  assert.equal(answer.ok, true);
  assert.equal(answer.answer.status, "unavailable");
  assert.equal(answer.answer.reason, "delivery_metrics_unavailable");
  assert.deepEqual(answer.answer.period, {
    current: WINDOW,
    previous: { from: COMPARISON.from, to: COMPARISON.to },
  });
  assert.equal(answer.answer.source.kind, "ad_metrics");
});

test("CAMP-2 insights — la couverture distingue une campagne sans période précédente", () => {
  const input = cockpit({
    rows: [
      metric(),
      metric({ date: "2026-07-21" }),
      metric({ campaign_id: "campaign-2", campaign_name: "Prospection" }),
    ],
  });
  const answer = answerCampaignAnalyticQuestion(input, "weekly_campaign_coverage");
  assert.equal(answer.ok, true);
  assert.equal(answer.answer.status, "available");
  assert.deepEqual(answer.answer.facts, {
    comparable: [{ key: "meta_ads:campaign-1", campaignName: "Acquisition" }],
    unavailable: [{
      key: "meta_ads:campaign-2",
      campaignName: "Prospection",
      reason: "no_previous_rows",
    }],
  });
});

test("CAMP-2 insights — les sorties ne formulent ni mécanisme ni qualification non prouvée", () => {
  const report = buildCampaignWeeklyReport(cockpit());
  const answers = CAMPAIGN_ANALYTIC_QUESTIONS.map(({ id }) =>
    answerCampaignAnalyticQuestion(cockpit(), id));
  const output = JSON.stringify({ report, answers });
  assert.doesNotMatch(output, /(?:\bcause\b|causal|\bIA\b|LLM|fatigue|audit|actif|active|sain|healthy)/i);
});

test("CAMP-2 insights — le module de domaine ne contient aucun chemin d'I/O ou de génération", async () => {
  const source = await readFile(new URL("../lib/campaign-insights.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["'](?:ai|@ai-sdk|@supabase)|fetch\s*\(|\.from\s*\(|outbox|generateText|streamText/);
  assert.match(source, /import type [\s\S]* from "\.\/campaign-cockpit"/);
});
