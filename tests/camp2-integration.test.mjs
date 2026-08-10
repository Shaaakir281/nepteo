import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readCampaignSources(paths) {
  return (await Promise.all(paths.map((path) =>
    readFile(new URL(`../app/(cockpit)/campagnes/${path}`, import.meta.url), "utf8"),
  ))).join("\n");
}

const campaignPage = await readCampaignSources([
  "page.tsx",
  "_lib/campaign-page-constants.ts",
  "_lib/campaign-page-query.ts",
  "_lib/campaign-page-view.ts",
  "_lib/campaign-cockpit-presentation.ts",
  "_lib/campaign-weekly-presentation.ts",
  "_lib/campaign-weekly-metrics.ts",
  "_lib/campaign-cockpit-presentation.ts",
  "_lib/campaign-kpi-presentation.ts",
  "_lib/campaign-row-presentation.ts",
  "_lib/campaign-delivery-presentation.ts",
  "_lib/campaign-history-presentation.ts",
  "_lib/campaign-labels.ts",
  "_lib/campaign-operational-presentation.ts",
  "_lib/campaign-prospect-search.ts",
  "_lib/campaign-read-utils.ts",
  "_lib/campaign-formatters.ts",
]);
const cockpitUi = await readCampaignSources([
  "_components/campaign-decision-types.ts",
  "_components/campaign-decision-cockpit.tsx",
  "_components/campaign-decision-hero.tsx",
  "_components/campaign-filters.tsx",
  "_components/campaign-operational-summary.tsx",
  "_components/campaign-prospect-search.tsx",
  "_components/campaign-kpi-card.tsx",
  "_components/campaign-delivery-panel.tsx",
  "_components/campaign-weekly-insights.tsx",
  "_components/campaign-creative-audit.tsx",
  "_components/campaign-measured-list.tsx",
  "_components/campaign-attempt-history.tsx",
  "_components/campaign-activity-list.tsx",
  "_components/campaign-table.tsx",
  "_components/campaign-cards.tsx",
  "_components/campaign-readings.tsx",
  "_components/campaign-metric-table-cell.tsx",
  "_components/campaign-metric-definition.tsx",
  "_components/campaign-evidence.tsx",
]);
const decisionActions = await readFile(
  new URL("../app/(cockpit)/_actions/decisions.ts", import.meta.url),
  "utf8",
);
const validationDrawer = await readFile(
  new URL(
    "../app/(cockpit)/_components/validation-drawer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const decisionsHistory = await readFile(
  new URL(
    "../app/(cockpit)/_components/decisions-history.tsx",
    import.meta.url,
  ),
  "utf8",
);
const todayQueueData = await readFile(
  new URL("../app/(cockpit)/_lib/today-queue-data.ts", import.meta.url),
  "utf8",
);
const execution = await readFile(
  new URL("../lib/execution.ts", import.meta.url),
  "utf8",
);
const adsAnalysis = await readFile(
  new URL("../lib/ads/analysis.ts", import.meta.url),
  "utf8",
);

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `début absent : ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `fin absente après ${startNeedle} : ${endNeedle}`);
  return source.slice(start, end);
}

function occurrences(source, needle) {
  return source.split(needle).length - 1;
}

test("CAMP-2 page — la garde financière précède toute lecture", () => {
  const guard = campaignPage.indexOf(
    'if (!membership.canViewFinancials) redirect("/")',
  );
  const firstRead = campaignPage.indexOf('.from("ad_metrics")');

  assert.ok(guard >= 0, "garde canViewFinancials absente");
  assert.ok(firstRead > guard, "ad_metrics est lu avant la garde financière");
  for (const table of [
    "ad_metrics",
    "actions",
    "journal",
    "connectors",
    "organizations",
    "prospects",
  ]) {
    const read = campaignPage.indexOf(`.from("${table}")`);
    assert.ok(read > guard, `${table} est lu avant la garde financière`);
  }
});

test("CAMP-2 page — lectures bornées, isolées par organisation et reproductibles", () => {
  const metricsQuery = between(
    campaignPage,
    '.from("ad_metrics")',
    '.from("actions")',
  );
  const actionsQuery = between(
    campaignPage,
    '.from("actions")',
    '.from("journal")',
  );
  const statusJournalQuery = between(
    campaignPage,
    '.from("journal")',
    "readDemoPresentation(organizationId)",
  );
  const linkedJournalQuery = between(
    campaignPage,
    "const journalResult =",
    "const metricsComplete =",
  );

  assert.match(
    metricsQuery,
    /\.select\([\s\S]*provider, campaign_id, campaign_name, date, impressions, clicks, spend, conversions, revenue, synced_at[\s\S]*\{ count: "exact" \}/,
  );
  assert.match(metricsQuery, /\.eq\("organization_id", organizationId\)/);
  assert.match(metricsQuery, /\.limit\(METRIC_ROW_LIMIT\)/);

  assert.match(
    actionsQuery,
    /\.select\([\s\S]*id, kind, title, status, created_at, decided_at, decision_reason, confidence, data_sources, payload[\s\S]*\{ count: "exact" \}/,
  );
  assert.match(actionsQuery, /\.eq\("organization_id", organizationId\)/);
  assert.match(actionsQuery, /\.limit\(ACTION_ROW_LIMIT\)/);

  assert.match(
    statusJournalQuery,
    /\.select\("id, action_id, event, created_at, payload", \{[\s\S]*count: "exact"/,
  );
  assert.match(statusJournalQuery, /\.eq\("organization_id", organizationId\)/);
  assert.match(statusJournalQuery, /\.is\("action_id", null\)/);
  for (const event of [
    "campaign_blocked",
    "campaign_waiting",
    "campaign_status_cleared",
  ]) {
    assert.match(statusJournalQuery, new RegExp(`"${event}"`));
  }
  assert.match(statusJournalQuery, /\.limit\(JOURNAL_ROW_LIMIT\)/);

  assert.match(linkedJournalQuery, /\.eq\("organization_id", organizationId\)/);
  assert.match(linkedJournalQuery, /\.in\("action_id", actionIds\)/);
  assert.match(linkedJournalQuery, /\.limit\(JOURNAL_ROW_LIMIT\)/);

  assert.match(campaignPage, /const METRIC_ROW_LIMIT = 5_000/);
  assert.match(campaignPage, /const ACTION_ROW_LIMIT = 200/);
  assert.match(campaignPage, /const JOURNAL_ROW_LIMIT = 500/);
});

test("CAMP-2 résumé — état agent persistant et connecteurs exacts, bornés et tenant-scopés", () => {
  const connectorQuery = between(
    campaignPage,
    '.from("connectors")',
    '.from("organizations")',
  );
  const agentQuery = between(
    campaignPage,
    '.from("organizations")',
    "readProspectSearch(",
  );
  const summary = between(
    campaignPage,
    "function presentOperationalSummary(",
    "async function readProspectSearch(",
  );

  assert.match(
    connectorQuery,
    /\.select\("provider, status", \{ count: "exact" \}\)/,
  );
  assert.match(connectorQuery, /\.eq\("organization_id", organizationId\)/);
  assert.match(connectorQuery, /\.neq\("provider", DEMO_PROVIDER\)/);
  assert.match(connectorQuery, /\.limit\(CONNECTOR_ROW_LIMIT\)/);
  assert.match(campaignPage, /const CONNECTOR_ROW_LIMIT = 100/);

  assert.match(
    agentQuery,
    /\.select\("id, execution_paused, autonomy_level", \{ count: "exact" \}\)/,
  );
  assert.match(agentQuery, /\.eq\("id", organizationId\)/);
  assert.match(agentQuery, /\.limit\(1\)/);
  assert.match(summary, /completeRead\(agentControlResult, 1\)/);
  assert.match(summary, /typeof row\.execution_paused === "boolean"/);
  assert.match(summary, /row\.autonomy_level === "suggest"/);
  assert.match(summary, /row\.autonomy_level === "prepare"/);
  assert.match(summary, /Contrôle d’exécution suspendu/);
  assert.match(summary, /Contrôle d’exécution non suspendu/);
  assert.match(summary, /Autonomie persistée/);
  assert.match(summary, /Ce contrôle ne prouve aucune activité/);
  assert.match(summary, /value: "Indisponible"/);
  assert.match(summary, /completeRead\(connectorsResult, CONNECTOR_ROW_LIMIT\)/);
  assert.match(summary, /connectorsResult\.count/);
  assert.match(summary, /row\.provider !== DEMO_PROVIDER/);
  assert.match(summary, /const errors = connectorsResult\.data\.filter/);
  assert.match(summary, /hors scénario enregistré/);
  assert.doesNotMatch(summary, /réel(?:s)? enregistré/);
  assert.match(summary, /connecteur de scénario exclu/);
  assert.match(summary, /Dernière analyse journalisée/);
  assert.match(summary, /Cette trace indique un démarrage, pas sa réussite/);

  assert.match(agentQuery, /\.from\("journal"\)/);
  assert.match(agentQuery, /\.select\("id, created_at, actor"\)/);
  assert.match(agentQuery, /\.eq\("organization_id", organizationId\)/);
  assert.match(agentQuery, /\.eq\("event", "analysis_run"\)/);
  assert.match(agentQuery, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(agentQuery, /\.limit\(1\)/);

  assert.match(cockpitUi, /Résumé opérationnel/);
  assert.match(cockpitUi, /aucun état d&apos;activité n&apos;est simulé/);
  assert.match(cockpitUi, /fact\.state === "available" \? "Persisté" : "Indisponible"/);
});

test("CAMP-2 prospects — recherche RLS en lecture seule, complète, bornée et sans contenu sensible", () => {
  const searchRead = between(
    campaignPage,
    "async function readProspectSearch(",
    "function isSafeProspectRow(",
  );

  assert.match(campaignPage, /prospect\?: string/);
  assert.match(campaignPage, /prospect\?: string \| string\[\]/);
  assert.match(campaignPage, /const PROSPECT_SEARCH_LIMIT = 20/);
  assert.match(campaignPage, /const PROSPECT_QUERY_MIN_LENGTH = 2/);
  assert.match(campaignPage, /const PROSPECT_QUERY_MAX_LENGTH = 80/);
  assert.equal(occurrences(searchRead, '.from("prospects")'), 2);
  assert.equal(occurrences(searchRead, '.select(select, { count: "exact" })'), 2);
  assert.equal(
    occurrences(searchRead, '.eq("organization_id", organizationId)'),
    2,
  );
  assert.match(searchRead, /\.ilike\("name", pattern\)/);
  assert.match(searchRead, /\.ilike\("company", pattern\)/);
  assert.equal(
    occurrences(searchRead, ".limit(PROSPECT_SEARCH_LIMIT)"),
    2,
  );
  assert.match(
    searchRead,
    /const select = "id, name, company, source, synced_at"/,
  );
  assert.doesNotMatch(
    searchRead,
    /const select = "[^"]*(?:email|raw|notes|note_internal)/,
  );
  assert.match(
    searchRead,
    /!completeRead\(nameResult, PROSPECT_SEARCH_LIMIT\)[\s\S]*!completeRead\(companyResult, PROSPECT_SEARCH_LIMIT\)/,
  );
  assert.match(searchRead, /rows\.length > PROSPECT_SEARCH_LIMIT/);
  assert.match(searchRead, /aucun résultat partiel n’est affiché/);
  assert.doesNotMatch(searchRead, /\.(?:insert|update|upsert|delete)\(/);

  assert.match(cockpitUi, /role="search"/);
  assert.match(cockpitUi, /action="\/campagnes"/);
  assert.match(cockpitUi, /name="prospect"/);
  assert.match(cockpitUi, /minLength=\{2\}/);
  assert.match(cockpitUi, /maxLength=\{80\}/);
  assert.match(cockpitUi, /name="channel" value=\{channel\}/);
  assert.match(cockpitUi, /name="status" value=\{status\}/);
  assert.match(cockpitUi, /aucun[\s\S]*email, contenu brut ou note interne/);
  assert.match(cockpitUi, /Source enregistrée : \{prospect\.source\}/);
  assert.match(cockpitUi, /Origine présentée : \{presentation\}/);
  assert.match(campaignPage, /prospectDatasetLabel\(snapshot\.demoSnapshot\.presentation\)/);
  assert.match(campaignPage, /Scénario d’exemple Nepteo certifié/);
  assert.match(campaignPage, /Environnement de test — origine à vérifier/);
  assert.doesNotMatch(cockpitUi, /prospect\.email|prospect\.notes|prospect\.raw/);
});

test("CAMP-2 paramètres — les valeurs répétées échouent sans appel de méthode string", () => {
  const searchRead = between(
    campaignPage,
    "async function readProspectSearch(",
    "function isSafeProspectRow(",
  );
  assert.match(campaignPage, /type CampaignSearchParam = string \| string\[\] \| undefined/);
  for (const name of ["proposed", "channel", "status", "prospect"]) {
    assert.match(campaignPage, new RegExp(`${name}\\?: string \\| string\\[\\]`));
  }
  assert.ok(
    searchRead.indexOf("Array.isArray(requestedValue)") <
      searchRead.indexOf("rawQuery.normalize"),
    "le tableau doit être refusé avant normalize",
  );
  assert.match(searchRead, /Un seul paramètre de recherche prospect est accepté/);
  assert.match(
    campaignPage,
    /function scalarSearchParam\([\s\S]*typeof value === "string" \? value : undefined/,
  );
  assert.match(
    campaignPage,
    /function campaignChannel\(value: CampaignSearchParam\)[\s\S]*typeof value === "string"/,
  );
  assert.match(
    campaignPage,
    /function campaignStatus\(value: CampaignSearchParam\)[\s\S]*typeof value === "string"/,
  );
});

test("CAMP-2 prospects — les textes relus ont des bornes de présentation", () => {
  const safeRow = between(
    campaignPage,
    "function isSafeProspectRow(",
    "function scalarSearchParam(",
  );
  assert.match(safeRow, /row\.id\.trim\(\)\.length > 0/);
  assert.match(safeRow, /row\.id\.length <= 128/);
  assert.match(safeRow, /row\.name\.length <= 200/);
  assert.match(safeRow, /row\.company\.length <= 200/);
  assert.match(safeRow, /row\.source\.length <= 80/);
});

test("CAMP-2 filtres — canal sourcé et vide canal/statut ignorent les tentatives hors filtre", () => {
  assert.match(
    campaignPage,
    /const sourceCampaigns = allCampaigns\.filter\([\s\S]*campaign\.performance !== null/,
  );
  assert.match(
    campaignPage,
    /const availableChannels = new Set\([\s\S]*sourceCampaigns\.map\(\(campaign\) => campaign\.channel\)/,
  );
  assert.match(
    campaignPage,
    /const filters = presentFilters\([\s\S]*sourceCampaigns,[\s\S]*allCampaigns/,
  );
  const dataState = between(
    campaignPage,
    "const hasActiveCockpitFilter =",
    "const operationalSummary =",
  );
  assert.match(
    dataState,
    /selectedChannel !== null \|\| selectedStatus !== null/,
  );
  assert.match(
    dataState,
    /hasActiveCockpitFilter && result\.cockpit\.campaigns\.length === 0[\s\S]*code: "empty_filter_result"/,
  );
  assert.match(
    dataState,
    /Aucune campagne ne correspond aux filtres serveur sélectionnés/,
  );
  const filterEmpty = dataState.indexOf(
    "hasActiveCockpitFilter && result.cockpit.campaigns.length === 0",
  );
  const globalAttempts = dataState.indexOf(
    "result.cockpit.history.attempts.length === 0",
  );
  assert.ok(filterEmpty >= 0 && filterEmpty < globalAttempts);
  assert.doesNotMatch(
    dataState.slice(filterEmpty, globalAttempts),
    /history\.attempts/,
  );
  assert.match(
    cockpitUi,
    /code\?: "empty_filter_result"/,
  );
  assert.match(
    cockpitUi,
    /globallyEmpty[\s\S]*Rien à mesurer pour l’instant/,
  );
});

test("CAMP-2 hebdomadaire — un second snapshot 7+7 réutilise lectures et filtres", () => {
  const weeklyBuild = between(
    campaignPage,
    "const weeklyResult = buildCampaignCockpit(",
    "const queryIncomplete =",
  );
  const weeklyPresentation = between(
    campaignPage,
    "const weeklyInsights =",
    "return (",
  );
  assert.match(campaignPage, /const WEEKLY_WINDOW_DAYS = 7/);
  assert.match(
    campaignPage,
    /const weeklyWindow = \{[\s\S]*isoDaysAgo\(today, WEEKLY_WINDOW_DAYS - 1\)[\s\S]*isoDaysAgo\(today, 0\)/,
  );
  assert.match(
    campaignPage,
    /const weeklyComparison = \{[\s\S]*WEEKLY_WINDOW_DAYS \* 2 - 1[\s\S]*WEEKLY_WINDOW_DAYS\)/,
  );
  assert.match(weeklyBuild, /\.\.\.snapshotInput/);
  assert.match(weeklyBuild, /window: weeklyWindow/);
  assert.match(weeklyBuild, /comparison: weeklyComparison/);
  assert.match(weeklyBuild, /filters: selectedFilters/);
  assert.match(weeklyPresentation, /buildCampaignWeeklyReport\(weeklyResult\.cockpit\)/);
  assert.match(weeklyPresentation, /CAMPAIGN_ANALYTIC_QUESTIONS\.map\(\(question\)/);
  assert.match(
    weeklyPresentation,
    /answerCampaignAnalyticQuestion\([\s\S]*weeklyResult\.cockpit,[\s\S]*question\.id/,
  );
  assert.match(campaignPage, /weeklyInsights=\{model\.weeklyInsights\}/);
});

test("CAMP-2 hebdomadaire — rapport et dock sont accessibles, bornés et sourcés", () => {
  const weeklyUi = between(
    cockpitUi,
    "function WeeklyInsightsPanel(",
    "function CreativeAuditUnavailable(",
  );
  assert.match(weeklyUi, /Rapport hebdomadaire et questions analytiques/);
  assert.match(weeklyUi, /7 jours comparés aux 7 jours adjacents/);
  assert.match(weeklyUi, /aucun texte libre ni[\s\S]*appel IA/);
  assert.match(weeklyUi, /report\.currentPeriodLabel/);
  assert.match(weeklyUi, /report\.previousPeriodLabel/);
  assert.match(weeklyUi, /report\.sourceDetail/);
  assert.match(weeklyUi, /EvidenceReference source=\{report\.source\}/);
  assert.match(weeklyUi, /insights\.questions\.map/);
  assert.match(weeklyUi, /type="button"/);
  assert.match(weeklyUi, /aria-pressed=\{selected\}/);
  assert.match(weeklyUi, /aria-controls="campaign-analytic-answer"/);
  assert.match(weeklyUi, /id="campaign-analytic-answer"/);
  assert.match(weeklyUi, /aria-live="polite"/);
  assert.doesNotMatch(weeklyUi, /<input|<textarea|contentEditable/);

  const presenter = between(
    campaignPage,
    "function presentWeeklyInsights(",
    "function presentFilters(",
  );
  assert.match(presenter, /Dénominateurs ad_metrics/);
  assert.match(presenter, /source\.currentRowCount/);
  assert.match(presenter, /source\.previousRowCount/);
  assert.match(presenter, /source\.filters\.channels/);
  assert.match(presenter, /source\.filters\.statuses/);
  assert.match(presenter, /weeklyUnavailableReason/);
  assert.match(presenter, /observations présentes dans chacune des deux périodes/);
  assert.match(presenter, /lignes disponibles sur chacune des deux périodes/);
  assert.doesNotMatch(
    presenter,
    /deux périodes (?:complètes|disponibles)|comparaison complète/,
  );
});

test("CAMP-2 créatifs — l’indisponibilité est séparée des métriques campagne", () => {
  const creative = between(
    cockpitUi,
    "function CreativeAuditUnavailable(",
    "function CampaignTable(",
  );
  assert.match(creative, /Audit créatif indisponible/);
  for (const missing of ["creative", "ad", "asset", "frequency"]) {
    assert.match(creative, new RegExp(`\\b${missing}\\b`));
  }
  assert.match(creative, /ne constituent donc pas un audit de créatifs/);
  assert.match(creative, /href="\/contenu"/);
});

test("CAMP-2 page — toute erreur ou troncature échoue fermée", () => {
  const completeRead = between(
    campaignPage,
    "function completeRead<",
    "function isoDaysAgo",
  );
  assert.match(completeRead, /result\.error === null/);
  assert.match(completeRead, /Array\.isArray\(result\.data\)/);
  assert.match(completeRead, /result\.count !== null/);
  assert.match(completeRead, /result\.count <= limit/);
  assert.match(completeRead, /result\.count === result\.data\.length/);

  assert.match(
    campaignPage,
    /rows: metricsComplete \? metricsResult\.data : null/,
  );
  assert.match(
    campaignPage,
    /actions: actionsComplete \? actionsResult\.data : null/,
  );
  assert.match(
    campaignPage,
    /journal: journalRows/,
  );
  assert.match(campaignPage, /linkedJournalComplete && statusJournalComplete/);
  assert.match(campaignPage, /new Map\([\s\S]*entry\.id/);
  assert.match(
    campaignPage,
    /queryIncomplete[\s\S]*kind: "insufficient"[\s\S]*Aucun total partiel/,
  );
});

test("CAMP-2 page — le nouveau cockpit ne suppose aucun statut fournisseur", () => {
  assert.match(campaignPage, /buildCampaignCockpit\(\{/);
  assert.match(campaignPage, /providerStatuses: \[\]/);
  assert.match(campaignPage, /<CampaignDecisionCockpit[\s\S]*dataState=\{model\.dataState\}/);
  assert.doesNotMatch(
    campaignPage,
    /rollupWithStatus|Campagnes en cours|arrêtées/i,
  );
});

test("CAMP-2 UI — sources, confiance non calculée et contrôles accessibles", () => {
  assert.match(cockpitUi, /function EvidenceReference\(/);
  assert.match(cockpitUi, /\{prefix\} : \{source\.label\}/);
  assert.match(cockpitUi, /"Confiance non calculée"/);
  assert.match(campaignPage, /state: "not_calculated"/);
  assert.doesNotMatch(campaignPage, /state: "calculated"/);

  assert.match(
    cockpitUi,
    /<label htmlFor=\{searchId\}[\s\S]*<input[\s\S]*id=\{searchId\}[\s\S]*type="search"/,
  );
  assert.match(
    cockpitUi,
    /<label[\s\S]*htmlFor=\{channelFilterId\}[\s\S]*<select[\s\S]*id=\{channelFilterId\}/,
  );
  assert.match(
    cockpitUi,
    /<label[\s\S]*htmlFor=\{statusFilterId\}[\s\S]*<select[\s\S]*id=\{statusFilterId\}/,
  );
});

test("CAMP-2 UI — l’activité fusionne les journaux liés et les états CAMP-2 non liés", () => {
  assert.match(cockpitUi, /Activité vérifiable/);
  assert.match(
    cockpitUi,
    /Uniquement les événements enregistrés dans le journal CAMP-2/,
  );
  assert.match(
    cockpitUi,
    /activity\.map\([\s\S]*event\.atLabel[\s\S]*EvidenceReference source=\{event\.source\}/,
  );
  assert.match(
    campaignPage,
    /function presentActivity\([\s\S]*unlinkedEvents:[\s\S]*attempt\.journalEvents\.map[\s\S]*unlinkedJournalEventDetail[\s\S]*new Map/,
  );
  const presentation = between(
    campaignPage,
    "function presentCockpit(",
    "function presentWeeklyInsights(",
  );
  assert.match(
    presentation,
    /hasCockpitFilter[\s\S]*attempt\.campaignKey !== null[\s\S]*includedCampaigns\.has\(attempt\.campaignKey\)/,
  );
  assert.match(
    presentation,
    /hasCockpitFilter \? \[\] : cockpit\.history\.unlinkedJournalEvents/,
  );
});

test("CAMP-2 historique — le fallback action source le statut et la date de décision", () => {
  const attempts = between(
    campaignPage,
    "function presentAttempts(",
    "function attemptChannel(",
  );
  assert.match(
    attempts,
    /label: `Action enregistrée · statut de décision \$\{attempt\.status\}`/,
  );
  assert.match(
    attempts,
    /observedAtLabel: formatDateTime\([\s\S]*attempt\.decidedAt \?\? attempt\.createdAt/,
  );
  assert.doesNotMatch(
    attempts,
    /label: "Action enregistrée"[\s\S]*observedAtLabel: formatDateTime\(attempt\.createdAt\)/,
  );
});

test("CAMP-2 UI — comparaisons et indisponibilités restent visibles", () => {
  assert.match(
    cockpitUi,
    /period\.comparisonUnavailableReason[\s\S]*Comparaison indisponible/,
  );
  assert.ok(
    occurrences(cockpitUi, "observation.comparison.value") >= 3,
    "comparaisons attendues dans les KPI, le tableau et les cartes",
  );
  assert.match(
    cockpitUi,
    /function MetricTableCell\([\s\S]*observation\.reason/,
  );
});

test("CAMP-2 livraison — CPM et CTR globaux et par campagne restent sourcés et honnêtes", () => {
  const globalKpis = between(
    campaignPage,
    "function presentKpis(",
    "function presentCampaign(",
  );
  const campaignPresentation = between(
    campaignPage,
    "function presentCampaign(",
    "function presentStatus(",
  );
  const tableCell = between(
    cockpitUi,
    "function MetricTableCell(",
    "function MetricDefinition(",
  );
  const cardMetric = between(
    cockpitUi,
    "function MetricDefinition(",
    "function StatusBadge(",
  );

  assert.match(globalKpis, /metrics\.cpm\.status === "unavailable"/);
  assert.match(globalKpis, /"cpm", "CPM observé"/);
  assert.match(globalKpis, /deliveryComparisonFor\(comparison, "cpm"\)/);
  assert.match(globalKpis, /metrics\.ctr\.status === "unavailable"/);
  assert.match(globalKpis, /"ctr", "CTR observé"/);
  assert.match(globalKpis, /deliveryComparisonFor\(comparison, "ctr"\)/);
  assert.equal(
    occurrences(globalKpis, "Aucune impression enregistrée sur la période"),
    2,
  );

  assert.match(campaignPresentation, /observed: ObservedDeliveryMetric \| null/);
  assert.match(campaignPresentation, /observed\?\.status !== "available"/);
  assert.match(campaignPresentation, /cpm: deliveryMetric\(/);
  assert.match(campaignPresentation, /ctr: deliveryMetric\(/);
  assert.match(campaignPresentation, /campaign\.performance\?\.source\.provider/);

  assert.match(cockpitUi, /cpm: CampaignMetricCell/);
  assert.match(cockpitUi, /ctr: CampaignMetricCell/);
  assert.match(cockpitUi, /<MetricTableCell metric=\{campaign\.cpm\} \/>/);
  assert.match(cockpitUi, /<MetricTableCell metric=\{campaign\.ctr\} \/>/);
  assert.match(
    cockpitUi,
    /campaign\.roas,[\s\S]*campaign\.cpm,[\s\S]*campaign\.ctr/,
  );
  assert.match(cockpitUi, /min-w-\[1480px\]/);
  assert.match(cockpitUi, /sm:grid-cols-3/);
  assert.match(
    tableCell,
    /observation\.state === "insufficient"[\s\S]*observation\.reason[\s\S]*observation\.source[\s\S]*EvidenceReference/,
  );
  assert.match(
    cardMetric,
    /observation\.state !== "available"[\s\S]*observation\.reason[\s\S]*observation\.source[\s\S]*EvidenceReference/,
  );
});

test("CAMP-2 livraison — la variation dédiée conserve toutes les indisponibilités", () => {
  const deliveryComparison = between(
    campaignPage,
    "function deliveryComparisonFor(",
    "function evidenceForMetrics(",
  );

  assert.match(
    deliveryComparison,
    /function deliveryComparisonValue\([\s\S]*change: ObservedDeliveryChange/,
  );
  assert.match(deliveryComparison, /change\.status === "unavailable"/);
  assert.match(deliveryComparison, /current_metric_unavailable/);
  assert.match(deliveryComparison, /previous_metric_unavailable/);
  assert.match(deliveryComparison, /zero_previous_value/);
  assert.match(deliveryComparison, /Comparaison indisponible :/);
  assert.match(deliveryComparison, /tone: "neutral"/);
});

test("CAMP-2 livraison — diagnostics global et par campagne sont descriptifs, accessibles et non causaux", () => {
  const deliveryPresentation = between(
    campaignPage,
    "function presentDeliveryDiagnostic(",
    "function presentRecommendation(",
  );
  const deliveryEvidence = between(
    campaignPage,
    "function evidenceForDeliveryDiagnostic(",
    "function datasetEvidence(",
  );

  assert.match(deliveryPresentation, /diagnostic: CampaignDeliveryDiagnostic/);
  assert.match(deliveryPresentation, /diagnostic\.status === "unavailable"/);
  for (const reason of [
    "comparison_disabled",
    "no_current_rows",
    "no_previous_rows",
    "current_zero_impressions",
    "previous_zero_impressions",
  ]) {
    assert.match(deliveryPresentation, new RegExp(reason));
  }
  assert.match(deliveryPresentation, /diagnostic\.directions\.cpm/);
  assert.match(deliveryPresentation, /diagnostic\.directions\.ctr/);
  assert.match(
    deliveryPresentation,
    /Cette comparaison est descriptive : elle ne prouve aucune cause/,
  );
  assert.match(deliveryPresentation, /state: "not_calculated"/);

  assert.match(deliveryEvidence, /source\.currentPeriod\.from/);
  assert.match(deliveryEvidence, /source\.currentRowCount/);
  assert.match(deliveryEvidence, /source\.previousPeriod\.from/);
  assert.match(deliveryEvidence, /source\.previousRowCount/);
  assert.match(deliveryEvidence, /datasetEvidence\(presentation, provider\)/);

  assert.match(
    cockpitUi,
    /aria-labelledby="campaign-delivery-diagnostic-title"/,
  );
  assert.match(cockpitUi, /Lecture descriptive de la livraison/);
  assert.match(cockpitUi, /<ReadingEvidence reading=\{diagnostic\} prominent \/>/);
  assert.match(
    cockpitUi,
    /aria-label=\{`Lectures descriptives pour \$\{campaign\.name\}`\}/,
  );
  assert.match(cockpitUi, /campaign\.deliveryDiagnostic\.disclaimer/);
  assert.match(
    campaignPage,
    /deliveryDiagnostic: presentDeliveryDiagnostic\([\s\S]*cockpit\.deliveryDiagnostic/,
  );
  assert.match(
    campaignPage,
    /deliveryDiagnostic: presentDeliveryDiagnostic\([\s\S]*campaign\.deliveryDiagnostic/,
  );
  assert.doesNotMatch(
    deliveryPresentation,
    /fatigue|saturation|audit créatif/i,
  );
});

test("CAMP-2 livraison — zéro ligne ne devient jamais plusieurs sources déclarées", () => {
  const deliveryPresentation = between(
    campaignPage,
    "function presentDeliveryDiagnostic(",
    "function presentRecommendation(",
  );
  const deliveryEvidence = between(
    campaignPage,
    "function evidenceForDeliveryDiagnostic(",
    "function datasetEvidence(",
  );
  assert.match(
    cockpitUi,
    /interface CampaignDeliveryReading[\s\S]*source: CampaignEvidenceReference \| null/,
  );
  assert.match(
    campaignPage,
    /cockpit\.totals\.status === "available"[\s\S]*cockpit\.totals\.source\.provider[\s\S]*: null/,
  );
  assert.match(deliveryPresentation, /provider: ObservedMetricsSource\["provider"\] \| null/);
  assert.doesNotMatch(deliveryPresentation, /= "multiple"/);
  assert.match(deliveryEvidence, /provider === null/);
  assert.match(
    deliveryEvidence,
    /source\.currentRowCount \+ source\.previousRowCount === 0/,
  );
  assert.match(deliveryEvidence, /return null/);
  assert.match(cockpitUi, /Source manquante/);
});

test("CAMP-2 décisions — le refus exige une raison bornée et la RPC v2 la reçoit", () => {
  assert.match(decisionActions, /const REJECTION_REASON_MIN_LENGTH = 3/);
  assert.match(decisionActions, /const REJECTION_REASON_MAX_LENGTH = 500/);
  assert.match(
    decisionActions,
    /normalized\.length >= REJECTION_REASON_MIN_LENGTH[\s\S]*normalized\.length <= REJECTION_REASON_MAX_LENGTH/,
  );
  assert.match(
    decisionActions,
    /decision === "reject"[\s\S]*normalizedRejectionReason\(formData\.get\("reason"\)\)[\s\S]*if \(decision === "reject" && !reason\)/,
  );
  assert.match(
    decisionActions,
    /\.rpc\("transition_action_decision_v2", \{[\s\S]*p_transition: transition,[\s\S]*p_reason: reason/,
  );

  assert.match(
    validationDrawer,
    /name="decision" value="reject"[\s\S]*<textarea[\s\S]*name="reason"[\s\S]*required[\s\S]*minLength=\{3\}[\s\S]*maxLength=\{500\}/,
  );
});

test("CAMP-2 décisions — la raison enregistrée est relue et affichée", () => {
  assert.match(
    campaignPage,
    /created_at, decided_at, decision_reason, confidence/,
  );
  assert.match(campaignPage, /learning: attempt\.decisionReason/);
  assert.match(cockpitUi, /Motif enregistré :/);
  assert.match(
    todayQueueData,
    /\.select\("id, kind, title, status, decided_at, decision_reason"\)/,
  );
  assert.match(decisionsHistory, /decision_reason: string \| null/);
  assert.match(
    decisionsHistory,
    /a\.status === "rejected" && a\.decision_reason[\s\S]*Raison : \{a\.decision_reason\}/,
  );
});

test("CAMP-2 non-exécution — les recommandations Ads n’ont aucun chemin d’exécution", () => {
  assert.match(
    validationDrawer,
    /confidence != null &&[\s\S]*!action\.kind\.startsWith\("ads_pause_"\)/,
  );
  assert.match(
    decisionsHistory,
    /const isExecutable = \(kind: string\) => isRelanceKind\(kind\)/,
  );
  assert.doesNotMatch(decisionsHistory, /isAdsPauseAction|isAdsPauseKind/);
  assert.match(
    validationDrawer,
    /action\.kind\.startsWith\("ads_pause_"\)[\s\S]*aucun bouton d'exécution publicitaire/,
  );
  assert.match(execution, /if \(!isRelanceKind\(claimedAction\.kind\)\)/);
  assert.doesNotMatch(execution, /ads_pause_|isAdsPause|adsPause/);
});

test("CAMP-2 analyse — une unique RPC crée action+journal sans demi-état", () => {
  assert.equal(occurrences(adsAnalysis, ".rpc("), 1);
  assert.match(
    adsAnalysis,
    /\.rpc\("propose_ads_pause_actions", \{[\s\S]*p_organization_id: orgId[\s\S]*p_actor_id: actorId[\s\S]*p_proposals: selected/,
  );
  assert.match(
    adsAnalysis,
    /\.from\("actions"\)[\s\S]*\.select\("kind, confidence", \{ count: "exact" \}\)[\s\S]*\.like\("kind", "ads\\\\_pause\\\\_%"\)/,
  );
  assert.doesNotMatch(
    adsAnalysis,
    /\.from\("actions"\)[\s\S]*\.(?:insert|update|delete)\(/,
  );
  assert.doesNotMatch(adsAnalysis, /\.from\("journal"\)/);
  assert.doesNotMatch(adsAnalysis, /\.from\("outbox_messages"\)/);
});
