import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXPECTED_CONNECTOR_PROVIDERS,
  EXPECTED_LEGACY_IDENTITY_SHA256,
  NORTHWIND_MEMORY_SECTIONS,
  SOURCE_FIXTURE_SHA256,
  TARGET_ORGANIZATION_ID,
  TARGET_ORGANIZATION_NAME,
  TARGET_SUPABASE_ORIGIN,
  WRITE_ACK,
  WRITE_ACK_ENV,
  acquireOwnedDemoLock,
  assertCleanupPostconditions,
  assertMutationAcknowledged,
  exactProviderSet,
  fixtureRowsFromCsv,
  legacyIdentityFingerprint,
  parseArgs,
  sourceFixtureSha256,
  validateSupabaseUrl,
} from "../scripts/rebuild-showcase-v2.mjs";

function ambiguousLockAdmin(probeRows) {
  let insertedRow = null;
  let probeCalls = 0;
  const admin = {
    from(table) {
      assert.equal(table, "company_memory");
      if (insertedRow === null) {
        return {
          insert(row) {
            insertedRow = row;
            return this;
          },
          select() {
            return this;
          },
          async single() {
            return {
              data: null,
              error: {
                code: "FETCH_ERROR",
                message: "réponse perdue après commit",
              },
            };
          },
        };
      }
      const filters = [];
      return {
        select() {
          return this;
        },
        eq(column, value) {
          filters.push(["eq", column, value]);
          return this;
        },
        contains(column, value) {
          filters.push(["contains", column, value]);
          return this;
        },
        async limit(value) {
          probeCalls += 1;
          assert.equal(value, 2);
          assert.deepEqual(filters, [
            ["eq", "organization_id", TARGET_ORGANIZATION_ID],
            ["eq", "section", "__demo_lock"],
            ["contains", "content", { token: insertedRow.content.token }],
          ]);
          return {
            data: probeRows(insertedRow),
            error: null,
          };
        },
      };
    },
  };
  return {
    admin,
    get insertedRow() {
      return insertedRow;
    },
    get probeCalls() {
      return probeCalls;
    },
  };
}

test("rebuild showcase — le dry-run est le mode par défaut", () => {
  assert.deepEqual(parseArgs([]), {
    mode: "dry-run",
    ack: null,
    help: false,
  });
  assert.deepEqual(parseArgs(["--dry-run"]), {
    mode: "dry-run",
    ack: null,
    help: false,
  });
  assert.throws(() => parseArgs(["--dry-run", "--apply"]));
});

test("rebuild showcase — apply exige les deux ACK liés au projet et à l'organisation", () => {
  assert.match(WRITE_ACK, /hrqnzorapjnosjphftur/);
  assert.match(WRITE_ACK, new RegExp(TARGET_ORGANIZATION_ID));
  const args = parseArgs(["--apply", "--ack", WRITE_ACK]);

  assert.throws(() => assertMutationAcknowledged(args, {}));
  assert.throws(() =>
    assertMutationAcknowledged(
      parseArgs(["--apply", "--ack", "ACK_INCORRECT"]),
      { [WRITE_ACK_ENV]: WRITE_ACK },
    ),
  );
  assert.doesNotThrow(() =>
    assertMutationAcknowledged(args, { [WRITE_ACK_ENV]: WRITE_ACK }),
  );
});

test("rebuild showcase — seule l'origine Supabase PROD exacte est acceptée", () => {
  assert.equal(
    validateSupabaseUrl(TARGET_SUPABASE_ORIGIN),
    TARGET_SUPABASE_ORIGIN,
  );
  assert.throws(() =>
    validateSupabaseUrl("https://staging-example.supabase.co"),
  );
  assert.throws(() => validateSupabaseUrl(`${TARGET_SUPABASE_ORIGIN}/rest/v1`));
  assert.throws(() => validateSupabaseUrl(`${TARGET_SUPABASE_ORIGIN}?x=1`));
});

test("rebuild showcase — reprend son verrou si l'insert a été commité mais la réponse perdue", async () => {
  const mock = ambiguousLockAdmin((insertedRow) => [
    {
      id: "lock-owned-after-lost-response",
      ...insertedRow,
    },
  ]);

  const lock = await acquireOwnedDemoLock(mock.admin);

  assert.equal(mock.probeCalls, 1);
  assert.equal(lock.id, "lock-owned-after-lost-response");
  assert.equal(lock.token, mock.insertedRow.content.token);
  assert.deepEqual(lock.content, mock.insertedRow.content);
});

test("rebuild showcase — refuse l'apply si aucun verrou n'est retrouvé après une réponse ambiguë", async () => {
  const mock = ambiguousLockAdmin(() => []);

  await assert.rejects(
    acquireOwnedDemoLock(mock.admin),
    (error) => {
      assert.equal(error.name, "OperatorSafetyError");
      assert.equal(error.details.acquisition_state, "absent");
      assert.equal(error.details.probe_count, 0);
      assert.equal(error.details.lock_token, mock.insertedRow.content.token);
      return true;
    },
  );
  assert.equal(mock.probeCalls, 1);
});

test("rebuild showcase — le CSV figé contient exactement 24 lignes", async () => {
  const bytes = await readFile(
    new URL("../docs/tests/prospects-test.csv", import.meta.url),
  );
  const lfBytes = Buffer.from(
    bytes.toString("utf8").replace(/\r\n/g, "\n"),
    "utf8",
  );
  const crlfBytes = Buffer.from(
    lfBytes.toString("utf8").replace(/\n/g, "\r\n"),
    "utf8",
  );

  assert.equal(sourceFixtureSha256(bytes), SOURCE_FIXTURE_SHA256);
  assert.equal(sourceFixtureSha256(lfBytes), SOURCE_FIXTURE_SHA256);
  assert.equal(sourceFixtureSha256(crlfBytes), SOURCE_FIXTURE_SHA256);
  assert.equal(fixtureRowsFromCsv(bytes.toString("utf8")).length, 24);
});

test("rebuild showcase — l'allowlist des six providers est stricte", () => {
  assert.equal(exactProviderSet(EXPECTED_CONNECTOR_PROVIDERS), true);
  assert.equal(
    exactProviderSet(
      EXPECTED_CONNECTOR_PROVIDERS.filter((provider) => provider !== "hubspot"),
    ),
    false,
  );
  assert.equal(
    exactProviderSet([...EXPECTED_CONNECTOR_PROVIDERS, "salesforce"]),
    false,
  );
  assert.equal(
    exactProviderSet(
      EXPECTED_CONNECTOR_PROVIDERS.map((provider) =>
        provider === "pipedrive" ? "salesforce" : provider,
      ),
    ),
    false,
  );
});

test("rebuild showcase — l'empreinte mémoire inspectée reste explicitement figée", () => {
  assert.equal(
    EXPECTED_LEGACY_IDENTITY_SHA256,
    "ef95a8dddcea3e337bb7baa9a262c95bead107201b41d1be2e81ea7a23ca5b2e",
  );
  assert.deepEqual(NORTHWIND_MEMORY_SECTIONS, [
    "activite",
    "canaux",
    "objectifs",
    "offres",
    "philosophie",
    "presence",
    "ton",
    "zone",
  ]);
  const organization = { activity: "ancienne activité" };
  const rows = [{ section: "activite", content: { text: "fixture" } }];
  assert.notEqual(
    legacyIdentityFingerprint(organization, rows),
    legacyIdentityFingerprint(
      { activity: "activité modifiée" },
      rows,
    ),
  );
});

function emptyOperationalTables() {
  return {
    actions: [],
    briefings: [],
    outbox_messages: [],
    ad_metrics: [],
    revenue_events: [],
    action_target_snapshots: [],
    action_target_snapshot_members: [],
  };
}

test("rebuild showcase — les postconditions exigent un socle neutre", () => {
  const preserved = {
    memberships: [{ organization_id: TARGET_ORGANIZATION_ID, user_id: "u1" }],
    journal: [{ id: "j1" }],
    research_runs: [{ id: "r1" }],
    value_events: [{ id: "v1" }],
  };
  const before = {
    schema_version: 21,
    organization: {
      id: TARGET_ORGANIZATION_ID,
      name: TARGET_ORGANIZATION_NAME,
      activity: "ancienne activité",
      execution_paused: false,
    },
    tables: {
      ...emptyOperationalTables(),
      ...preserved,
      company_memory: [{ id: "m1", section: "activite" }],
      connectors: [{ id: "c1" }],
      prospects: [{ id: "p1" }],
    },
  };
  const after = {
    schema_version: 21,
    organization: { ...before.organization, activity: null },
    tables: {
      ...emptyOperationalTables(),
      ...preserved,
      company_memory: [],
      connectors: [],
      prospects: [],
    },
  };

  assert.doesNotThrow(() => assertCleanupPostconditions(before, after));
  assert.throws(() =>
    assertCleanupPostconditions(before, {
      ...after,
      organization: { ...after.organization, name: "Autre nom" },
    }),
  );
  assert.throws(() =>
    assertCleanupPostconditions(before, {
      ...after,
      tables: { ...after.tables, company_memory: [{ id: "reste" }] },
    }),
  );
});
