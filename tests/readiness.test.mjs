import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  READINESS_TIMEOUT_MS,
  REQUIRED_SCHEMA_VERSION,
  supportsRequiredSchemaVersion,
} from "../lib/readiness.ts";

const migration = await readFile(
  new URL("../supabase/migrations/0016_schema_readiness.sql", import.meta.url),
  "utf8",
);
const catchupMigration = await readFile(
  new URL(
    "../supabase/migrations/0019_commercial_rls_catchup.sql",
    import.meta.url,
  ),
  "utf8",
);
const healthRoute = await readFile(
  new URL("../app/api/health/route.ts", import.meta.url),
  "utf8",
);
const readinessRoute = await readFile(
  new URL("../app/api/ready/route.ts", import.meta.url),
  "utf8",
);
const deployWorkflow = await readFile(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);
const migrationFiles = await readdir(
  new URL("../supabase/migrations/", import.meta.url),
);
const latestMigrationFile = migrationFiles
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort()
  .at(-1);
const latestMigration = latestMigrationFile
  ? await readFile(
      new URL(`../supabase/migrations/${latestMigrationFile}`, import.meta.url),
      "utf8",
    )
  : "";

test("readiness schéma — accepte la version requise et les migrations additives", () => {
  assert.equal(REQUIRED_SCHEMA_VERSION, 22);
  assert.equal(supportsRequiredSchemaVersion(22), true);
  assert.equal(supportsRequiredSchemaVersion(23), true);
});

test("readiness schéma — refuse une version ancienne ou invalide", () => {
  for (const value of [21, 21.5, "22", null, undefined]) {
    assert.equal(supportsRequiredSchemaVersion(value), false);
  }
});

test("migration readiness — expose un singleton privé au service role", () => {
  assert.match(
    migration,
    /create table public\.app_schema_version[\s\S]*id smallint primary key check \(id = 1\)[\s\S]*version integer not null/i,
  );
  assert.match(
    migration,
    /alter table public\.app_schema_version enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.app_schema_version from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select on table public\.app_schema_version to service_role/i,
  );
  assert.match(
    migration,
    /insert into public\.app_schema_version \(id, version\)\s*values \(1, 16\)/i,
  );
  assert.doesNotMatch(migration, /\bsecurity\s+definer\b/i);
});

test("migration readiness — valide 0012–0015 avant de créer le marqueur", () => {
  const prerequisitesStart = migration.indexOf("do $readiness_prerequisites$");
  const markerCreation = migration.indexOf(
    "create table public.app_schema_version",
  );

  assert.notEqual(prerequisitesStart, -1);
  assert.notEqual(markerCreation, -1);
  assert.ok(prerequisitesStart < markerCreation);

  const prerequisites = migration.slice(prerequisitesStart, markerCreation);
  assert.match(
    prerequisites,
    /information_schema\.columns[\s\S]*table_name = 'prospects'[\s\S]*column_name = 'last_contact_at'[\s\S]*data_type = 'date'/i,
  );
  assert.match(
    prerequisites,
    /pg_catalog\.pg_constraint[\s\S]*memberships_user_id_unique[\s\S]*UNIQUE \(user_id\)/i,
  );
  assert.match(prerequisites, /company_memory[\s\S]*relrowsecurity/i);
  assert.match(
    prerequisites,
    /company_memory_select[\s\S]*cmd = 'SELECT'[\s\S]*has_org_role[\s\S]*lecture[\s\S]*not like '%commercial%'[\s\S]*section[\s\S]*__+/i,
  );
  assert.match(
    prerequisites,
    /policyname = 'memory_all'[\s\S]*cmd in \('ALL', 'INSERT', 'UPDATE', 'DELETE'\)/i,
  );

  for (const signature of [
    "public.has_org_role(uuid,text[])",
    "public.is_financial_action_kind(text)",
    "public.is_commercial_safe_action_kind(text)",
    "public.is_financial_journal_event(text)",
    "public.is_commercial_safe_journal_event(text)",
    "public.is_financial_connector_ref(text,text)",
    "public.is_financial_action(uuid,uuid)",
    "public.is_commercial_safe_action(uuid,uuid)",
  ]) {
    assert.ok(
      prerequisites.includes(`'${signature}'`),
      `précondition fonction absente : ${signature}`,
    );
  }
  assert.match(prerequisites, /requires_security_definer[\s\S]*prosecdef/i);

  for (const policy of [
    "ad_metrics_select",
    "revenue_select",
    "research_runs_select",
    "briefings_select",
    "actions_select",
    "journal_select",
    "outbox_select",
    "connectors_select",
  ]) {
    assert.ok(
      prerequisites.includes(`'${policy}'`),
      `précondition policy absente : ${policy}`,
    );
  }
  for (const table of [
    "company_memory",
    "actions",
    "journal",
    "outbox_messages",
    "research_runs",
    "briefings",
  ]) {
    assert.ok(
      prerequisites.includes(`'${table}'`),
      `table dérivée absente du contrôle fail-closed : ${table}`,
    );
  }
  assert.match(
    prerequisites,
    /tablename in \([\s\S]*'outbox_messages'[\s\S]*cmd in \('SELECT', 'ALL'\)[\s\S]*coalesce\(qual, ''\) not like '%has_org_role%'[\s\S]*coalesce\(qual, ''\) like '%commercial%'/i,
  );

  assert.match(
    prerequisites,
    /has_table_privilege\([\s\S]*'authenticated'[\s\S]*'service_role'/i,
  );
  assert.match(
    prerequisites,
    /'last_contact_at'[\s\S]*has_column_privilege\(/i,
  );
  assert.match(
    prerequisites,
    /array\['raw', 'notes', 'note_internal'\][\s\S]*has_column_privilege\(/i,
  );
  assert.match(prerequisites, /has_any_column_privilege\([\s\S]*'anon'/i);
  assert.ok(
    (prerequisites.match(/raise exception using/gi) ?? []).length >= 10,
  );
});

test("migration 0019 — réapplique les frontières avant de certifier la readiness", () => {
  const postconditions = catchupMigration.indexOf(
    "do $commercial_rls_postconditions$",
  );
  const marker = catchupMigration.indexOf(
    "insert into public.app_schema_version",
  );

  assert.notEqual(postconditions, -1);
  assert.notEqual(marker, -1);
  assert.ok(postconditions < marker);
  assert.match(
    catchupMigration,
    /alter table public\.app_schema_version enable row level security/i,
  );
  assert.match(
    catchupMigration,
    /revoke all on table public\.app_schema_version from public, anon, authenticated/i,
  );
  assert.match(
    catchupMigration,
    /grant select on table public\.app_schema_version to service_role/i,
  );
  assert.match(
    catchupMigration,
    /found unsafe readiness privileges/i,
  );
  assert.match(
    catchupMigration,
    /values \(1, 19\)[\s\S]*on conflict \(id\) do nothing[\s\S]*update public\.app_schema_version[\s\S]*greatest\(version, 19\)/i,
  );
});

test("migrations — la séquence est complète et le marqueur suit la dernière version", () => {
  const sqlFiles = migrationFiles.filter((name) => name.endsWith(".sql"));
  const versions = sqlFiles
    .map((name) => /^(\d{4})_.+\.sql$/.exec(name))
    .map((match) => (match ? Number(match[1]) : Number.NaN))
    .sort((left, right) => left - right);

  assert.equal(versions.every(Number.isInteger), true);
  assert.deepEqual(
    versions,
    Array.from({ length: REQUIRED_SCHEMA_VERSION }, (_, index) => index + 1),
  );
  assert.equal(versions.at(-1), REQUIRED_SCHEMA_VERSION);
});

test("migrations — la dernière migration relève explicitement le marqueur", () => {
  assert.equal(
    latestMigrationFile?.startsWith(
      String(REQUIRED_SCHEMA_VERSION).padStart(4, "0"),
    ),
    true,
  );
  assert.match(latestMigration, /public\.app_schema_version/i);
  assert.match(
    latestMigration,
    new RegExp(
      `(?:greatest\\(version,\\s*${REQUIRED_SCHEMA_VERSION}\\)|` +
        `set\\s+version\\s*=\\s*${REQUIRED_SCHEMA_VERSION}|` +
        `values\\s*\\(1,\\s*${REQUIRED_SCHEMA_VERSION}\\))`,
      "i",
    ),
  );
});

test("routes de santé — liveness sans base, readiness fail-closed et bornée", () => {
  assert.doesNotMatch(healthRoute, /createAdminClient|app_schema_version/);
  assert.match(readinessRoute, /\.from\("app_schema_version"\)/);
  assert.match(readinessRoute, /\.abortSignal\(controller\.signal\)/);
  assert.match(readinessRoute, /status: 503/);
  assert.match(readinessRoute, /status: "unavailable"/);
  assert.match(readinessRoute, /Cache-Control/);
  assert.ok(READINESS_TIMEOUT_MS > 0 && READINESS_TIMEOUT_MS <= 10_000);
});

test("déploiement — vérifie le schéma avant la mutation puis la readiness publique", () => {
  const preflight = deployWorkflow.indexOf(
    "- name: Verify production database schema readiness",
  );
  const deployment = deployWorkflow.indexOf("az containerapp update");
  const postDeploymentReadiness = deployWorkflow.indexOf(
    '"$app_url/api/ready"',
  );

  assert.notEqual(preflight, -1);
  assert.notEqual(deployment, -1);
  assert.notEqual(postDeploymentReadiness, -1);
  assert.ok(preflight < deployment);
  assert.ok(deployment < postDeploymentReadiness);
  assert.match(
    deployWorkflow,
    new RegExp(
      `REQUIRED_SCHEMA_VERSION: "${REQUIRED_SCHEMA_VERSION}"[\\s\\S]*` +
        "app_schema_version\\?id=eq\\.1&version=gte\\.\\$REQUIRED_SCHEMA_VERSION&select=version",
    ),
  );
  assert.match(
    deployWorkflow,
    /Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY/,
  );
  assert.doesNotMatch(deployWorkflow, /set -x/);
});
