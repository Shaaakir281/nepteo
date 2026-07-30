import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/0015_financial_role_boundaries.sql",
    import.meta.url,
  ),
  "utf8",
);
const catchupMigration = await readFile(
  new URL(
    "../supabase/migrations/0019_commercial_rls_catchup.sql",
    import.meta.url,
  ),
  "utf8",
);
const context = await readFile(
  new URL("../lib/auth/context.ts", import.meta.url),
  "utf8",
);
const campaignActions = await readFile(
  new URL("../app/(cockpit)/campagnes/actions.ts", import.meta.url),
  "utf8",
);
const campaignPage = await readFile(
  new URL("../app/(cockpit)/campagnes/page.tsx", import.meta.url),
  "utf8",
);
const todayPage = await readFile(
  new URL("../app/(cockpit)/page.tsx", import.meta.url),
  "utf8",
);
const planBanner = await readFile(
  new URL("../app/(cockpit)/_components/plan-banner.tsx", import.meta.url),
  "utf8",
);
const contentPage = await readFile(
  new URL("../app/(cockpit)/contenu/page.tsx", import.meta.url),
  "utf8",
);
const globalAnalysisAction = await readFile(
  new URL("../app/(cockpit)/_actions/analysis.ts", import.meta.url),
  "utf8",
);
const briefingEngine = await readFile(
  new URL("../lib/briefing.ts", import.meta.url),
  "utf8",
);

function policySource(source, name) {
  const start = source.indexOf(`create policy ${name}`);
  assert.notEqual(start, -1, `policy absente : ${name}`);
  const next = source.indexOf("\ncreate policy ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function exportedFunctionSource(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `action exportée absente : ${name}`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("RLS finances — les tables de montants excluent le commercial", () => {
  for (const name of ["ad_metrics_select", "revenue_select"]) {
    const policy = policySource(migration, name);
    assert.match(policy, /\bfor select\b/i);
    assert.match(policy, /'admin', 'marketing', 'direction', 'lecture'/);
    assert.doesNotMatch(policy, /'commercial'/);
  }

  assert.doesNotMatch(migration, /\bfor\s+(?:all|insert|update|delete)\b/i);
  assert.doesNotMatch(migration, /\bdisable\s+row\s+level\s+security\b/i);
});

test("RLS contenu libre/dérivé — aucune lecture commerciale", () => {
  const forbidden = [
    ["company_memory", "company_memory_select"],
    ["actions", "actions_select"],
    ["journal", "journal_select"],
    ["outbox_messages", "outbox_select"],
    ["research_runs", "research_runs_select"],
    ["briefings", "briefings_select"],
  ];

  for (const [table, policyName] of forbidden) {
    assert.match(
      migration,
      new RegExp(
        `drop policy if exists ${policyName} on public\\.${table}`,
        "i",
      ),
    );
    const policy = policySource(migration, policyName);
    assert.match(policy, /\bfor select\b/i);
    assert.match(policy, /'admin', 'marketing', 'direction', 'lecture'/);
    assert.doesNotMatch(policy, /'commercial'/);
    assert.doesNotMatch(policy, /is_commercial_safe_/);
  }

  const memory = policySource(migration, "company_memory_select");
  assert.match(memory, /left\(section, 2\) <> '__'/);

  // Le service role continue de contourner la RLS et n'est jamais révoqué.
  assert.doesNotMatch(migration, /revoke[^;]*service_role/i);
});

test("RLS briefings — les objectifs libres ne sont jamais exposés au commercial", () => {
  // Le risque est structurel : les objectifs entrent dans le prompt puis le
  // résultat est stocké dans une table lue par la page Aujourd'hui.
  assert.match(
    briefingEngine,
    /readMemory\([\s\S]*\["activite", "ton", "objectifs"\]/,
  );
  assert.match(briefingEngine, /const content = await narrateBriefing/);
  assert.match(briefingEngine, /\.from\("briefings"\)\.upsert/);
  assert.match(todayPage, /\.from\("briefings"\)/);

  assert.match(
    migration,
    /drop policy if exists briefings_select on public\.briefings/i,
  );
  const briefings = policySource(migration, "briefings_select");
  assert.match(briefings, /\bfor select\b/i);
  assert.match(briefings, /'admin', 'marketing', 'direction', 'lecture'/);
  assert.doesNotMatch(briefings, /'commercial'/);
});

test("RLS connecteurs — seul le périmètre non financier reste commercial", () => {
  const connectors = policySource(migration, "connectors_select");
  assert.match(connectors, /array\['commercial'\]/);
  assert.match(connectors, /type not in \('ads', 'payments'\)/);
});

test("prospects — les colonnes libres pouvant contenir un budget restent serveur", () => {
  assert.match(
    migration,
    /revoke select on table public\.prospects from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select on table public\.prospects to service_role/i,
  );
  const grantStart = migration.indexOf("grant select (");
  assert.notEqual(grantStart, -1);
  const grantEnd = migration.indexOf(
    ") on table public.prospects to authenticated",
    grantStart,
  );
  assert.notEqual(grantEnd, -1);
  const grantedColumns = migration.slice(grantStart, grantEnd);
  assert.doesNotMatch(grantedColumns, /\braw\b/i);
  assert.doesNotMatch(grantedColumns, /\bnotes?\b/i);
  assert.doesNotMatch(grantedColumns, /\bnote_internal\b/i);
});

test("migration 0019 — rattrape les frontières sans dupliquer les helpers", () => {
  for (const [table, policyName] of [
    ["company_memory", "company_memory_select"],
    ["actions", "actions_select"],
    ["journal", "journal_select"],
    ["outbox_messages", "outbox_select"],
    ["research_runs", "research_runs_select"],
    ["briefings", "briefings_select"],
    ["ad_metrics", "ad_metrics_select"],
    ["revenue_events", "revenue_select"],
  ]) {
    assert.match(
      catchupMigration,
      new RegExp(
        `drop policy if exists ${policyName} on public\\.${table}`,
        "i",
      ),
    );
    const policy = policySource(catchupMigration, policyName);
    assert.match(policy, /'admin', 'marketing', 'direction', 'lecture'/);
    assert.doesNotMatch(policy, /'commercial'/);
  }

  const memory = policySource(catchupMigration, "company_memory_select");
  assert.match(memory, /left\(section, 2\) <> '__'/);

  const connectors = policySource(catchupMigration, "connectors_select");
  assert.match(connectors, /array\['commercial'\]/);
  assert.match(connectors, /type not in \('ads', 'payments'\)/);

  assert.match(
    catchupMigration,
    /tablename in \([\s\S]*'outbox_messages'[\s\S]*cmd in \('SELECT', 'ALL'\)[\s\S]*not like '%has_org_role%'[\s\S]*like '%commercial%'/i,
  );
  assert.doesNotMatch(
    catchupMigration,
    /create\s+(?:or\s+replace\s+)?function\s+public\./i,
  );
});

test("migration 0019 — les lectures JWT sont limitées aux colonnes normalisées", () => {
  for (const table of ["organizations", "connectors", "prospects"]) {
    assert.match(
      catchupMigration,
      new RegExp(
        `revoke select on table public\\.${table} from public, anon, authenticated`,
        "i",
      ),
    );
    assert.match(
      catchupMigration,
      new RegExp(`grant select on table public\\.${table} to service_role`, "i"),
    );
  }

  const organizationGrantStart = catchupMigration.indexOf(
    "grant select (\n  id,\n  name,",
  );
  const organizationGrant = catchupMigration.slice(
    organizationGrantStart,
    catchupMigration.indexOf(
      ") on table public.organizations to authenticated",
      organizationGrantStart,
    ),
  );
  assert.notEqual(organizationGrantStart, -1);
  assert.doesNotMatch(organizationGrant, /\bactivity\b/i);

  const connectorGrantStart = catchupMigration.indexOf(
    "grant select (\n  id,\n  organization_id,\n  type,",
  );
  const connectorGrant = catchupMigration.slice(
    connectorGrantStart,
    catchupMigration.indexOf(
      ") on table public.connectors to authenticated",
      connectorGrantStart,
    ),
  );
  assert.notEqual(connectorGrantStart, -1);
  assert.doesNotMatch(connectorGrant, /\bconfig\b/i);
  assert.doesNotMatch(connectorGrant, /\bencrypted_credentials\b/i);

  assert.match(
    catchupMigration,
    /found unsafe organization privileges/i,
  );
  assert.match(catchupMigration, /found unsafe connector privileges/i);
  assert.match(catchupMigration, /found unsafe prospect privileges/i);
});

test("contexte serveur — les capacités viennent de la matrice centrale", () => {
  assert.match(context, /capabilitiesForRole\(role\)/);
  assert.match(context, /\.\.\.capabilities/);
  assert.match(context, /canViewFinancials: membership\.canViewFinancials/);
  assert.match(context, /canManageCampaigns: membership\.canManageCampaigns/);
});

test("actions financières service-role — capacité campagne obligatoire", () => {
  for (const action of [
    "buildCampaignAction",
    "submitCampaignAction",
    "analyzeAdsNow",
  ]) {
    assert.match(
      exportedFunctionSource(campaignActions, action),
      /ctx\.canManageCampaigns/,
      `${action} doit vérifier la capacité campagne`,
    );
  }

  assert.match(
    globalAnalysisAction,
    /if \(ctx\.canManageCampaigns\)[\s\S]*runAdsAnalysis/,
  );
});

test("RSC financières — aucun accès ne dépend du seul masquage visuel", () => {
  const guard = campaignPage.indexOf(
    "if (!membership.canViewFinancials) redirect",
  );
  const query = campaignPage.indexOf('.from("ad_metrics")');
  assert.ok(guard >= 0 && guard < query, "la page Campagnes garde avant lecture");

  assert.match(
    todayPage,
    /canViewFinancials\s*\?\s*await supabase[\s\S]*\.from\("revenue_events"\)/,
  );
  assert.match(
    todayPage,
    /canViewFinancials\s*\?\s*await supabase[\s\S]*\.from\("ad_metrics"\)/,
  );
  assert.match(
    todayPage,
    /canViewFinancials \|\| isCommercialSafeActionKind\(action\.kind\)/,
  );
  assert.match(
    planBanner,
    /canViewFinancials\s*\?\s*await supabase[\s\S]*\.from\("ad_metrics"\)/,
  );
  assert.match(
    planBanner,
    /canViewFinancials \|\| move\.channel !== "Publicité"/,
  );
  assert.match(
    contentPage,
    /membership\.canViewFinancials\s*\?\s*await supabase[\s\S]*\.from\("ad_metrics"\)/,
  );
});
