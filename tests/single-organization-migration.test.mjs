import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/0013_single_organization_per_user.sql",
    import.meta.url,
  ),
  "utf8",
);
const authContext = await readFile(
  new URL("../lib/auth/context.ts", import.meta.url),
  "utf8",
);
const onboardingAction = await readFile(
  new URL("../app/onboarding/actions.ts", import.meta.url),
  "utf8",
);

function executableSql(source) {
  return source.replace(/--.*$/gm, "");
}

test("migration organisation unique - refuse explicitement les doublons avant la contrainte", () => {
  const duplicateGuard = migration.search(
    /group by user_id\s+having count\(\*\) > 1/i,
  );
  const uniqueConstraint = migration.search(
    /add constraint memberships_user_id_unique unique \(user_id\)/i,
  );

  assert.notEqual(duplicateGuard, -1);
  assert.notEqual(uniqueConstraint, -1);
  assert.ok(duplicateGuard < uniqueConstraint);
  assert.match(migration, /raise exception using/i);
  assert.match(migration, /No membership row was changed\./i);
});

test("migration organisation unique - ne transforme ni ne supprime les memberships", () => {
  const sql = executableSql(migration);
  assert.doesNotMatch(
    sql,
    /\b(?:delete|update|truncate|merge)\b/i,
  );
  assert.doesNotMatch(
    sql,
    /\bdrop\s+constraint\b/i,
  );
  assert.match(
    migration,
    /^-- alter table public\.memberships drop constraint memberships_user_id_unique;$/m,
  );
});

test("contexte organisation - filtre l'utilisateur et ne choisit plus limit(1)", () => {
  assert.match(authContext, /\.eq\("user_id", user\.id\)/);
  assert.match(authContext, /resolveSingleMembership\(rows \?\? \[\]\)/);
  assert.doesNotMatch(authContext, /\.limit\(1\)/);

  assert.match(
    onboardingAction,
    /resolveSingleMembership\(existingMemberships \?\? \[\]\)/,
  );
  assert.doesNotMatch(onboardingAction, /\.limit\(1\)/);
});

test("onboarding organisation - une double soumission concurrente reste idempotente", () => {
  assert.match(onboardingAction, /memberError\.code === "23505"/);
  assert.match(
    onboardingAction,
    /resolveSingleMembership\(concurrentMemberships \?\? \[\]\)/,
  );
  assert.match(
    onboardingAction,
    /await admin\.from\("organizations"\)\.delete\(\)\.eq\("id", org\.id\)/,
  );
});
