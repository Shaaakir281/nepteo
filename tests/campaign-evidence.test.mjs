/** CAMP-1 — faits observés et projections prudentes, sans I/O. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_EVIDENCE_SUFFICIENCY,
  CAMPAIGN_EVIDENCE_WINDOW_DAYS,
  buildCampaignEvidence,
  buildCampaignProjection,
  campaignEvidenceProviderForChannel,
  normalizeAdMetricRows,
} from "../lib/campaign-evidence.ts";

const metric = (overrides = {}) => ({
  provider: "meta_ads",
  campaign_id: "meta-1",
  campaign_name: "Acquisition — audit",
  date: "2026-07-03",
  spend: "10.00",
  conversions: 2,
  revenue: "30.00",
  synced_at: "2026-08-01T08:00:00Z",
  ...overrides,
});

const sufficientRows = () =>
  ["03", "04", "05", "06", "07", "08", "09"].map((day, index) =>
    metric({
      campaign_id: index < 3 ? "meta-1" : "meta-2",
      campaign_name: index < 3 ? "Acquisition — audit" : "Retargeting — audit",
      date: `2026-07-${day}`,
      synced_at: `2026-08-01T${String(index + 8).padStart(2, "0")}:00:00Z`,
    }),
  );

test("evidence CAMP-1 — la fenêtre et les seuils sont explicites", () => {
  assert.equal(CAMPAIGN_EVIDENCE_WINDOW_DAYS, 30);
  assert.deepEqual(CAMPAIGN_EVIDENCE_SUFFICIENCY, {
    minDistinctDays: 7,
    minSpendExclusive: 0,
    minConversions: 10,
  });
});

test("evidence CAMP-1 — chaque canal utilise uniquement son provider", () => {
  assert.deepEqual(campaignEvidenceProviderForChannel("meta"), {
    provider: "meta_ads",
    label: "Meta Ads",
  });
  assert.deepEqual(campaignEvidenceProviderForChannel("GOOGLE"), {
    provider: "google_ads",
    label: "Google Ads",
  });
  assert.deepEqual(campaignEvidenceProviderForChannel("linkedin"), {
    provider: "linkedin_ads",
    label: "LinkedIn Ads",
  });
  assert.equal(campaignEvidenceProviderForChannel("email"), null);
});

test("evidence CAMP-1 — normalise les nombres sérialisés et refuse l'ambiguïté", () => {
  const valid = normalizeAdMetricRows([metric()]);
  assert.equal(valid.ok, true);
  assert.equal(valid.rows[0].spend, 10);
  assert.equal(valid.rows[0].revenue, 30);
  assert.equal(valid.rows[0].syncedAt, "2026-08-01T08:00:00.000Z");

  assert.deepEqual(normalizeAdMetricRows(null), {
    ok: false,
    error: "rows_unavailable",
  });
  assert.deepEqual(
    normalizeAdMetricRows([metric({ date: "2026-02-30" })]),
    { ok: false, error: "invalid_row", invalidIndex: 0 },
  );
  assert.deepEqual(
    normalizeAdMetricRows([metric({ conversions: 1.5 })]),
    { ok: false, error: "invalid_row", invalidIndex: 0 },
  );
});

test("evidence CAMP-1 — agrège exactement 30 jours, le provider et la source", () => {
  const rows = [
    ...sufficientRows(),
    metric({ date: "2026-07-02", spend: 1_000, conversions: 100, revenue: 3_000 }),
    metric({ date: "2026-08-02", spend: 1_000, conversions: 100, revenue: 3_000 }),
    metric({
      provider: "google_ads",
      date: "2026-07-10",
      spend: 1_000,
      conversions: 100,
      revenue: 3_000,
    }),
  ];
  const evidence = buildCampaignEvidence({ channel: "meta", rows, windowEnd: "2026-08-01" });

  assert.equal(evidence.status, "available");
  assert.deepEqual(evidence.source, {
    provider: "meta_ads",
    label: "Meta Ads",
    from: "2026-07-03",
    to: "2026-08-01",
    rowCount: 7,
    campaignCount: 2,
    lastSyncedAt: "2026-08-01T14:00:00.000Z",
  });
  assert.equal(evidence.distinctDays, 7);
  assert.deepEqual(evidence.facts, {
    kind: "observed",
    spend: 70,
    conversions: 14,
    revenue: 210,
    cac: 5,
    roas: 3,
    topCampaign: {
      campaignId: "meta-2",
      campaignName: "Retargeting — audit",
      spend: 40,
      conversions: 8,
      revenue: 120,
      cac: 5,
      roas: 3,
    },
  });
  assert.match(evidence.method.aggregation, /CAC = dépense \/ conversions/);
});

test("evidence CAMP-1 — chaque seuil manquant interdit la projection", () => {
  const cases = [
    {
      rows: sufficientRows().slice(0, 6),
      reason: "fewer_than_7_distinct_days",
    },
    {
      rows: sufficientRows().map((row) => ({ ...row, spend: 0 })),
      reason: "no_positive_spend",
    },
    {
      rows: sufficientRows().map((row) => ({ ...row, conversions: 1 })),
      reason: "fewer_than_10_conversions",
    },
  ];

  for (const example of cases) {
    const evidence = buildCampaignEvidence({
      channel: "meta",
      rows: example.rows,
      windowEnd: "2026-08-01",
    });
    assert.equal(evidence.status, "insufficient");
    assert.ok(evidence.reasons.includes(example.reason));
    assert.equal(evidence.facts.kind, "observed");
    assert.deepEqual(buildCampaignProjection(evidence, 100), {
      status: "unavailable",
      reason: "insufficient_evidence",
      projection: null,
    });
  }
});

test("evidence CAMP-1 — erreurs et absence de lignes restent honnêtes", () => {
  const unavailableRows = buildCampaignEvidence({
    channel: "meta",
    rows: null,
    windowEnd: "2026-08-01",
  });
  assert.equal(unavailableRows.status, "unavailable");
  assert.deepEqual(unavailableRows.reasons, ["rows_unavailable"]);
  assert.equal(unavailableRows.facts, null);

  const empty = buildCampaignEvidence({ channel: "meta", rows: [], windowEnd: "2026-08-01" });
  assert.equal(empty.status, "unavailable");
  assert.deepEqual(empty.reasons, ["no_rows_in_window"]);

  const invalid = buildCampaignEvidence({
    channel: "meta",
    rows: [metric({ spend: -1 })],
    windowEnd: "2026-08-01",
  });
  assert.equal(invalid.status, "unavailable");
  assert.deepEqual(invalid.reasons, ["invalid_provider_rows"]);

  const unknownChannel = buildCampaignEvidence({
    channel: "email",
    rows: sufficientRows(),
    windowEnd: "2026-08-01",
  });
  assert.equal(unknownChannel.status, "unavailable");
  assert.deepEqual(unknownChannel.reasons, ["invalid_channel"]);
});

test("projection CAMP-1 — dérive une estimation bornée des seuls faits observés", () => {
  const evidence = buildCampaignEvidence({
    channel: "meta",
    rows: sufficientRows(),
    windowEnd: "2026-08-01",
  });
  const result = buildCampaignProjection(evidence, 100);

  assert.equal(result.status, "available");
  assert.equal(evidence.facts.kind, "observed");
  assert.equal(result.projection.kind, "estimate");
  assert.equal(result.projection.basedOn, "observed_30_day_history");
  assert.deepEqual(result.projection.costPerContact, { estimate: 5, low: 3.5, high: 6.5 });
  assert.deepEqual(result.projection.volume, { estimate: 20, low: 15, high: 28 });
  assert.deepEqual(result.projection.roas, { estimate: 3, low: 2.1, high: 3.9 });
  assert.equal(result.projection.confidence, 0.6);
  assert.equal(result.projection.interval.relativeMargin, 0.3);
  assert.match(result.projection.interval.basis, /pas un intervalle statistique/);
  assert.ok(result.projection.limits.length >= 3);
});

test("projection CAMP-1 — budget invalide ou preuve indisponible ne rendent aucun chiffre", () => {
  const evidence = buildCampaignEvidence({
    channel: "meta",
    rows: sufficientRows(),
    windowEnd: "2026-08-01",
  });
  assert.deepEqual(buildCampaignProjection(evidence, 0), {
    status: "unavailable",
    reason: "invalid_budget",
    projection: null,
  });

  const unavailable = buildCampaignEvidence({
    channel: "meta",
    rows: [],
    windowEnd: "2026-08-01",
  });
  assert.deepEqual(buildCampaignProjection(unavailable, 100), {
    status: "unavailable",
    reason: "unavailable_evidence",
    projection: null,
  });
});
