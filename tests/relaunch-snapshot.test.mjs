import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalizeProspectCohort } from "../lib/prospect-cohort-loader.ts";
import { restrictCanonicalCohortToSnapshot } from "../lib/relaunch-snapshot.ts";

const row = (
  id,
  {
    email = "contact@example.test",
    stage = "Nouveau",
    syncedAt = "2026-07-30T12:00:00.000Z",
  } = {},
) => ({
  id,
  name: "Contact",
  email,
  company: "Nepteo",
  stage,
  source: id.startsWith("sheet") ? "google_sheets" : "notion",
  last_contact_at: "2026-06-01",
  synced_at: syncedAt,
});

test("un changement de représentant conserve l'identité figée du snapshot", () => {
  const rawRows = [
    row("notion-new-representative", {
      syncedAt: "2026-07-30T15:00:00.000Z",
    }),
    row("sheet-snapshot-id", {
      syncedAt: "2026-07-30T14:00:00.000Z",
    }),
  ];
  const canonical = canonicalizeProspectCohort(rawRows);

  assert.equal(canonical[0].id, "notion-new-representative");
  assert.deepEqual(
    restrictCanonicalCohortToSnapshot(
      canonical,
      rawRows,
      new Set(["sheet-snapshot-id"]),
    ).map(({ id }) => id),
    ["sheet-snapshot-id"],
  );
});

test("le statut terminal d'un doublon hors snapshot reste bloquant", () => {
  const rawRows = [
    row("notion-representative", {
      syncedAt: "2026-07-30T15:00:00.000Z",
    }),
    row("sheet-snapshot-id", {
      stage: "Ne pas contacter",
      syncedAt: "2026-07-30T14:00:00.000Z",
    }),
  ];

  const restricted = restrictCanonicalCohortToSnapshot(
    canonicalizeProspectCohort(rawRows),
    rawRows,
    new Set(["sheet-snapshot-id"]),
  );

  assert.equal(restricted.length, 1);
  assert.equal(restricted[0].id, "sheet-snapshot-id");
  assert.equal(restricted[0].stage, "Ne pas contacter");
});

test("un membre disparu sans identité vérifiable échoue fermé", () => {
  const rawRows = [row("current")];
  const restricted = restrictCanonicalCohortToSnapshot(
    canonicalizeProspectCohort(rawRows),
    rawRows,
    new Set(["deleted-snapshot-id"]),
  );

  assert.deepEqual(restricted, []);
});

test("approbation et exécution partagent le verrou distribué des syncs", async () => {
  const [approval, execution, sync, lock] = await Promise.all([
    readFile(
      new URL("../app/(cockpit)/_actions/prospects.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/execution.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/demo/lock.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    approval,
    /withDemoMutationLock\([\s\S]{0,160}ctx\.orgId,\s*"data",[\s\S]*loadRelaunchActionAndProspects\([\s\S]*approve_relaunch_action_with_targets/,
  );
  assert.match(
    execution,
    /withDemoMutationLock\(admin,\s*orgId,\s*"data",[\s\S]{0,180}executeApprovedActionUnderLock\(/,
  );
  assert.match(sync, /withRealDataMutationLock\(/);
  assert.match(
    lock,
    /withRealDataMutationLock[\s\S]*withDemoMutationLock\(admin,\s*orgId,\s*"data"/,
  );
});
