import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = (await readdir(migrationsDirectory)).sort();
const foundation = await readFile(
  new URL("../supabase/migrations/0031_connector_foundation.sql", import.meta.url),
  "utf8",
);
const conflictHttp = await readFile(
  new URL("../supabase/migrations/0032_connector_conflict_http.sql", import.meta.url),
  "utf8",
);

test("migration reconciliation - canonical order follows production 0029 and 0030", () => {
  assert.deepEqual(
    migrationNames.filter((name) => /^00(?:29|30|31|32)_/.test(name)),
    [
      "0029_meta_metrics.sql",
      "0030_meta_ads_pilot_access.sql",
      "0031_connector_foundation.sql",
      "0032_connector_conflict_http.sql",
    ],
  );

  const foundationPrerequisite = foundation.slice(
    foundation.indexOf("do $connector_foundation_prerequisites$"),
    foundation.indexOf("do $connector_foundation_revision$"),
  );
  const conflictPrerequisite = conflictHttp.slice(
    conflictHttp.indexOf("do $connector_conflict_http_prerequisites$"),
    conflictHttp.indexOf("do $connector_conflict_http_rewrite$"),
  );

  assert.match(
    foundationPrerequisite,
    /app_schema_version[\s\S]*version >= 30[\s\S]*requires schema version 30/i,
  );
  assert.match(
    conflictPrerequisite,
    /app_schema_version[\s\S]*version >= 31[\s\S]*requires schema version 31/i,
  );
  assert.match(
    foundation,
    /greatest\(version, 31\)[\s\S]*where id = 1 and version >= 30[\s\S]*version >= 31/i,
  );
  assert.match(
    conflictHttp,
    /greatest\(version, 32\)[\s\S]*where id = 1 and version >= 31[\s\S]*version >= 32/i,
  );
});

test("migration reconciliation - staging replay validates instead of overwriting", () => {
  const revisionGuard = foundation.slice(
    foundation.indexOf("do $connector_foundation_revision$"),
    foundation.indexOf("comment on column public.connectors.revision"),
  );

  assert.match(
    revisionGuard,
    /if not exists[\s\S]*information_schema\.columns[\s\S]*column_name = 'revision'[\s\S]*add column revision bigint not null default 0/i,
  );
  assert.match(
    revisionGuard,
    /data_type = 'bigint'[\s\S]*is_nullable = 'NO'[\s\S]*column_default is not null/i,
  );
  assert.match(
    revisionGuard,
    /pg_get_constraintdef[\s\S]*revision\[\[:space:\]\]\*>=[\s\S]*incompatible revision column/i,
  );
  assert.doesNotMatch(foundation, /errcode = '40001'/i);
  assert.match(foundation, /errcode = 'PT409'/i);
});

test("migration reconciliation - no historical prospects raw cleanup or business DROP", () => {
  const beforeFunctions = foundation.slice(
    0,
    foundation.indexOf("create or replace function public.assert_connector_mutation_allowed"),
  );

  assert.doesNotMatch(
    beforeFunctions,
    /(?:update|delete from)\s+public\.prospects\b/i,
  );
  assert.doesNotMatch(
    `${foundation}\n${conflictHttp}`,
    /\bdrop\s+(?:table|column|function|policy|schema|type)\b/i,
  );
});

test("migration reconciliation - PT409 already installed is a controlled no-op", () => {
  const rewrite = conflictHttp.slice(
    conflictHttp.indexOf("do $connector_conflict_http_rewrite$"),
    conflictHttp.indexOf("do $connector_conflict_http_postconditions$"),
  );
  const postconditions = conflictHttp.slice(
    conflictHttp.indexOf("do $connector_conflict_http_postconditions$"),
    conflictHttp.indexOf("update public.app_schema_version"),
  );

  assert.match(
    rewrite,
    /if position\('errcode = ''40001''' in v_definition\) > 0[\s\S]*replace\([\s\S]*execute v_rewritten/i,
  );
  assert.match(
    rewrite,
    /elsif position\('errcode = ''PT409''' in v_definition\) > 0 then[\s\S]*null;/i,
  );
  assert.match(
    rewrite,
    /else[\s\S]*raise exception[\s\S]*0032 expected connector conflict marker was not found/i,
  );
  assert.match(
    postconditions,
    /position\('errcode = ''PT409''' in v_definition\) = 0[\s\S]*position\('errcode = ''40001''' in v_definition\) > 0/i,
  );
});

test("migration reconciliation - postconditions precede readiness certification", () => {
  const foundationPostconditions = foundation.indexOf(
    "do $connector_foundation_postconditions$",
  );
  const foundationVersion = foundation.indexOf("update public.app_schema_version");
  const conflictPostconditions = conflictHttp.indexOf(
    "do $connector_conflict_http_postconditions$",
  );
  const conflictVersion = conflictHttp.indexOf("update public.app_schema_version");

  assert.ok(foundationPostconditions >= 0 && foundationPostconditions < foundationVersion);
  assert.ok(conflictPostconditions >= 0 && conflictPostconditions < conflictVersion);
  assert.match(
    foundation.slice(foundationPostconditions, foundationVersion),
    /column_name = 'revision'[\s\S]*authorize_connector[\s\S]*finish_connector_revocation[\s\S]*postconditions failed/i,
  );
  assert.match(
    conflictHttp.slice(conflictPostconditions, conflictVersion),
    /commit_connector_transition[\s\S]*finish_connector_revocation[\s\S]*postconditions failed/i,
  );
});
