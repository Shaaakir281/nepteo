import assert from "node:assert/strict";
import test from "node:test";
import {
  BUDGET_RESULTS_STALE_AFTER_MS,
  BUDGET_RESULTS_WINDOWS,
  buildBudgetResults,
} from "../lib/budget-results.ts";

const ORG = "organization-1";
const ACCOUNT = "act_123456789";
const AS_OF = "2026-08-10T12:00:00.000Z";
const ATTRIBUTION = {
  attribution_model: "requested_windows",
  attribution_windows: ["7d_click", "1d_view"],
};

function run(overrides = {}) {
  return {
    id: "run-current",
    organization_id: ORG,
    provider: "meta_ads",
    account_id: ACCOUNT,
    quality: "complete",
    applied: true,
    error_code: null,
    observation_from: "2026-07-12",
    observation_to: "2026-08-10",
    currency: "EUR",
    account_timezone: "UTC",
    campaign_count: 1,
    metric_count: 2,
    result_count: 2,
    completed_at: "2026-08-10T11:00:00.000Z",
    ...overrides,
  };
}

function campaign(overrides = {}) {
  return {
    organization_id: ORG,
    provider: "meta_ads",
    account_id: ACCOUNT,
    campaign_id: "campaign-1",
    campaign_name: "Acquisition",
    configured_status: "ACTIVE",
    effective_status: "ACTIVE",
    objective: "OUTCOME_LEADS",
    currency: "EUR",
    account_timezone: "UTC",
    sync_run_id: "run-current",
    synced_at: "2026-08-10T11:00:00.000Z",
    provider_budget_amount: "20.00",
    provider_budget_kind: "daily",
    provider_budget_currency: "EUR",
    provider_budget_source: "provider_reported",
    ...overrides,
  };
}

function metric(id, date, spend, overrides = {}) {
  return {
    id,
    organization_id: ORG,
    provider: "meta_ads",
    account_id: ACCOUNT,
    campaign_id: "campaign-1",
    campaign_name: "Acquisition",
    date,
    spend,
    currency: "EUR",
    account_timezone: "UTC",
    ...ATTRIBUTION,
    metric_provenance: "provider_reported",
    data_quality: "complete",
    observation_from: "2026-07-12",
    observation_to: "2026-08-10",
    sync_run_id: "run-current",
    synced_at: "2026-08-10T11:00:00.000Z",
    ...overrides,
  };
}

function result(metricId, type, value, overrides = {}) {
  return {
    organization_id: ORG,
    ad_metric_id: metricId,
    result_type: type,
    result_value: value,
    result_source: "provider_reported",
    ...ATTRIBUTION,
    sync_run_id: "run-current",
    synced_at: "2026-08-10T11:00:00.000Z",
    ...overrides,
  };
}

function action(overrides = {}) {
  return {
    id: "action-1",
    organization_id: ORG,
    kind: "launch_campaign",
    status: "approved",
    payload: {
      brief: { channel: "meta", dailyBudget: 20, durationDays: 7 },
      plan: { dailyCap: 20, durationDays: 7, totalBudget: 140 },
    },
    ...overrides,
  };
}

function link(overrides = {}) {
  return {
    organization_id: ORG,
    provider: "meta_ads",
    account_id: ACCOUNT,
    campaign_id: "campaign-1",
    action_id: "action-1",
    planned_currency: "EUR",
    planned_from: "2026-08-04",
    planned_to: "2026-08-10",
    ...overrides,
  };
}

function readyInput(overrides = {}) {
  return {
    organizationId: ORG,
    accountId: ACCOUNT,
    asOf: AS_OF,
    campaigns: [campaign()],
    metrics: [
      metric("metric-current", "2026-08-05", "60.00"),
      metric("metric-previous", "2026-08-01", "40.00"),
    ],
    results: [
      result("metric-current", "lead", "3"),
      result("metric-previous", "lead", "2"),
    ],
    syncRuns: [run()],
    plannedActions: [action()],
    budgetLinks: [link()],
    ...overrides,
  };
}

function window(snapshot, days) {
  return snapshot.campaigns[0].windows.find((item) => item.days === days);
}

test("BUDGET-RESULTS — contrat public, rapprochement strict et calculs prévu/réalisé", () => {
  assert.deepEqual(BUDGET_RESULTS_WINDOWS, [7, 30]);
  assert.equal(BUDGET_RESULTS_STALE_AFTER_MS, 172_800_000);

  const snapshot = buildBudgetResults(readyInput());
  assert.equal(snapshot.state.kind, "ready");
  assert.deepEqual(snapshot.account, {
    provider: "meta_ads",
    accountId: ACCOUNT,
    currency: "EUR",
    timezone: "UTC",
    attribution: { model: "requested_windows", windows: ["7d_click", "1d_view"] },
    lastCompleteAt: "2026-08-10T11:00:00.000Z",
    freshnessHours: 1,
  });

  const item = snapshot.campaigns[0];
  assert.deepEqual(item.plannedBudget, {
    status: "available",
    amount: 140,
    currency: "EUR",
    period: { from: "2026-08-04", to: "2026-08-10" },
    actionId: "action-1",
    source: "planned_action_explicit_link",
  });
  assert.deepEqual(item.providerBudget, {
    status: "available",
    amount: 20,
    kind: "daily",
    currency: "EUR",
    source: "provider_reported",
    observedAt: "2026-08-10T11:00:00.000Z",
  });
  assert.equal(item.plannedVsActual.status, "available");
  assert.deepEqual(
    {
      planned: item.plannedVsActual.planned,
      actual: item.plannedVsActual.actual,
      remaining: item.plannedVsActual.remaining,
      spentRatio: item.plannedVsActual.spentRatio,
    },
    { planned: 140, actual: 60, remaining: 80, spentRatio: 0.4286 },
  );
});

test("BUDGET-RESULTS — résultats Meta par type, coût et tendance 7 jours restent sourcés", () => {
  const snapshot = buildBudgetResults(readyInput());
  const seven = window(snapshot, 7);
  assert.deepEqual(seven.current.period, { from: "2026-08-04", to: "2026-08-10" });
  assert.deepEqual(seven.previous.period, { from: "2026-07-28", to: "2026-08-03" });
  assert.equal(seven.current.spend.value, 60);
  assert.equal(seven.previous.spend.value, 40);
  assert.deepEqual(seven.current.results.map((entry) => ({
    type: entry.resultType,
    value: entry.value,
    cost: entry.costPerResult.value,
    source: entry.source,
  })), [{ type: "lead", value: 3, cost: 20, source: "provider_reported" }]);
  assert.deepEqual(seven.trend.spend, {
    status: "available",
    current: 60,
    previous: 40,
    absolute: 20,
    relative: 0.5,
    relativeReason: null,
  });
  assert.deepEqual(seven.trend.results[0].value, {
    status: "available",
    current: 3,
    previous: 2,
    absolute: 1,
    relative: 0.5,
    relativeReason: null,
  });
  assert.deepEqual(seven.trend.results[0].costPerResult, {
    status: "available",
    current: 20,
    previous: 20,
    absolute: 0,
    relative: 0,
    relativeReason: null,
  });
  assert.equal(seven.current.spend.evidence.metricRows, 1);
  assert.equal(seven.current.spend.evidence.resultRows, 1);
  assert.deepEqual(seven.current.spend.evidence.attribution.windows, ["7d_click", "1d_view"]);
});

test("BUDGET-RESULTS — tendances 30 jours utilisent uniquement la période précédente adjacente", () => {
  const previousRun = run({
    id: "run-previous",
    observation_from: "2026-06-12",
    observation_to: "2026-07-11",
    metric_count: 1,
    result_count: 1,
    completed_at: "2026-07-11T23:00:00.000Z",
  });
  const oldMetric = metric("metric-old", "2026-07-01", "50.00", {
    observation_from: "2026-06-12",
    observation_to: "2026-07-11",
    sync_run_id: "run-previous",
    synced_at: "2026-07-11T23:00:00.000Z",
  });
  const oldResult = result("metric-old", "lead", "5", {
    sync_run_id: "run-previous",
    synced_at: "2026-07-11T23:00:00.000Z",
  });
  const snapshot = buildBudgetResults(readyInput({
    metrics: [...readyInput().metrics, oldMetric],
    results: [...readyInput().results, oldResult],
    syncRuns: [run(), previousRun],
  }));
  const thirty = window(snapshot, 30);
  assert.deepEqual(thirty.current.period, { from: "2026-07-12", to: "2026-08-10" });
  assert.deepEqual(thirty.previous.period, { from: "2026-06-12", to: "2026-07-11" });
  assert.equal(thirty.current.spend.value, 100);
  assert.equal(thirty.previous.spend.value, 50);
  assert.equal(thirty.trend.spend.relative, 1);
  assert.equal(thirty.current.results[0].value, 5);
  assert.equal(thirty.previous.results[0].value, 5);
  assert.equal(thirty.trend.results[0].value.relative, 0);
});

test("BUDGET-RESULTS — absence de résultat et zéro explicite sont deux états distincts", () => {
  const baseMetric = metric("metric-only", "2026-08-05", "25.00");
  const withoutResult = buildBudgetResults(readyInput({
    metrics: [baseMetric],
    results: [],
    syncRuns: [run({ metric_count: 1, result_count: 0 })],
  }));
  const absent = window(withoutResult, 7).current;
  assert.deepEqual(absent.results, []);
  assert.deepEqual(absent.resultsState, {
    status: "unavailable",
    reason: "result_not_reported",
  });

  const explicitZero = buildBudgetResults(readyInput({
    metrics: [baseMetric],
    results: [result("metric-only", "lead", "0")],
    syncRuns: [run({ metric_count: 1, result_count: 1 })],
  }));
  const zero = window(explicitZero, 7).current;
  assert.equal(zero.resultsState.status, "available");
  assert.equal(zero.results[0].value, 0);
  assert.deepEqual(zero.results[0].costPerResult, {
    status: "unavailable",
    value: null,
    reason: "zero_result",
    evidence: zero.results[0].costPerResult.evidence,
  });
});

test("BUDGET-RESULTS — plusieurs types ne sont jamais additionnés", () => {
  const snapshot = buildBudgetResults(readyInput({
    metrics: [metric("metric-only", "2026-08-05", "60.00")],
    results: [
      result("metric-only", "lead", "3"),
      result("metric-only", "link_click", "12"),
    ],
    syncRuns: [run({ metric_count: 1, result_count: 2 })],
  }));
  const series = window(snapshot, 7).current.results;
  assert.deepEqual(series.map((entry) => [entry.resultType, entry.value, entry.costPerResult.value]), [
    ["lead", 3, 20],
    ["link_click", 12, 5],
  ]);
});

test("BUDGET-RESULTS — sans lien explicite le budget prévu reste non rapproché", () => {
  const snapshot = buildBudgetResults(readyInput({
    plannedActions: [],
    budgetLinks: [],
    campaigns: [campaign({
      provider_budget_amount: null,
      provider_budget_kind: null,
      provider_budget_currency: null,
      provider_budget_source: null,
    })],
  }));
  const item = snapshot.campaigns[0];
  assert.deepEqual(item.plannedBudget, {
    status: "unlinked",
    value: null,
    label: "Budget prévu non rapproché",
  });
  assert.deepEqual(item.providerBudget, {
    status: "unavailable",
    value: null,
    reason: "not_provided",
  });
  assert.deepEqual(item.plannedVsActual, {
    status: "unavailable",
    value: null,
    reason: "planned_budget_unlinked",
  });
});

test("BUDGET-RESULTS — un lien non validé, ambigu ou de mauvaise devise échoue fermé", () => {
  for (const input of [
    readyInput({ plannedActions: [action({ status: "proposed" })] }),
    readyInput({ budgetLinks: [link({ planned_currency: "USD" })] }),
    readyInput({ budgetLinks: [link(), link({ action_id: "action-2" })] }),
    readyInput({ plannedActions: [action({
      payload: {
        brief: { channel: "meta", dailyBudget: 20, durationDays: 7 },
        plan: { dailyCap: 20, durationDays: 7, totalBudget: 139 },
      },
    })] }),
  ]) {
    assert.equal(buildBudgetResults(input).state.kind, "incompatible");
  }
});

test("BUDGET-RESULTS — états compte vide, données absentes et lecture indisponible", () => {
  const empty = buildBudgetResults(readyInput({
    campaigns: [],
    metrics: [],
    results: [],
    syncRuns: [run({ campaign_count: 0, metric_count: 0, result_count: 0 })],
    plannedActions: [],
    budgetLinks: [],
  }));
  assert.deepEqual(empty.state, {
    kind: "empty",
    reason: "empty_account",
    lastCompleteAt: "2026-08-10T11:00:00.000Z",
  });

  const missing = buildBudgetResults(readyInput({
    metrics: [],
    results: [],
    syncRuns: [run({ metric_count: 0, result_count: 0 })],
  }));
  assert.equal(missing.state.kind, "missing");
  assert.equal(missing.state.reason, "no_metric_rows");

  const noRun = buildBudgetResults(readyInput({ syncRuns: [] }));
  assert.equal(noRun.state.kind, "missing");
  assert.equal(noRun.state.reason, "no_sync_run");

  const unavailableRead = buildBudgetResults(readyInput({ metrics: null }));
  assert.equal(unavailableRead.state.kind, "error");
  assert.equal(unavailableRead.state.reason, "source_read_unavailable");
});

test("BUDGET-RESULTS — des compteurs inconnus ne deviennent jamais zéro", () => {
  for (const unknownCount of [null, "", "   ", false, true]) {
    const snapshot = buildBudgetResults(readyInput({
      campaigns: [],
      metrics: [],
      results: [],
      syncRuns: [run({
        campaign_count: unknownCount,
        metric_count: 0,
        result_count: 0,
      })],
      plannedActions: [],
      budgetLinks: [],
    }));
    assert.equal(snapshot.state.kind, "incompatible");
    assert.equal(snapshot.state.reason, "invalid_sync_run");
  }
});

test("BUDGET-RESULTS — les campagnes historiques sorties du catalogue restent dans les totaux compte", () => {
  const historicalRun = run({
    id: "run-history",
    observation_from: "2026-06-12",
    observation_to: "2026-07-11",
    campaign_count: 1,
    metric_count: 1,
    result_count: 1,
    completed_at: "2026-07-11T11:00:00.000Z",
  });
  const historicalMetric = metric("metric-history", "2026-07-05", "25.00", {
    campaign_id: "campaign-retired",
    campaign_name: "Campagne retirée",
    observation_from: "2026-06-12",
    observation_to: "2026-07-11",
    sync_run_id: "run-history",
    synced_at: "2026-07-11T11:00:00.000Z",
  });
  const historicalResult = result("metric-history", "lead", "1", {
    sync_run_id: "run-history",
    synced_at: "2026-07-11T11:00:00.000Z",
  });
  const snapshot = buildBudgetResults(readyInput({
    metrics: [metric("metric-current", "2026-08-05", "60.00"), historicalMetric],
    results: [result("metric-current", "lead", "3"), historicalResult],
    syncRuns: [run({ metric_count: 1, result_count: 1 }), historicalRun],
  }));

  assert.equal(snapshot.state.kind, "ready");
  assert.deepEqual(snapshot.campaigns.map((item) => item.campaignId), ["campaign-1"]);
  const accountThirty = snapshot.windows.find((item) => item.days === 30);
  assert.equal(accountThirty.previous.spend.status, "available");
  assert.equal(accountThirty.previous.spend.value, 25);
  assert.equal(accountThirty.previous.results[0].value, 1);
  const currentCampaignThirty = snapshot.campaigns[0].windows.find((item) => item.days === 30);
  assert.equal(currentCampaignThirty.previous.spend.status, "unavailable");
  assert.equal(currentCampaignThirty.previous.spend.reason, "spend_not_reported");
});

test("BUDGET-RESULTS — un compte actuellement vide conserve son historique sans créer de carte", () => {
  const historicalRun = run({
    id: "run-history",
    observation_from: "2026-06-12",
    observation_to: "2026-07-11",
    campaign_count: 1,
    metric_count: 1,
    result_count: 1,
    completed_at: "2026-07-11T11:00:00.000Z",
  });
  const historicalMetric = metric("metric-history", "2026-07-05", "25.00", {
    campaign_id: "campaign-retired",
    campaign_name: "Campagne retirée",
    observation_from: "2026-06-12",
    observation_to: "2026-07-11",
    sync_run_id: "run-history",
    synced_at: "2026-07-11T11:00:00.000Z",
  });
  const historicalResult = result("metric-history", "lead", "1", {
    sync_run_id: "run-history",
    synced_at: "2026-07-11T11:00:00.000Z",
  });
  const snapshot = buildBudgetResults(readyInput({
    campaigns: [],
    metrics: [historicalMetric],
    results: [historicalResult],
    syncRuns: [
      run({ campaign_count: 0, metric_count: 0, result_count: 0 }),
      historicalRun,
    ],
    plannedActions: [],
    budgetLinks: [],
  }));

  assert.equal(snapshot.state.kind, "empty");
  assert.deepEqual(snapshot.campaigns, []);
  const accountThirty = snapshot.windows.find((item) => item.days === 30);
  assert.equal(accountThirty.current.spend.status, "unavailable");
  assert.equal(accountThirty.current.spend.reason, "spend_not_reported");
  assert.equal(accountThirty.previous.spend.status, "available");
  assert.equal(accountThirty.previous.spend.value, 25);
  assert.equal(accountThirty.previous.results[0].value, 1);
});

test("BUDGET-RESULTS — un ancien snapshot vide devient périmé au lieu de rester vide", () => {
  const snapshot = buildBudgetResults(readyInput({
    asOf: "2026-08-13T12:00:00.000Z",
    campaigns: [],
    metrics: [],
    results: [],
    syncRuns: [run({ campaign_count: 0, metric_count: 0, result_count: 0 })],
    plannedActions: [],
    budgetLinks: [],
  }));

  assert.equal(snapshot.state.kind, "stale");
  assert.equal(snapshot.state.reason, "last_complete_snapshot_over_48h");
  assert.equal(snapshot.account.freshnessHours, 73);
  assert.deepEqual(snapshot.campaigns, []);
});

test("BUDGET-RESULTS — états périmé, partiel et erreur conservent la dernière preuve complète", () => {
  const stale = buildBudgetResults(readyInput({
    asOf: "2026-08-13T12:00:00.000Z",
  }));
  assert.equal(stale.state.kind, "stale");
  assert.equal(stale.state.reason, "last_complete_snapshot_over_48h");
  assert.equal(stale.account.freshnessHours, 73);

  const partial = buildBudgetResults(readyInput({
    syncRuns: [
      run(),
      run({
        id: "run-failure",
        quality: "partial",
        applied: false,
        error_code: "partial_response",
        observation_from: null,
        observation_to: null,
        currency: null,
        account_timezone: null,
        campaign_count: 0,
        metric_count: 0,
        result_count: 0,
        completed_at: "2026-08-10T11:30:00.000Z",
      }),
    ],
  }));
  assert.equal(partial.state.kind, "partial");
  assert.equal(partial.state.reason, "partial_response");
  assert.equal(partial.state.lastCompleteAt, "2026-08-10T11:00:00.000Z");
  assert.equal(partial.windows.length, 2);

  const error = buildBudgetResults(readyInput({
    syncRuns: [run({
      id: "run-error",
      quality: "unavailable",
      applied: false,
      error_code: "provider_error",
      observation_from: null,
      observation_to: null,
      currency: null,
      account_timezone: null,
      campaign_count: 0,
      metric_count: 0,
      result_count: 0,
      completed_at: "2026-08-10T11:30:00.000Z",
    })],
  }));
  assert.equal(error.state.kind, "error");
  assert.equal(error.state.reason, "provider_error");
  assert.equal(error.account, null);
});

test("BUDGET-RESULTS — couverture actuelle incomplète rend le lot partiel sans total fictif", () => {
  const shortRun = run({
    observation_from: "2026-08-04",
    observation_to: "2026-08-10",
    metric_count: 1,
    result_count: 1,
  });
  const snapshot = buildBudgetResults(readyInput({
    metrics: [metric("metric-current", "2026-08-05", "60.00", {
      observation_from: "2026-08-04",
    })],
    results: [result("metric-current", "lead", "3")],
    syncRuns: [shortRun],
  }));
  assert.equal(snapshot.state.kind, "partial");
  assert.equal(snapshot.state.reason, "current_30_day_window_incomplete");
  assert.equal(window(snapshot, 7).current.spend.status, "available");
  assert.deepEqual(window(snapshot, 30).current.spend, {
    status: "unavailable",
    value: null,
    reason: "period_not_fully_covered",
    evidence: window(snapshot, 30).current.spend.evidence,
  });
});

test("BUDGET-RESULTS — devises, attributions et relations incohérentes sont refusées", () => {
  for (const [input, reason] of [
    [readyInput({ metrics: [
      metric("metric-current", "2026-08-05", "60.00"),
      metric("metric-previous", "2026-08-01", "40.00", { currency: "USD" }),
    ] }), "campaign_metric_scope_mismatch"],
    [readyInput({
      metrics: [
        metric("metric-current", "2026-08-05", "60.00"),
        metric("metric-previous", "2026-08-01", "40.00", {
          attribution_windows: ["1d_click"],
        }),
      ],
      results: [
        result("metric-current", "lead", "3"),
        result("metric-previous", "lead", "2", {
          attribution_windows: ["1d_click"],
        }),
      ],
    }), "mixed_attribution"],
    [readyInput({ results: [
      result("metric-current", "lead", "3"),
      result("metric-previous", "lead", "2", { attribution_windows: ["1d_click"] }),
    ] }), "metric_result_scope_mismatch"],
    [readyInput({ results: [
      result("unknown-metric", "lead", "3"),
      result("metric-previous", "lead", "2"),
    ] }), "metric_result_scope_mismatch"],
  ]) {
    const snapshot = buildBudgetResults(input);
    assert.equal(snapshot.state.kind, "incompatible");
    assert.equal(snapshot.state.reason, reason);
    assert.deepEqual(snapshot.campaigns, []);
  }
});

test("BUDGET-RESULTS — une ligne d'un autre tenant ne traverse jamais le builder", () => {
  const snapshot = buildBudgetResults(readyInput({
    metrics: [
      metric("metric-current", "2026-08-05", "60.00"),
      metric("metric-previous", "2026-08-01", "40.00", {
        organization_id: "organization-2",
      }),
    ],
  }));
  assert.equal(snapshot.state.kind, "incompatible");
  assert.equal(snapshot.state.reason, "metric_identity_mismatch");
  assert.equal(snapshot.account, null);
});

test("BUDGET-RESULTS — même entrée, ordre différent : même sortie et aucune mutation", () => {
  const input = readyInput();
  const before = structuredClone(input);
  const first = buildBudgetResults(input);
  const second = buildBudgetResults({
    ...input,
    metrics: [...input.metrics].reverse(),
    results: [...input.results].reverse(),
    syncRuns: [...input.syncRuns].reverse(),
  });
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});
