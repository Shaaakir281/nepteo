import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const WRITE_ACK = "I_ACKNOWLEDGE_E2E_CSV_PRODUCTION_FIXTURES";
const OWN_NAME = "E2E_RLS_CSV_OWN";
const OTHER_NAME = "E2E_RLS_CSV_OTHER";
const FILE_NAME = "nepteo-e2e-csv-rpc.csv";
const FILE_FINGERPRINT = createHash("sha256")
  .update("nepteo-e2e-csv-rpc-v1")
  .digest("hex")
  .slice(0, 24);
const BUSINESS_TABLES = [
  "connectors",
  "prospects",
  "actions",
  "briefings",
  "outbox_messages",
  "ad_metrics",
  "revenue_events",
  "research_runs",
  "action_target_snapshots",
  "action_target_snapshot_members",
  "value_events",
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable requise absente : ${name}`);
  }
  return value;
}

function assertNoError(result, step) {
  if (result.error) {
    throw new Error(
      `${step} : ${result.error.code ?? "erreur"} — ${result.error.message}`,
    );
  }
  return result.data;
}

function expectDatabaseError(result, expectedCode, step) {
  assert(result.error, `${step} devait échouer.`);
  assert.equal(
    result.error.code,
    expectedCode,
    `${step} a échoué avec ${result.error.code}, pas ${expectedCode}.`,
  );
}

const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
if (process.env.CSV_RPC_SMOKE_WRITE_PROBE !== WRITE_ACK) {
  throw new Error(
    `Sonde non autorisée. Posez CSV_RPC_SMOKE_WRITE_PROBE=${WRITE_ACK}.`,
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findOrganization(name) {
  const organizations = assertNoError(
    await admin
      .from("organizations")
      .select("id,name,activity")
      .eq("name", name)
      .limit(2),
    `Lecture de ${name}`,
  );
  assert(
    organizations.length <= 1,
    `Plusieurs organisations portent le nom réservé ${name}.`,
  );
  return organizations[0] ?? null;
}

async function createFixtureUser() {
  const suffix = randomUUID();
  const result = await admin.auth.admin.createUser({
    email: `nepteo-e2e-csv-${suffix}@example.invalid`,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: { purpose: "nepteo_csv_rpc_smoke" },
  });
  return assertNoError(result, "Création de l'acteur synthétique").user;
}

async function ensureFixtures() {
  let own = await findOrganization(OWN_NAME);
  let other = await findOrganization(OTHER_NAME);

  if (!own) {
    const user = await createFixtureUser();
    try {
      own = assertNoError(
        await admin
          .from("organizations")
          .insert({ name: OWN_NAME, activity: "fixture_csv_rpc" })
          .select("id,name,activity")
          .single(),
        `Création de ${OWN_NAME}`,
      );
      assertNoError(
        await admin.from("memberships").insert({
          organization_id: own.id,
          user_id: user.id,
          role: "admin",
        }),
        `Création du membership de ${OWN_NAME}`,
      );
    } catch (error) {
      if (own?.id) {
        await admin.from("organizations").delete().eq("id", own.id);
      }
      await admin.auth.admin.deleteUser(user.id);
      throw error;
    }
  }

  if (!other) {
    other = assertNoError(
      await admin
        .from("organizations")
        .insert({ name: OTHER_NAME, activity: "fixture_csv_rpc" })
        .select("id,name,activity")
        .single(),
      `Création de ${OTHER_NAME}`,
    );
  }

  const ownMemberships = assertNoError(
    await admin
      .from("memberships")
      .select("user_id,role")
      .eq("organization_id", own.id),
    `Memberships de ${OWN_NAME}`,
  );
  assert.equal(
    ownMemberships.length,
    1,
    `${OWN_NAME} doit avoir exactement un acteur dédié.`,
  );
  assert.equal(
    ownMemberships[0].role,
    "admin",
    `${OWN_NAME} doit porter le rôle admin.`,
  );
  assert.equal(
    own.activity,
    "fixture_csv_rpc",
    `${OWN_NAME} ne porte pas le marqueur de fixture attendu.`,
  );
  const actor = assertNoError(
    await admin.auth.admin.getUserById(ownMemberships[0].user_id),
    `Vérification de l'acteur de ${OWN_NAME}`,
  ).user;
  assert.equal(
    actor.user_metadata?.purpose,
    "nepteo_csv_rpc_smoke",
    `L'acteur de ${OWN_NAME} n'est pas réservé au smoke CSV.`,
  );
  assert(
    actor.email?.endsWith("@example.invalid"),
    `L'acteur de ${OWN_NAME} n'utilise pas une adresse synthétique.`,
  );

  const otherMemberships = assertNoError(
    await admin
      .from("memberships")
      .select("user_id,role")
      .eq("organization_id", other.id),
    `Memberships de ${OTHER_NAME}`,
  );
  assert.equal(
    otherMemberships.length,
    0,
    `${OTHER_NAME} ne doit avoir aucun membre.`,
  );
  assert.equal(
    other.activity,
    "fixture_csv_rpc",
    `${OTHER_NAME} ne porte pas le marqueur de fixture attendu.`,
  );

  return {
    own,
    other,
    actorId: ownMemberships[0].user_id,
  };
}

async function countRows(table, organizationId) {
  const result = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  assertNoError(result, `Comptage ${table}`);
  return result.count ?? 0;
}

async function fixtureState(organizationId) {
  const counts = Object.fromEntries(
    await Promise.all(
      BUSINESS_TABLES.map(async (table) => [
        table,
        await countRows(table, organizationId),
      ]),
    ),
  );
  const memory = assertNoError(
    await admin
      .from("company_memory")
      .select("section")
      .eq("organization_id", organizationId),
    "Lecture de la mémoire fixture",
  );
  const journal = assertNoError(
    await admin
      .from("journal")
      .select("id,event,payload,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    "Lecture du journal fixture",
  );
  return {
    counts,
    memorySections: memory.map((entry) => entry.section).sort(),
    journal,
  };
}

function assertDedicatedFixture(state, name) {
  for (const [table, count] of Object.entries(state.counts)) {
    assert.equal(count, 0, `${name} contient déjà ${count} ligne(s) dans ${table}.`);
  }
  assert.deepEqual(
    state.memorySections,
    [],
    `${name} contient déjà de la mémoire entreprise.`,
  );
}

function rpcPayload(organizationId, actorId, rows) {
  return {
    p_organization_id: organizationId,
    p_actor_id: actorId,
    p_file_name: FILE_NAME,
    p_file_fingerprint: FILE_FINGERPRINT,
    p_delimiter: ",",
    p_field_mapping: {
      name: "name",
      email: "email",
      company: "company",
      stage: "stage",
      notes: "notes",
      last_contact_at: "last_contact_at",
    },
    p_rows: rows,
    p_ignored_rows: 0,
    p_authorization_version: 1,
  };
}

const validRows = [
  {
    external_id: `csv:${FILE_FINGERPRINT}:1`,
    name: "Ada Smoke",
    email: "ada@csv-smoke.invalid",
    company: "Nepteo E2E",
    stage: "lead",
    notes: "Donnée synthétique de recette",
    last_contact_at: "2026-07-01",
    raw: {},
  },
  {
    external_id: `csv:${FILE_FINGERPRINT}:2`,
    name: "Linus Smoke",
    email: "linus@csv-smoke.invalid",
    company: "Nepteo E2E",
    stage: "qualified",
    notes: null,
    last_contact_at: null,
    raw: {},
  },
];

async function csvSnapshot(organizationId) {
  const connectors = assertNoError(
    await admin
      .from("connectors")
      .select("id,status,config")
      .eq("organization_id", organizationId)
      .eq("provider", "csv")
      .order("id"),
    "Snapshot du connecteur CSV",
  );
  const prospects = assertNoError(
    await admin
      .from("prospects")
      .select(
        "id,connector_id,external_id,name,email,company,stage,notes,last_contact_at,source,raw",
      )
      .eq("organization_id", organizationId)
      .eq("source", "csv")
      .order("external_id"),
    "Snapshot des prospects CSV",
  );
  const journal = assertNoError(
    await admin
      .from("journal")
      .select("id,event,payload")
      .eq("organization_id", organizationId)
      .contains("payload", { provider: "csv" })
      .order("created_at"),
    "Snapshot du journal CSV",
  );
  return { connectors, prospects, journal };
}

function assertValidImport(snapshot) {
  assert.equal(snapshot.connectors.length, 1, "Un connecteur CSV est attendu.");
  assert.equal(snapshot.connectors[0].status, "connected");
  assert.equal(
    snapshot.connectors[0].config.file_fingerprint,
    FILE_FINGERPRINT,
  );
  assert.equal(snapshot.connectors[0].config.last_import_count, 2);
  assert.equal(snapshot.prospects.length, 2, "Deux prospects CSV sont attendus.");
  assert.deepEqual(
    snapshot.prospects.map((prospect) => prospect.external_id),
    validRows.map((row) => row.external_id),
  );
  for (const [index, prospect] of snapshot.prospects.entries()) {
    const expected = validRows[index];
    assert.equal(prospect.connector_id, snapshot.connectors[0].id);
    assert.equal(prospect.name, expected.name);
    assert.equal(prospect.email, expected.email);
    assert.equal(prospect.company, expected.company);
    assert.equal(prospect.stage, expected.stage);
    assert.equal(prospect.notes, expected.notes);
    assert.equal(prospect.last_contact_at, expected.last_contact_at);
    assert.equal(prospect.source, "csv");
    assert.deepEqual(prospect.raw, {});
  }
}

const schema = assertNoError(
  await admin
    .from("app_schema_version")
    .select("version")
    .eq("id", 1)
    .single(),
  "Lecture du marqueur de schéma",
);
assert(
  schema.version >= 21,
  `Le schéma ${schema.version} est inférieur à la version 21.`,
);

const fixtures = await ensureFixtures();
const ownInitial = await fixtureState(fixtures.own.id);
const otherInitial = await fixtureState(fixtures.other.id);
assertDedicatedFixture(ownInitial, OWN_NAME);
assertDedicatedFixture(otherInitial, OTHER_NAME);

let failure;
let cleanupFailure;
try {
  const crossTenant = await admin.rpc(
    "replace_csv_prospects",
    rpcPayload(fixtures.other.id, fixtures.actorId, validRows),
  );
  if (!crossTenant.error) {
    const unexpectedConnector = assertNoError(
      await admin
        .from("connectors")
        .select("id,config")
        .eq("organization_id", fixtures.other.id)
        .eq("provider", "csv")
        .maybeSingle(),
      "Inspection après succès inter-tenant inattendu",
    );
    if (
      unexpectedConnector?.config?.file_fingerprint === FILE_FINGERPRINT &&
      unexpectedConnector?.config?.file_name === FILE_NAME
    ) {
      assertNoError(
        await admin
          .from("connectors")
          .delete()
          .eq("id", unexpectedConnector.id)
          .eq("organization_id", fixtures.other.id),
        "Nettoyage du succès inter-tenant inattendu",
      );
    }
  }
  expectDatabaseError(crossTenant, "42501", "Refus inter-tenant");
  assert.deepEqual(
    await fixtureState(fixtures.other.id),
    otherInitial,
    `${OTHER_NAME} a été modifiée par le refus inter-tenant.`,
  );

  const firstImport = await admin.rpc(
    "replace_csv_prospects",
    rpcPayload(fixtures.own.id, fixtures.actorId, validRows),
  );
  const firstResult = assertNoError(firstImport, "Premier import CSV");
  assert.equal(firstResult.imported, 2);

  const beforeRollbackProbe = await csvSnapshot(fixtures.own.id);
  assertValidImport(beforeRollbackProbe);

  const invalidRows = structuredClone(validRows);
  invalidRows[1].last_contact_at = "not-a-date";
  const rollbackProbe = await admin.rpc(
    "replace_csv_prospects",
    rpcPayload(fixtures.own.id, fixtures.actorId, invalidRows),
  );
  expectDatabaseError(rollbackProbe, "22007", "Sonde de rollback");
  assert.deepEqual(
    await csvSnapshot(fixtures.own.id),
    beforeRollbackProbe,
    "La transaction invalide a laissé un état partiel.",
  );

  const replay = assertNoError(
    await admin.rpc(
      "replace_csv_prospects",
      rpcPayload(fixtures.own.id, fixtures.actorId, validRows),
    ),
    "Réimport idempotent",
  );
  assert.equal(replay.imported, 2);
  const afterReplay = await csvSnapshot(fixtures.own.id);
  assertValidImport(afterReplay);
  assert.equal(
    afterReplay.connectors[0].id,
    beforeRollbackProbe.connectors[0].id,
    "Le rejeu a remplacé le connecteur CSV.",
  );
  assert.deepEqual(
    afterReplay.prospects,
    beforeRollbackProbe.prospects,
    "Le rejeu n'a pas conservé les identités et le contenu des prospects.",
  );
} catch (error) {
  failure = error;
} finally {
  try {
    const beforeClear = await csvSnapshot(fixtures.own.id);
    assert(
      beforeClear.connectors.length <= 1,
      "Plusieurs connecteurs CSV existent sur la fixture OWN.",
    );
    const connector = beforeClear.connectors[0];
    if (connector) {
      if (
        connector.config?.file_fingerprint !== FILE_FINGERPRINT ||
        connector.config?.file_name !== FILE_NAME
      ) {
        throw new Error(
          "Nettoyage refusé : le connecteur CSV ne porte pas la fixture attendue.",
        );
      }
      const cleared = assertNoError(
        await admin.rpc("clear_csv_prospects", {
          p_organization_id: fixtures.own.id,
          p_actor_id: fixtures.actorId,
        }),
        "Retrait CSV",
      );
      assert.equal(cleared.cleared, true);
      assert.equal(cleared.deleted, 2);

      const afterClear = await csvSnapshot(fixtures.own.id);
      assert.deepEqual(afterClear.connectors, []);
      assert.deepEqual(afterClear.prospects, []);
    }

    const secondClear = assertNoError(
      await admin.rpc("clear_csv_prospects", {
        p_organization_id: fixtures.own.id,
        p_actor_id: fixtures.actorId,
      }),
      "Second retrait CSV",
    );
    assert.deepEqual(secondClear, {
      cleared: false,
      reason: "not_found",
    });
  } catch (error) {
    cleanupFailure = error;
  }
}

if (failure && cleanupFailure) {
  throw new AggregateError(
    [failure, cleanupFailure],
    "Le smoke a échoué et son nettoyage a également échoué.",
  );
}
if (cleanupFailure) {
  throw cleanupFailure;
}
if (failure) {
  throw failure;
}

const finalOwn = await fixtureState(fixtures.own.id);
for (const table of BUSINESS_TABLES) {
  assert.equal(
    finalOwn.counts[table],
    0,
    `${OWN_NAME} conserve des lignes dans ${table}.`,
  );
}
assert.deepEqual(
  finalOwn.memorySections,
  [],
  `${OWN_NAME} conserve de la mémoire entreprise.`,
);
assert.deepEqual(
  await fixtureState(fixtures.other.id),
  otherInitial,
  `${OTHER_NAME} a changé pendant le smoke.`,
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      schema: schema.version,
      own_fixture: { id: fixtures.own.id, name: OWN_NAME },
      other_fixture: { id: fixtures.other.id, name: OTHER_NAME },
      checks: [
        "cross_tenant_refused",
        "valid_import",
        "invalid_date_rollback",
        "idempotent_reimport",
        "clear",
        "second_clear_not_found",
      ],
      retained: "append_only_journal_and_named_fixtures",
    },
    null,
    2,
  ),
);
