import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const initialSchema = await readFile(
  new URL("../supabase/migrations/0001_init.sql", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/0014_company_memory_service_writes.sql",
    import.meta.url,
  ),
  "utf8",
);
const identityActions = await readFile(
  new URL("../app/onboarding/identite/actions.ts", import.meta.url),
  "utf8",
);
const identityPage = await readFile(
  new URL("../app/onboarding/identite/page.tsx", import.meta.url),
  "utf8",
);

function exportedFunctionSource(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `action exportée absente : ${name}`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("company_memory — retire l'écriture directe et conserve la lecture RLS", () => {
  assert.match(
    initialSchema,
    /create policy memory_all on company_memory for all/i,
  );
  assert.match(
    migration,
    /drop policy if exists memory_all on public\.company_memory/i,
  );
  assert.match(
    migration,
    /create policy company_memory_select[\s\S]*for select[\s\S]*is_member\(organization_id\)/i,
  );

  assert.doesNotMatch(migration, /\bfor\s+all\b/i);
  assert.doesNotMatch(migration, /\bfor\s+(?:insert|update|delete)\b/i);
  assert.doesNotMatch(migration, /\bdisable\s+row\s+level\s+security\b/i);
  assert.doesNotMatch(migration, /\bsecurity\s+definer\b/i);
});

test("onboarding identité — les écritures service-role exigent un rôle éditeur", () => {
  assert.match(identityActions, /getCurrentAuthContext\(\)/);
  assert.match(identityActions, /if \(!membership\.canEdit\) redirect\("\/"\)/);
  assert.doesNotMatch(identityActions, /async function requireMembership\(/);
  for (const action of ["proposeIdentity", "applyIdentity", "skipIdentity"]) {
    assert.match(
      exportedFunctionSource(identityActions, action),
      /requireEditorMembership\(\)/,
      `${action} doit passer par le garde éditeur`,
    );
  }

  assert.match(identityPage, /getCurrentAuthContext\(\)/);
  assert.match(identityPage, /if \(!membership\.canEdit\) redirect\("\/"\)/);
});
