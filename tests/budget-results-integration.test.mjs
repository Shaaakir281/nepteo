import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function between(value, startNeedle, endNeedle) {
  const start = value.indexOf(startNeedle);
  assert.notEqual(start, -1, `début absent : ${startNeedle}`);
  const end = value.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `fin absente après ${startNeedle} : ${endNeedle}`);
  return value.slice(start, end);
}

function withoutComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const [
  page,
  pageQuery,
  pageView,
  constants,
  readUtils,
  query,
  presentation,
  cockpit,
  domainEntry,
  readiness,
  deployWorkflow,
] = await Promise.all([
  source("app/(cockpit)/campagnes/page.tsx"),
  source("app/(cockpit)/campagnes/_lib/campaign-page-query.ts"),
  source("app/(cockpit)/campagnes/_lib/campaign-page-view.ts"),
  source("app/(cockpit)/campagnes/_lib/campaign-page-constants.ts"),
  source("app/(cockpit)/campagnes/_lib/campaign-read-utils.ts"),
  source("app/(cockpit)/campagnes/_lib/budget-results-query.ts"),
  source("app/(cockpit)/campagnes/_lib/budget-results-presentation.ts"),
  source("app/(cockpit)/campagnes/_components/campaign-decision-cockpit.tsx"),
  source("lib/budget-results.ts"),
  source("lib/readiness.ts"),
  source(".github/workflows/deploy.yml"),
]);

const campaignComponentsUrl = new URL(
  "../app/(cockpit)/campagnes/_components/",
  import.meta.url,
);
const budgetUiNames = (await readdir(campaignComponentsUrl))
  .filter((name) => /^campaign-budget-results(?:-[^.]+)?\.tsx$/.test(name))
  .sort();
const ui = (
  await Promise.all(
    budgetUiNames.map((name) => readFile(new URL(name, campaignComponentsUrl), "utf8")),
  )
).join("\n");

const budgetDomainUrl = new URL("../lib/budget-results/", import.meta.url);
const budgetDomainNames = (await readdir(budgetDomainUrl))
  .filter((name) => name.endsWith(".ts"))
  .sort();
const domain = [
  domainEntry,
  ...(await Promise.all(
    budgetDomainNames.map((name) => readFile(new URL(name, budgetDomainUrl), "utf8")),
  )),
].join("\n");

const dedicatedBudgetSources = [query, presentation, ui, domain].join("\n");

test("BUDGET-RESULTS — la garde financière précède la lecture et le modèle est câblé jusqu'à l'UI", () => {
  const guard = page.indexOf('if (!membership.canViewFinancials) redirect("/")');
  const snapshotRead = page.indexOf("readCampaignPageSnapshot(", guard);

  assert.ok(guard >= 0, "garde canViewFinancials absente");
  assert.ok(snapshotRead > guard, "le snapshot est lu avant la garde financière");
  assert.match(pageQuery, /import \{ readBudgetResultsData \} from "\.\/budget-results-query"/);
  assert.match(
    pageQuery,
    /readBudgetResultsData\(supabase, organizationId, today\)/,
  );
  assert.match(pageQuery, /organizationId,[\s\S]*asOf: today\.toISOString\(\)/);
  assert.match(pageQuery, /budgetResultsData,/);
  assert.match(pageView, /presentBudgetResults\([\s\S]*snapshot\.budgetResultsData,[\s\S]*snapshot\.organizationId,[\s\S]*snapshot\.asOf/);
  assert.match(page, /budgetResults=\{model\.budgetResults\}/);
});

test("BUDGET-RESULTS — le compte courant vient du connecteur serveur et borne toutes les lectures", () => {
  assert.match(
    query,
    /import \{ readSelectedMetaAdAccount \} from "@\/lib\/connectors\/meta-ads"/,
  );
  assert.match(query, /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/);
  const connectorRead = between(
    query,
    "const connectorResult =",
    "if (connectorResult.error)",
  );
  assert.match(connectorRead, /createAdminClient\(\)/);
  assert.match(connectorRead, /\.from\("connectors"\)/);
  assert.match(connectorRead, /\.select\("config"\)/);
  assert.match(connectorRead, /\.eq\("organization_id", organizationId\)/);
  assert.match(connectorRead, /\.eq\("provider", "meta_ads"\)/);
  assert.match(connectorRead, /\.maybeSingle\(\)/);
  assert.match(
    query,
    /const accountId = readSelectedMetaAdAccount\(connectorResult\.data\?\.config\)\?\.id \?\? null/,
  );
  assert.match(
    query,
    /if \(!accountId\) \{[\s\S]*complete: true,[\s\S]*accountId: null,[\s\S]*metrics: \[\],[\s\S]*syncRuns: \[\]/,
  );

  assert.match(query, /const historyFrom = isoDaysAgo\(asOf, 60\)/);
  assert.match(
    query,
    /const historyFromTimestamp = new Date\([\s\S]*asOf\.getTime\(\) - 61 \* 24 \* 60 \* 60 \* 1_000/,
  );

  const factQueries = [
    {
      table: "ad_metrics",
      next: '.from("ad_campaigns")',
      limit: "BUDGET_METRIC_ROW_LIMIT",
      sourceRule: /\.eq\("metric_provenance", "provider_reported"\)/,
      providerRule: /\.eq\("provider", "meta_ads"\)/,
      accountRule: /\.eq\("account_id", accountId\)/,
      historyRule: /\.gte\("date", historyFrom\)/,
    },
    {
      table: "ad_campaigns",
      next: '.from("ad_metric_results")',
      limit: "BUDGET_CAMPAIGN_ROW_LIMIT",
      providerRule: /\.eq\("provider", "meta_ads"\)/,
      accountRule: /\.eq\("account_id", accountId\)/,
    },
    {
      table: "ad_metric_results",
      next: '.from("ad_metric_sync_runs")',
      limit: "BUDGET_RESULT_ROW_LIMIT",
      sourceRule: /\.eq\("result_source", "provider_reported"\)/,
      providerRule: /\.eq\("ad_metrics\.provider", "meta_ads"\)/,
      metricSourceRule: /\.eq\("ad_metrics\.metric_provenance", "provider_reported"\)/,
      accountRule: /\.eq\("ad_metrics\.account_id", accountId\)/,
      historyRule: /\.gte\("ad_metrics\.date", historyFrom\)/,
    },
  ];

  for (const rules of factQueries) {
    const tableQuery = between(query, `.from("${rules.table}")`, rules.next);
    assert.match(tableQuery, /\.select\([\s\S]*\{ count: "exact" \}/, `${rules.table} sans count exact`);
    assert.match(tableQuery, /\.eq\("organization_id", organizationId\)/, `${rules.table} non tenant-scopée`);
    assert.match(tableQuery, new RegExp(`\\.limit\\(${rules.limit}\\)`), `${rules.table} non bornée`);
    if (rules.sourceRule) assert.match(tableQuery, rules.sourceRule);
    if (rules.providerRule) assert.match(tableQuery, rules.providerRule);
    if (rules.metricSourceRule) assert.match(tableQuery, rules.metricSourceRule);
    assert.match(tableQuery, rules.accountRule, `${rules.table} ne filtre pas le compte courant`);
    if (rules.historyRule) assert.match(tableQuery, rules.historyRule);
  }

  const syncRunBlocks = query.split('.from("ad_metric_sync_runs")').slice(1);
  assert.ok(syncRunBlocks.length >= 3, "historique, dernier run et dernier run complet attendus");
  const recentRuns = syncRunBlocks.find((block) => block.includes('.gte("completed_at", historyFromTimestamp)'));
  const latestCompleteRun = syncRunBlocks.find(
    (block) => block.includes('.eq("quality", "complete")') && block.includes('.eq("applied", true)'),
  );
  const latestRun = syncRunBlocks.find(
    (block) =>
      block.includes('.limit(1)') &&
      !block.includes('.eq("quality", "complete")') &&
      !block.includes('.gte("completed_at", historyFromTimestamp)'),
  );
  for (const [label, block] of [
    ["runs récents", recentRuns],
    ["dernier run", latestRun],
    ["dernier run complet", latestCompleteRun],
  ]) {
    assert.ok(block, `lecture absente : ${label}`);
    assert.match(block, /\.select\(syncRunSelect/);
    assert.match(block, /\.eq\("organization_id", organizationId\)/);
    assert.match(block, /\.eq\("provider", "meta_ads"\)/);
    assert.match(block, /\.eq\("account_id", accountId\)/);
    assert.match(block, /\.order\("completed_at", \{ ascending: false \}\)/);
  }
  assert.match(recentRuns, /\.select\(syncRunSelect, \{ count: "exact" \}\)/);
  assert.match(recentRuns, /\.limit\(BUDGET_SYNC_RUN_ROW_LIMIT\)/);
  assert.match(latestRun, /\.limit\(1\)/);
  assert.match(latestCompleteRun, /\.limit\(1\)/);

  assert.match(query, /ad_metrics!inner\(provider, date, metric_provenance\)/);
  assert.match(constants, /BUDGET_METRIC_ROW_LIMIT = 5_000/);
  assert.match(constants, /BUDGET_CAMPAIGN_ROW_LIMIT = 500/);
  assert.match(constants, /BUDGET_RESULT_ROW_LIMIT = 20_000/);
  assert.match(constants, /BUDGET_SYNC_RUN_ROW_LIMIT = \d+/);
});

test("BUDGET-RESULTS — toute lecture tronquée ou en erreur échoue fermée", () => {
  assert.match(readUtils, /result\.error === null/);
  assert.match(readUtils, /Array\.isArray\(result\.data\)/);
  assert.match(readUtils, /result\.count !== null/);
  assert.match(readUtils, /result\.count <= limit/);
  assert.match(readUtils, /result\.count === result\.data\.length/);

  for (const [result, limit] of [
    ["metricsResult", "BUDGET_METRIC_ROW_LIMIT"],
    ["campaignsResult", "BUDGET_CAMPAIGN_ROW_LIMIT"],
    ["resultsResult", "BUDGET_RESULT_ROW_LIMIT"],
    ["syncRunsResult", "BUDGET_SYNC_RUN_ROW_LIMIT"],
  ]) {
    assert.match(
      query,
      new RegExp(`completeRead\\(${result}, ${limit}\\)`),
      `${result} ne vérifie pas l'exhaustivité count/data`,
    );
  }

  assert.match(query, /const complete =[\s\S]*completeRead\(metricsResult/);
  assert.match(query, /singletonRead\(latestRunResult\)/);
  assert.match(query, /singletonRead\(latestCompleteRunResult\)/);
  assert.match(query, /metrics: complete \? metricsResult\.data : null/);
  assert.match(query, /campaigns: complete \? campaignsResult\.data : null/);
  assert.match(query, /results: complete \? resultsResult\.data : null/);
  const mergedRuns = between(query, "const syncRuns = complete", "return {");
  assert.match(mergedRuns, /new Map\(/);
  assert.match(mergedRuns, /syncRunsResult\.data/);
  assert.match(mergedRuns, /latestRunResult\.data/);
  assert.match(mergedRuns, /latestCompleteRunResult\.data/);
  assert.match(query, /return \{[\s\S]*complete,[\s\S]*accountId,[\s\S]*syncRuns,/);
});

test("BUDGET-RESULTS — aucun revenu ni conversion aval n'entre dans les selects Meta", () => {
  const selectLists = [...query.matchAll(/\.select\(\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(selectLists.length >= 4, "les listes de colonnes dédiées sont absentes");
  for (const columns of selectLists) {
    assert.doesNotMatch(columns, /(?:^|,\s*)(?:conversions?|revenue)(?:,|$)/i);
  }
  const syncRunSelect = query.match(/const syncRunSelect =\s*"([^"]+)"/)?.[1];
  assert.ok(syncRunSelect, "liste de colonnes des runs absente");
  assert.doesNotMatch(syncRunSelect, /(?:^|,\s*)(?:conversions?|revenue)(?:,|$)/i);
  assert.match(selectLists.join("\n"), /\bspend\b/);
  assert.match(selectLists.join("\n"), /\bresult_value\b/);

  const legacyMetrics = between(
    pageQuery,
    '.from("ad_metrics")',
    '.from("actions")',
  );
  assert.match(
    legacyMetrics,
    /\.in\("outcome_provenance", \["demo", "verified_downstream"\]\)/,
    "le filtre aval historique ne doit pas être élargi aux données Meta",
  );
});

test("BUDGET-RESULTS — sans lien explicite, le budget prévu reste non rapproché", () => {
  assert.match(query, /plans: complete \? \[\] : null/);
  assert.match(presentation, /if \(data\.accountId === null\)/);
  assert.match(presentation, /accountIdFrom\(\{ account_id: data\.accountId \}\)/);
  assert.match(presentation, /plannedActions: data\.plans/);
  assert.match(presentation, /budgetLinks: \[\]/);
  assert.match(domain, /label: "Budget prévu non rapproché"/);
  assert.match(ui, /: "Budget prévu non rapproché"/);
  assert.doesNotMatch(presentation, /campaign_name|campaignName|title|includes\(|startsWith\(/);
});

test("BUDGET-RESULTS — l'onglet expose les fenêtres, les sept états et les métadonnées de preuve", () => {
  assert.ok(budgetUiNames.length >= 3, "les surfaces UI BUDGET-RESULTS sont absentes");
  assert.match(cockpit, /type CampaignTab = "decision" \| "budget" \| "report" \| "history"/);
  assert.match(cockpit, /\["budget", "Budget et résultats"\]/);
  assert.match(cockpit, /<CampaignBudgetResults snapshot=\{props\.budgetResults\} \/>/);
  assert.match(domain, /BUDGET_RESULTS_WINDOWS = \[7, 30\] as const/);
  assert.match(ui, /Fenêtre \{window\.days\} jours/);

  for (const state of [
    "ready",
    "empty",
    "missing",
    "stale",
    "partial",
    "incompatible",
    "error",
  ]) {
    assert.match(ui, new RegExp(`\\n  ${state}: \\{`), `état UI absent : ${state}`);
  }

  for (const label of [
    "Devise",
    "Fuseau",
    "Attribution",
    "Fraîcheur",
    "Provenance",
    "Qualité",
    "Budget fournisseur",
    "Dépense réelle",
    "Résultats déclarés par Meta",
    "Coût par résultat",
  ]) {
    assert.ok(ui.includes(label), `libellé absent : ${label}`);
  }
  assert.match(ui, /Tendance dépense/);
  assert.match(ui, /Tendance du résultat/);
  assert.match(ui, /Tendance du coût/);
  assert.match(ui, /const UNAVAILABLE = "Indisponible"/);
  assert.match(
    ui,
    /\["Provenance", account \? "Meta · déclarée par le fournisseur" : UNAVAILABLE\]/,
  );
});

test("BUDGET-RESULTS — le chemin dédié reste strictement en lecture seule et descriptif", () => {
  const executable = withoutComments(dedicatedBudgetSources);

  assert.doesNotMatch(
    executable,
    /\b(?:buildCampaignCockpit|runAdsAnalysis|buildAdsProposals)\b/,
  );
  assert.doesNotMatch(executable, /\.\s*(?:insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(executable, /\bfetch\s*\(|graph\.(?:facebook|meta)|\/api\/meta/i);
  assert.doesNotMatch(executable, /\b(?:ads_management|ads_pause)\b/i);
  assert.doesNotMatch(
    ui,
    /(?:^|[^\p{L}])(?:CAC|ROAS|revenu|revenue)(?:[^\p{L}]|$)/iu,
    "aucun libellé financier aval non vérifié ne doit être rendu",
  );
  assert.match(ui, /Observations Meta en lecture seule/);
});

test("BUDGET-RESULTS — les migrations réconciliées précèdent une readiness 32", async () => {
  const names = (await readdir(new URL("../supabase/migrations/", import.meta.url))).sort();
  assert.deepEqual(
    names.filter((name) => /^00(?:29|30|31|32)_/.test(name)),
    [
      "0029_meta_metrics.sql",
      "0030_meta_ads_pilot_access.sql",
      "0031_connector_foundation.sql",
      "0032_connector_conflict_http.sql",
    ],
  );
  assert.match(readiness, /REQUIRED_SCHEMA_VERSION = 32/);
  assert.match(deployWorkflow, /REQUIRED_SCHEMA_VERSION: "32"/);
});
