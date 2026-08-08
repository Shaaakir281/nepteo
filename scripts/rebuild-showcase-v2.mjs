import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdtemp,
  open,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const TARGET_ORGANIZATION_ID =
  "9d2e161c-203b-441c-afaf-49848e1a35ab";
export const TARGET_ORGANIZATION_NAME = "Fathi Solution";
export const TARGET_SUPABASE_ORIGIN =
  "https://hrqnzorapjnosjphftur.supabase.co";
export const TARGET_SUPABASE_PROJECT_REF = "hrqnzorapjnosjphftur";
export const EXPECTED_SCHEMA_VERSION = 21;
export const EXPECTED_CONNECTOR_COUNT = 6;
export const EXPECTED_PROSPECT_COUNT = 48;
export const EXPECTED_SOURCE_COUNT = 24;
export const WRITE_ACK_ENV = "REBUILD_SHOWCASE_V2_WRITE_ACK";
export const WRITE_ACK =
  "I_ACKNOWLEDGE_hrqnzorapjnosjphftur_9d2e161c-203b-441c-afaf-49848e1a35ab_DELETE_48_PROSPECTS_6_CONNECTORS_AND_8_MEMORY_SECTIONS";

const SOURCE_FIXTURE_URL = new URL(
  "../docs/tests/prospects-test.csv",
  import.meta.url,
);
export const SOURCE_FIXTURE_SHA256 =
  "ad14a5a822871a0e5e1c04ac690eac0192244446c685cde560fec313e57e4eb3";
const BACKUP_FORMAT = "nepteo-showcase-v2-backup";
const BACKUP_VERSION = 1;
const JOURNAL_EVENT = "showcase_v2_shell_prepared";
const DEMO_LOCK_SECTION = "__demo_lock";
const PAGE_SIZE = 500;
const MAX_BACKUP_ROWS_PER_TABLE = 100_000;

export const EXPECTED_CONNECTOR_PROVIDERS = Object.freeze([
  "demo",
  "google_sheets",
  "hubspot",
  "meta_ads",
  "notion",
  "pipedrive",
]);

const EXPECTED_CONNECTOR_BUSINESS_SHA256 = new Map([
  ["demo", "4bc710c2e5c4b58f338ead06eefc412680d4032572488eaa4718f848002e6311"],
  ["google_sheets", "66d6981fa7b78825f2fea93afcc5ea2d9c73647e4cde773110096c4526f6d354"],
  ["hubspot", "16bebd8eccfd99e7785e473da4b1051863ddb0b592c7d295861f2efba3975db2"],
  ["meta_ads", "e4515b631254bafc79c4b15a4ed859d9f6c75f86898979757dd294dc245cc636"],
  ["notion", "647725140036ce63a6be35f065efb7122cdcb75bbf42f9267e4752ab99045101"],
  ["pipedrive", "81eab7c29d90615db4e775e590e5a07554b75e9e2da8f31e8eb20cc54c774e6b"],
]);

const EXPECTED_PROSPECT_EVIDENCE = new Map([
  [
    "google_sheets",
    {
      external_ids_sha256:
        "70f888eea9bf53b58f37157c779b8be0cdf7b172f3100e37219c595fae1dd6f8",
      business_sha256:
        "ecdbae21734fa9a3e768f0e80608d1c0d59823a06e8001a73ac0f694e15efa94",
    },
  ],
  [
    "notion",
    {
      external_ids_sha256:
        "dbba36428e5b5a23c662f01b05ba952f5c5b48b9915b137050fe7bff69d1d74d",
      business_sha256:
        "6d6f7e78dbda0374e09299b2e5b7b99481cf2bb6fa0fcc2bcb65d34c0c18775c",
    },
  ],
]);

export const NORTHWIND_MEMORY_SECTIONS = Object.freeze([
  "activite",
  "canaux",
  "objectifs",
  "offres",
  "philosophie",
  "presence",
  "ton",
  "zone",
]);

/**
 * Empreinte relevée en lecture seule sur la production le 2026-07-31.
 * Elle couvre `organizations.activity` et le couple section/contenu des huit
 * lignes métier. La mémoire constatée est un ancien état de vitrine mixte :
 * on ne l'assimile donc jamais à la fixture par son seul nom de section.
 */
export const EXPECTED_LEGACY_IDENTITY_SHA256 =
  "ef95a8dddcea3e337bb7baa9a262c95bead107201b41d1be2e81ea7a23ca5b2e";

const TABLE_SPECS = Object.freeze({
  memberships: ["user_id"],
  company_memory: ["id"],
  connectors: ["id"],
  prospects: ["id"],
  actions: ["id"],
  journal: ["id"],
  briefings: ["organization_id"],
  outbox_messages: ["id"],
  ad_metrics: ["id"],
  research_runs: ["id"],
  revenue_events: ["id"],
  action_target_snapshots: ["action_id"],
  action_target_snapshot_members: ["action_id", "prospect_id"],
  value_events: ["id"],
});

const MUST_BE_EMPTY_BEFORE_AND_AFTER = Object.freeze([
  "actions",
  "briefings",
  "outbox_messages",
  "ad_metrics",
  "revenue_events",
  "action_target_snapshots",
  "action_target_snapshot_members",
]);

const MUST_REMAIN_BYTE_EQUIVALENT = Object.freeze([
  "memberships",
  "journal",
  "research_runs",
  "value_events",
]);

export class OperatorSafetyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "OperatorSafetyError";
    this.details = details;
  }
}

function invariant(condition, message, details = {}) {
  if (!condition) throw new OperatorSafetyError(message, details);
}

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sourceFixtureSha256(bytes) {
  const normalizedBytes = Buffer.from(
    bytes.toString("utf8").replace(/\r\n/g, "\n"),
    "utf8",
  );
  return sha256(normalizedBytes);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function stateFingerprint(snapshot) {
  return sha256(
    stableStringify({
      schema_version: snapshot.schema_version,
      organization: snapshot.organization,
      tables: snapshot.tables,
    }),
  );
}

function preservedFingerprints(snapshot) {
  return Object.fromEntries(
    MUST_REMAIN_BYTE_EQUIVALENT.map((table) => [
      table,
      sha256(stableStringify(snapshot.tables[table])),
    ]),
  );
}

export function parseArgs(argv) {
  let apply = false;
  let explicitDryRun = false;
  let ack = null;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      invariant(!apply, "Option --apply dupliquée.");
      apply = true;
    } else if (arg === "--dry-run") {
      invariant(!explicitDryRun, "Option --dry-run dupliquée.");
      explicitDryRun = true;
    } else if (arg === "--ack") {
      invariant(ack === null, "Option --ack dupliquée.");
      const value = argv[index + 1];
      invariant(
        typeof value === "string" && value.length > 0 && !value.startsWith("--"),
        "Option --ack sans valeur.",
      );
      ack = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else {
      throw new OperatorSafetyError(`Option inconnue : ${arg}`);
    }
  }

  invariant(
    !(apply && explicitDryRun),
    "--apply et --dry-run sont mutuellement exclusifs.",
  );
  invariant(
    apply || ack === null,
    "--ack n'est accepté qu'avec --apply.",
  );
  return { mode: apply ? "apply" : "dry-run", ack, help };
}

export function assertMutationAcknowledged(args, env) {
  if (args.mode !== "apply") return;
  invariant(
    args.ack === WRITE_ACK,
    `Mutation refusée : passez --ack ${WRITE_ACK}.`,
  );
  invariant(
    env[WRITE_ACK_ENV] === WRITE_ACK,
    `Mutation refusée : posez ${WRITE_ACK_ENV}=${WRITE_ACK}.`,
  );
}

/**
 * Petit parseur RFC 4180, volontairement local : le fichier de référence ne
 * doit pas dépendre d'une bibliothèque ou d'une heuristique de séparateur.
 */
export function parseCsv(text) {
  const input = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      invariant(cell.length === 0, "Guillemet CSV inattendu dans une cellule.");
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  invariant(!quoted, "Fichier CSV invalide : cellule citée non terminée.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
    rows.push(row);
  }
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((value) => value === "")
  ) {
    rows.pop();
  }
  return rows;
}

export function fixtureRowsFromCsv(text) {
  const rows = parseCsv(text);
  invariant(rows.length > 0, "Le CSV de référence est vide.");
  invariant(
    stableStringify(rows[0]) ===
      stableStringify(["Nom", "Email", "Entreprise", "Statut"]),
    "Les en-têtes du CSV de référence ont changé.",
    { headers: rows[0] },
  );
  invariant(
    rows.length === EXPECTED_SOURCE_COUNT + 1,
    `Le CSV doit contenir exactement ${EXPECTED_SOURCE_COUNT} contacts.`,
    { rows: rows.length - 1 },
  );

  const contacts = rows.slice(1).map((values, index) => {
    invariant(
      values.length === 4,
      `La ligne CSV ${index + 2} ne contient pas exactement 4 colonnes.`,
    );
    const [name, email, company, stage] = values;
    invariant(name.length > 0, `Nom vide à la ligne CSV ${index + 2}.`);
    invariant(company.length > 0, `Entreprise vide à la ligne CSV ${index + 2}.`);
    invariant(stage.length > 0, `Statut vide à la ligne CSV ${index + 2}.`);
    return { name, email, company, stage };
  });

  invariant(
    new Set(contacts.map(prospectSignature)).size === contacts.length,
    "Le CSV de référence contient deux lignes métier identiques.",
  );
  return contacts;
}

function scalar(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function prospectSignature(row) {
  return stableStringify([
    scalar(row.name),
    scalar(row.email),
    scalar(row.company),
    scalar(row.stage),
  ]);
}

export function exactProviderSet(providers) {
  return stableStringify([...providers].sort()) ===
    stableStringify([...EXPECTED_CONNECTOR_PROVIDERS].sort());
}

function connectorBusinessEvidence(connector) {
  return {
    provider: connector.provider,
    type: connector.type,
    status: connector.status,
    encrypted_credentials: connector.encrypted_credentials,
    config: connector.config,
  };
}

function prospectBusinessEvidence(prospect) {
  return {
    external_id: prospect.external_id,
    name: prospect.name,
    email: prospect.email,
    company: prospect.company,
    stage: prospect.stage,
    source: prospect.source,
    raw: prospect.raw,
    notes: prospect.notes,
    note_internal: prospect.note_internal,
    last_contact_at: prospect.last_contact_at,
  };
}

export function legacyIdentityFingerprint(organization, memoryRows) {
  return sha256(
    stableStringify({
      activity: organization.activity,
      sections: memoryRows
        .map(({ section, content }) => ({ section, content }))
        .sort((left, right) => left.section.localeCompare(right.section)),
    }),
  );
}

function multiset(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function assertNoError(result, step) {
  if (result.error) {
    throw new OperatorSafetyError(
      `${step} : ${result.error.code ?? "erreur"} — ${result.error.message}`,
      { step, code: result.error.code ?? null },
    );
  }
  return result.data;
}

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  invariant(value, `Variable requise absente : ${name}.`);
  return value;
}

export function validateSupabaseUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new OperatorSafetyError("NEXT_PUBLIC_SUPABASE_URL n'est pas une URL.");
  }
  invariant(
    parsed.protocol === "https:",
    "La cible Supabase doit obligatoirement utiliser HTTPS.",
  );
  invariant(
    parsed.origin === TARGET_SUPABASE_ORIGIN,
    `Projet Supabase refusé : seule la production ${TARGET_SUPABASE_PROJECT_REF} est autorisée.`,
    { expected: TARGET_SUPABASE_ORIGIN, actual: parsed.origin },
  );
  invariant(
    parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.username === "" &&
      parsed.password === "",
    "NEXT_PUBLIC_SUPABASE_URL doit être exactement l'origine de production, sans chemin, paramètres ni identifiants.",
  );
  return TARGET_SUPABASE_ORIGIN;
}

async function countTable(admin, table) {
  const result = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", TARGET_ORGANIZATION_ID);
  assertNoError(result, `Comptage ${table}`);
  invariant(result.count !== null, `Comptage ${table} indisponible.`);
  invariant(
    result.count <= MAX_BACKUP_ROWS_PER_TABLE,
    `${table} dépasse la limite de sauvegarde opératoire.`,
    { table, count: result.count, limit: MAX_BACKUP_ROWS_PER_TABLE },
  );
  return result.count;
}

async function fetchAllTable(admin, table, orderColumns) {
  const expectedCount = await countTable(admin, table);
  const rows = [];

  for (let offset = 0; offset < expectedCount; offset += PAGE_SIZE) {
    let query = admin
      .from(table)
      .select("*")
      .eq("organization_id", TARGET_ORGANIZATION_ID);
    for (const column of orderColumns) {
      query = query.order(column, { ascending: true });
    }
    const page = assertNoError(
      await query.range(
        offset,
        Math.min(expectedCount - 1, offset + PAGE_SIZE - 1),
      ),
      `Lecture ${table} [${offset}]`,
    );
    rows.push(...(page ?? []));
  }

  const verifiedCount = await countTable(admin, table);
  invariant(
    verifiedCount === expectedCount && rows.length === expectedCount,
    `${table} a changé pendant sa sauvegarde.`,
    { before: expectedCount, read: rows.length, after: verifiedCount },
  );
  return rows;
}

export async function captureSnapshot(admin) {
  const schema = assertNoError(
    await admin
      .from("app_schema_version")
      .select("version,updated_at")
      .eq("id", 1)
      .limit(2),
    "Lecture du marqueur de schéma",
  );
  invariant(schema.length === 1, "Marqueur de schéma absent ou ambigu.");
  invariant(
    schema[0].version === EXPECTED_SCHEMA_VERSION,
    `Schéma ${schema[0].version} refusé : ce script connaît uniquement la version ${EXPECTED_SCHEMA_VERSION}.`,
  );

  const organizations = assertNoError(
    await admin
      .from("organizations")
      .select("*")
      .eq("id", TARGET_ORGANIZATION_ID)
      .limit(2),
    "Lecture de l'organisation cible",
  );
  invariant(
    organizations.length === 1,
    "L'organisation cible est absente ou ambiguë.",
  );

  const tableEntries = await Promise.all(
    Object.entries(TABLE_SPECS).map(async ([table, orderColumns]) => [
      table,
      await fetchAllTable(admin, table, orderColumns),
    ]),
  );

  return {
    captured_at: new Date().toISOString(),
    schema_version: schema[0].version,
    schema_updated_at: schema[0].updated_at,
    organization: organizations[0],
    tables: Object.fromEntries(tableEntries),
  };
}

export function assertShowcaseSnapshot(snapshot, fixtureRows) {
  const { organization, tables } = snapshot;
  invariant(
    organization.id === TARGET_ORGANIZATION_ID,
    "L'identifiant de l'organisation ne correspond pas à la cible codée.",
  );
  invariant(
    organization.name === TARGET_ORGANIZATION_NAME,
    `Nom cible inattendu : ${organization.name ?? "(null)"}.`,
  );
  invariant(
    tables.connectors.length === EXPECTED_CONNECTOR_COUNT,
    `Il faut exactement ${EXPECTED_CONNECTOR_COUNT} connecteurs.`,
    { actual: tables.connectors.length },
  );
  invariant(
    tables.prospects.length === EXPECTED_PROSPECT_COUNT,
    `Il faut exactement ${EXPECTED_PROSPECT_COUNT} prospects.`,
    { actual: tables.prospects.length },
  );

  for (const table of MUST_BE_EMPTY_BEFORE_AND_AFTER) {
    invariant(
      tables[table].length === 0,
      `${table} doit être vide avant l'opération.`,
      { table, count: tables[table].length },
    );
  }

  invariant(
    tables.company_memory.length === NORTHWIND_MEMORY_SECTIONS.length,
    "La mémoire doit contenir exactement les huit sections métier inspectées.",
    { count: tables.company_memory.length },
  );
  const memorySections = tables.company_memory
    .map((row) => row.section)
    .sort();
  invariant(
    stableStringify(memorySections) ===
      stableStringify([...NORTHWIND_MEMORY_SECTIONS].sort()),
    "L'ensemble des sections mémoire diffère de l'état inspecté.",
    { sections: memorySections },
  );
  const identityFingerprint = legacyIdentityFingerprint(
    organization,
    tables.company_memory,
  );
  invariant(
    identityFingerprint === EXPECTED_LEGACY_IDENTITY_SHA256,
    "L'activité ou le contenu mémoire ne correspond plus à l'empreinte inspectée.",
    {
      expected: EXPECTED_LEGACY_IDENTITY_SHA256,
      actual: identityFingerprint,
    },
  );

  const connectorsById = new Map();
  const connectorsByProvider = new Map();
  for (const connector of tables.connectors) {
    invariant(
      connector.organization_id === TARGET_ORGANIZATION_ID,
      "Connecteur hors organisation dans le snapshot.",
    );
    invariant(
      !connectorsById.has(connector.id),
      "Identifiant de connecteur dupliqué.",
    );
    invariant(
      !connectorsByProvider.has(connector.provider),
      `Provider de connecteur dupliqué : ${connector.provider}.`,
    );
    connectorsById.set(connector.id, connector);
    connectorsByProvider.set(connector.provider, connector);
  }
  invariant(
    exactProviderSet(connectorsByProvider.keys()),
    "L'ensemble exact des six providers inspectés a changé.",
    { providers: [...connectorsByProvider.keys()].sort() },
  );

  const demoConnector = connectorsByProvider.get("demo");
  invariant(demoConnector, "Le marqueur de démonstration orphelin est absent.");
  invariant(
    demoConnector.type === "crm" &&
      demoConnector.status === "connected" &&
      demoConnector.encrypted_credentials === null &&
      isPlainObject(demoConnector.config) &&
      demoConnector.config.demo === true,
    "Le connecteur demo ne porte pas le marqueur orphelin attendu.",
  );

  const nonDemoConnectors = tables.connectors.filter(
    (connector) => connector.provider !== "demo",
  );
  invariant(
    nonDemoConnectors.length === EXPECTED_CONNECTOR_COUNT - 1,
    "Nombre inattendu de connecteurs hors démonstration.",
  );
  for (const connector of tables.connectors) {
    const expectedHash = EXPECTED_CONNECTOR_BUSINESS_SHA256.get(
      connector.provider,
    );
    invariant(
      expectedHash &&
        sha256(stableStringify(connectorBusinessEvidence(connector))) ===
          expectedHash,
      `La configuration inspectée du connecteur ${connector.provider} a changé.`,
    );
  }
  for (const connector of nonDemoConnectors) {
    invariant(
      connector.status === "disconnected",
      `Le connecteur ${connector.provider} n'est pas déconnecté.`,
    );
    invariant(
      connector.encrypted_credentials === null,
      `Le connecteur ${connector.provider} conserve des credentials.`,
    );
  }

  const sourceProviders = ["google_sheets", "notion"];
  for (const provider of sourceProviders) {
    invariant(
      connectorsByProvider.has(provider),
      `Le connecteur source ${provider} est absent.`,
    );
  }

  const expectedSignatures = multiset(fixtureRows.map(prospectSignature));
  const sourceCounts = {};
  const targetProspectIds = new Set();
  for (const prospect of tables.prospects) {
    invariant(
      prospect.organization_id === TARGET_ORGANIZATION_ID,
      "Prospect hors organisation dans le snapshot.",
    );
    invariant(!targetProspectIds.has(prospect.id), "ID prospect dupliqué.");
    targetProspectIds.add(prospect.id);
    invariant(
      sourceProviders.includes(prospect.source),
      `Source prospect inattendue : ${prospect.source}.`,
    );
    const connector = connectorsById.get(prospect.connector_id);
    invariant(connector, "Prospect rattaché à un connecteur absent.");
    invariant(
      connector.provider === prospect.source,
      `Le prospect ${prospect.id} ne correspond pas à son provider.`,
    );
    invariant(
      prospect.notes === null || prospect.notes === "",
      `Le prospect ${prospect.id} contient une note source non prévue.`,
    );
    invariant(
      prospect.note_internal === null || prospect.note_internal === "",
      `Le prospect ${prospect.id} contient une note interne.`,
    );
    invariant(
      prospect.last_contact_at === null,
      `Le prospect ${prospect.id} contient une date de contact absente du CSV.`,
    );
    sourceCounts[prospect.source] = (sourceCounts[prospect.source] ?? 0) + 1;
  }

  for (const provider of sourceProviders) {
    const rows = tables.prospects.filter(
      (prospect) => prospect.source === provider,
    );
    invariant(
      rows.length === EXPECTED_SOURCE_COUNT,
      `${provider} doit contenir exactement ${EXPECTED_SOURCE_COUNT} prospects.`,
      { provider, count: rows.length },
    );
    invariant(
      stableStringify(multiset(rows.map(prospectSignature))) ===
      stableStringify(expectedSignatures),
      `${provider} n'est pas une copie exacte des quatre colonnes du CSV de référence.`,
    );
    const inspected = EXPECTED_PROSPECT_EVIDENCE.get(provider);
    const externalIds = rows.map((row) => row.external_id).sort();
    const businessRows = rows
      .map(prospectBusinessEvidence)
      .sort((left, right) =>
        left.external_id.localeCompare(right.external_id),
      );
    invariant(
      inspected &&
        sha256(stableStringify(externalIds)) ===
          inspected.external_ids_sha256 &&
        sha256(stableStringify(businessRows)) === inspected.business_sha256,
      `${provider} diffère de l'empreinte complète inspectée (external_id/raw/contenu).`,
    );
    if (provider === "notion") {
      invariant(
        externalIds.every((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          ),
        ),
        "Un external_id Notion n'est pas un UUID.",
      );
    } else {
      invariant(
        rows.every((row) =>
          row.email
            ? row.external_id === row.email.toLowerCase()
            : /^row_\d+$/.test(row.external_id),
        ),
        "Un external_id Google Sheets ne suit pas le format inspecté.",
      );
    }
  }

  invariant(
    tables.value_events.every(
      (event) =>
        event.prospect_id === null ||
        !targetProspectIds.has(event.prospect_id),
    ),
    "Un value_event référence encore un des 48 prospects : suppression refusée.",
  );

  return {
    connector_ids: tables.connectors.map((row) => row.id).sort(),
    connector_providers: tables.connectors
      .map((row) => row.provider)
      .sort(),
    prospect_ids: [...targetProspectIds].sort(),
    memory_row_ids: tables.company_memory.map((row) => row.id).sort(),
    source_counts: sourceCounts,
    memory_sections: memorySections,
    legacy_identity_sha256: identityFingerprint,
    preserved_counts: {
      journal: tables.journal.length,
      research_runs: tables.research_runs.length,
      value_events: tables.value_events.length,
    },
  };
}

async function createBackupAtPath(
  snapshot,
  fixture,
  supabaseOrigin,
  directory,
  backupPath,
) {
  await chmod(directory, 0o700);
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    captured_at: snapshot.captured_at,
    target: {
      organization_id: TARGET_ORGANIZATION_ID,
      organization_name: TARGET_ORGANIZATION_NAME,
    },
    supabase_origin: supabaseOrigin,
    source_fixture: fixture,
    preservation_contract: {
      organization_name: true,
      memberships: true,
      journal: true,
      research_runs: true,
      value_events: true,
      research_daily_usage:
        "préservé mais non lisible directement : privilèges service_role révoqués par 0017",
    },
    preserved_fingerprints: preservedFingerprints(snapshot),
    mutable_rows: {
      organization: snapshot.organization,
      company_memory: snapshot.tables.company_memory,
      connectors: snapshot.tables.connectors,
      prospects: snapshot.tables.prospects,
    },
  };
  const bytes = `${JSON.stringify(payload, null, 2)}\n`;
  const handle = await open(backupPath, "wx", 0o600);
  try {
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  const persisted = await readFile(backupPath);
  invariant(
    sha256(persisted) === sha256(bytes),
    "La relecture de la sauvegarde ne correspond pas aux octets écrits.",
  );
  const parsed = JSON.parse(persisted.toString("utf8"));
  invariant(
    parsed.format === BACKUP_FORMAT &&
      parsed.version === BACKUP_VERSION &&
      stableStringify(parsed.mutable_rows) ===
        stableStringify(payload.mutable_rows) &&
      stableStringify(parsed.preserved_fingerprints) ===
        stableStringify(payload.preserved_fingerprints),
    "La sauvegarde JSON relue n'est pas exploitable.",
  );
  return {
    path: backupPath,
    file: basename(backupPath),
    sha256: sha256(persisted),
  };
}

async function createBackup(snapshot, fixture, supabaseOrigin) {
  const directory = await mkdtemp(
    join(tmpdir(), "nepteo-showcase-v2-"),
  );
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    directory,
    `fathi-solution-before-v2-${timestamp}.json`,
  );
  try {
    return await createBackupAtPath(
      snapshot,
      fixture,
      supabaseOrigin,
      directory,
      backupPath,
    );
  } catch (error) {
    let partialSha256 = null;
    try {
      partialSha256 = sha256(await readFile(backupPath));
    } catch {
      // Le chemin reste utile même si aucun octet exploitable n'a été écrit.
    }
    throw new OperatorSafetyError(
      "Création ou vérification de la sauvegarde échouée. Inspectez le chemin signalé avant toute relance.",
      {
        ...(error instanceof OperatorSafetyError ? error.details : {}),
        backup_path: backupPath,
        ...(partialSha256 ? { backup_sha256: partialSha256 } : {}),
        create_backup_error:
          error instanceof Error ? error.message : String(error),
      },
    );
  }
}

function assertSameSnapshot(before, after, message) {
  invariant(
    stateFingerprint(before) === stateFingerprint(after),
    message,
    {
      before: stateFingerprint(before),
      after: stateFingerprint(after),
    },
  );
}

async function deleteExactIds(admin, table, ids) {
  const deleted = assertNoError(
    await admin
      .from(table)
      .delete()
      .eq("organization_id", TARGET_ORGANIZATION_ID)
      .in("id", ids)
      .select("id"),
    `Suppression ${table}`,
  );
  const actual = (deleted ?? []).map((row) => row.id).sort();
  invariant(
    stableStringify(actual) === stableStringify([...ids].sort()),
    `La suppression ${table} n'a pas retourné exactement les IDs attestés.`,
    { expected: ids.length, deleted: actual.length },
  );
}

async function readOrganization(admin) {
  const rows = assertNoError(
    await admin
      .from("organizations")
      .select("*")
      .eq("id", TARGET_ORGANIZATION_ID)
      .limit(2),
    "Relecture de l'organisation",
  );
  invariant(rows.length === 1, "Organisation absente ou ambiguë.");
  return rows[0];
}

function exactOwnedDemoLock(row, content) {
  if (
    typeof row?.id !== "string" ||
    row.id.length === 0 ||
    row.organization_id !== TARGET_ORGANIZATION_ID ||
    row.section !== DEMO_LOCK_SECTION ||
    stableStringify(row.content) !== stableStringify(content)
  ) {
    return null;
  }
  return {
    id: row.id,
    token: content.token,
    content,
    row,
  };
}

export async function acquireOwnedDemoLock(admin) {
  const token = randomUUID();
  const content = {
    token,
    acquired_at: new Date().toISOString(),
    purpose: "demo",
  };
  let result;
  let insertException = null;
  try {
    result = await admin
      .from("company_memory")
      .insert({
        organization_id: TARGET_ORGANIZATION_ID,
        section: DEMO_LOCK_SECTION,
        content,
        updated_at: content.acquired_at,
      })
      .select("id,organization_id,section,content,updated_at")
      .single();
  } catch (error) {
    insertException = error;
    result = { data: null, error: null };
  }
  result ??= { data: null, error: null };
  const insertError =
    insertException instanceof Error
      ? insertException.message
      : insertException !== null
        ? String(insertException)
        : result.error?.message ??
          (result.data ? "réponse non conforme" : "réponse vide");
  const directLock =
    !result.error && result.data
      ? exactOwnedDemoLock(result.data, content)
      : null;
  if (directLock) return directLock;
  {
    let probe;
    try {
      probe = await admin
        .from("company_memory")
        .select("id,organization_id,section,content,updated_at")
        .eq("organization_id", TARGET_ORGANIZATION_ID)
        .eq("section", DEMO_LOCK_SECTION)
        .contains("content", { token })
        .limit(2);
    } catch (error) {
      throw new OperatorSafetyError(
        "Acquisition du verrou ambiguë : le sondage du token a levé une erreur. Ne supprimez aucune ligne et ne relancez pas automatiquement.",
        {
          lock_token: token,
          acquisition_state: "probe_exception",
          insert_error: insertError,
          probe_error:
            error instanceof Error ? error.message : String(error),
        },
      );
    }

    if (!probe || typeof probe !== "object") {
      throw new OperatorSafetyError(
        "Acquisition du verrou ambiguë : le sondage du token a renvoyé une réponse vide. Ne supprimez aucune ligne et ne relancez pas automatiquement.",
        {
          lock_token: token,
          acquisition_state: "probe_empty",
          insert_error: insertError,
          probe_error: "réponse vide",
        },
      );
    }
    if (probe.error) {
      throw new OperatorSafetyError(
        "Acquisition du verrou ambiguë : le sondage du token a échoué. Ne supprimez aucune ligne et ne relancez pas automatiquement.",
        {
          lock_token: token,
          acquisition_state: "probe_error",
          insert_error: insertError,
          probe_error: probe.error.message,
        },
      );
    }

    const rows = Array.isArray(probe.data) ? probe.data : [];
    if (rows.length === 1) {
      const recoveredLock = exactOwnedDemoLock(rows[0], content);
      if (recoveredLock) return recoveredLock;
    }

    const acquisitionState =
      rows.length === 0
        ? "absent"
        : rows.length > 1
          ? "multiple"
          : "row_mismatch";
    throw new OperatorSafetyError(
      "Acquisition du verrou non prouvée après une réponse d'insert ambiguë. Aucun verrou n'a été repris ou supprimé.",
      {
        lock_token: token,
        acquisition_state: acquisitionState,
        insert_error: insertError,
        probe_count: rows.length,
        ...(rows.length === 1 ? { probed_row: rows[0] } : {}),
      },
    );
  }
}

export function snapshotWithoutOwnedLock(snapshot, lock) {
  const memoryRows = snapshot.tables.company_memory;
  const owned = memoryRows.filter((row) => row.id === lock.id);
  invariant(
    owned.length === 1 &&
      owned[0].organization_id === TARGET_ORGANIZATION_ID &&
      owned[0].section === DEMO_LOCK_SECTION &&
      owned[0].content?.token === lock.token &&
      owned[0].content?.purpose === "demo",
    "Le snapshot sous verrou ne contient pas exactement notre verrou propriétaire.",
  );
  invariant(
    memoryRows.every(
      (row) =>
        row.id === lock.id || scalar(row.section) !== DEMO_LOCK_SECTION,
    ),
    "Un autre verrou de démonstration est visible.",
  );
  return {
    ...snapshot,
    tables: {
      ...snapshot.tables,
      company_memory: memoryRows.filter((row) => row.id !== lock.id),
    },
  };
}

async function releaseOwnedDemoLock(admin, lock) {
  const deleted = await admin
    .from("company_memory")
    .delete()
    .eq("organization_id", TARGET_ORGANIZATION_ID)
    .eq("id", lock.id)
    .eq("section", DEMO_LOCK_SECTION)
    .contains("content", { token: lock.token })
    .select("id");
  if (!deleted.error && (deleted.data ?? []).length === 1) return;

  const probe = await admin
    .from("company_memory")
    .select("id,section,content")
    .eq("organization_id", TARGET_ORGANIZATION_ID)
    .eq("id", lock.id)
    .maybeSingle();
  if (!probe.error && probe.data === null) return;
  throw new OperatorSafetyError(
    "Libération du verrou non prouvée. Ne supprimez aucune autre ligne : utilisez l'ID et le token du rapport d'erreur.",
    {
      lock_id: lock.id,
      lock_token: lock.token,
      delete_error: deleted.error?.message ?? null,
      probe_error: probe.error?.message ?? null,
      lock_still_present:
        probe.data?.content?.token === lock.token &&
        probe.data?.section === DEMO_LOCK_SECTION,
    },
  );
}

async function assertNoDemoLock(admin) {
  const result = await admin
    .from("company_memory")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", TARGET_ORGANIZATION_ID)
    .eq("section", DEMO_LOCK_SECTION);
  assertNoError(result, "Vérification finale du verrou");
  invariant(result.count === 0, "Un verrou de démonstration subsiste.");
}

async function neutralizeLegacyIdentity(admin, before, evidence) {
  const updated = assertNoError(
    await admin
      .from("organizations")
      .update({ activity: null })
      .eq("id", TARGET_ORGANIZATION_ID)
      .eq("name", TARGET_ORGANIZATION_NAME)
      .eq("activity", before.organization.activity)
      .select("*"),
    "Neutralisation de l'activité",
  );
  invariant(
    updated.length === 1 &&
      updated[0].name === TARGET_ORGANIZATION_NAME &&
      updated[0].activity === null,
    "L'activité n'a pas été neutralisée sur l'unique cible attendue.",
  );
  await deleteExactIds(admin, "company_memory", evidence.memory_row_ids);
}

export function assertCleanupPostconditions(before, after) {
  const expectedOrganization = {
    ...before.organization,
    activity: null,
  };
  invariant(
    stableStringify(expectedOrganization) ===
      stableStringify(after.organization),
    "L'organisation ne correspond pas au socle neutre attendu.",
  );
  for (const table of MUST_REMAIN_BYTE_EQUIVALENT) {
    invariant(
      stableStringify(before.tables[table]) ===
        stableStringify(after.tables[table]),
      `${table} a changé pendant le nettoyage.`,
    );
  }
  for (const table of MUST_BE_EMPTY_BEFORE_AND_AFTER) {
    invariant(
      after.tables[table].length === 0,
      `${table} n'est plus vide après le nettoyage.`,
    );
  }
  invariant(
    after.tables.connectors.length === 0,
    "Des connecteurs subsistent après le nettoyage.",
  );
  invariant(
    after.tables.prospects.length === 0,
    "Des prospects subsistent après le nettoyage.",
  );
  invariant(
    after.tables.company_memory.length === 0,
    "Des sections mémoire subsistent après le nettoyage.",
  );
  invariant(
    after.organization.name === TARGET_ORGANIZATION_NAME &&
      after.organization.activity === null,
    "Le nom doit rester Fathi Solution et l'activité devenir neutre.",
  );
  invariant(
    before.schema_version === after.schema_version,
    "La version du schéma a changé pendant l'opération.",
  );
}

export function assertFinalPostconditions(
  before,
  after,
  { operationId, journalId },
) {
  const originalJournalIds = new Set(
    before.tables.journal.map((row) => row.id),
  );
  const added = after.tables.journal.filter(
    (row) => !originalJournalIds.has(row.id),
  );
  invariant(
    added.length === 1 &&
      added[0].id === journalId &&
      added[0].organization_id === TARGET_ORGANIZATION_ID &&
      added[0].event === JOURNAL_EVENT &&
      added[0].payload?.operation_id === operationId,
    "La relecture finale n'a pas retrouvé exactement l'événement opérateur attendu.",
    {
      expected_journal_id: journalId,
      added_journal_ids: added.map((row) => row.id),
    },
  );
  const withoutCompletionEvent = {
    ...after,
    tables: {
      ...after.tables,
      journal: after.tables.journal.filter((row) => row.id !== journalId),
    },
  };
  assertCleanupPostconditions(before, withoutCompletionEvent);
}

function rowsById(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}

function assertCurrentRowsAreUntouchedSubset(currentRows, backupRows, table) {
  const expected = rowsById(backupRows);
  for (const row of currentRows) {
    const original = expected.get(row.id);
    invariant(
      original && stableStringify(original) === stableStringify(row),
      `Rollback ${table} refusé : ligne nouvelle ou modifiée détectée.`,
      { table, id: row.id },
    );
  }
}

async function insertExactRows(admin, table, rows) {
  if (rows.length === 0) return;
  const inserted = assertNoError(
    await admin.from(table).insert(rows).select("id"),
    `Rollback ${table}`,
  );
  invariant(
    stableStringify(inserted.map((row) => row.id).sort()) ===
      stableStringify(rows.map((row) => row.id).sort()),
    `Rollback ${table} incomplet.`,
  );
}

async function rollbackTargets(admin, before, lock) {
  const [currentOrganization, currentMemoryWithLock, currentConnectors, currentProspects] =
    await Promise.all([
      readOrganization(admin),
      fetchAllTable(admin, "company_memory", TABLE_SPECS.company_memory),
      fetchAllTable(admin, "connectors", TABLE_SPECS.connectors),
      fetchAllTable(admin, "prospects", TABLE_SPECS.prospects),
    ]);
  const currentMemory = currentMemoryWithLock.filter((row) => row.id !== lock.id);
  invariant(
    currentMemoryWithLock.length === currentMemory.length + 1 &&
      currentMemoryWithLock.some(
        (row) =>
          row.id === lock.id &&
          row.section === DEMO_LOCK_SECTION &&
          row.content?.token === lock.token,
      ),
    "Rollback refusé : le verrou propriétaire n'est plus intact.",
  );
  const neutralOrganization = { ...before.organization, activity: null };
  invariant(
    stableStringify(currentOrganization) ===
      stableStringify(before.organization) ||
      stableStringify(currentOrganization) ===
        stableStringify(neutralOrganization),
    "Rollback refusé : l'organisation a été modifiée concurremment.",
  );
  assertCurrentRowsAreUntouchedSubset(
    currentMemory,
    before.tables.company_memory,
    "company_memory",
  );
  assertCurrentRowsAreUntouchedSubset(
    currentConnectors,
    before.tables.connectors,
    "connectors",
  );
  assertCurrentRowsAreUntouchedSubset(
    currentProspects,
    before.tables.prospects,
    "prospects",
  );

  const currentConnectorIds = new Set(currentConnectors.map((row) => row.id));
  const currentProspectIds = new Set(currentProspects.map((row) => row.id));
  const currentMemoryIds = new Set(currentMemory.map((row) => row.id));
  if (
    stableStringify(currentOrganization) ===
    stableStringify(neutralOrganization)
  ) {
    const restoredOrganization = assertNoError(
      await admin
        .from("organizations")
        .update({ activity: before.organization.activity })
        .eq("id", TARGET_ORGANIZATION_ID)
        .eq("name", TARGET_ORGANIZATION_NAME)
        .is("activity", null)
        .select("*"),
      "Rollback de l'activité",
    );
    invariant(
      restoredOrganization.length === 1 &&
        stableStringify(restoredOrganization[0]) ===
          stableStringify(before.organization),
      "Rollback de l'activité non prouvé.",
    );
  }
  await insertExactRows(
    admin,
    "company_memory",
    before.tables.company_memory.filter(
      (row) => !currentMemoryIds.has(row.id),
    ),
  );
  await insertExactRows(
    admin,
    "connectors",
    before.tables.connectors.filter(
      (row) => !currentConnectorIds.has(row.id),
    ),
  );
  await insertExactRows(
    admin,
    "prospects",
    before.tables.prospects.filter(
      (row) => !currentProspectIds.has(row.id),
    ),
  );

  const [
    restoredOrganization,
    restoredMemoryWithLock,
    restoredConnectors,
    restoredProspects,
  ] = await Promise.all([
    readOrganization(admin),
    fetchAllTable(admin, "company_memory", TABLE_SPECS.company_memory),
    fetchAllTable(admin, "connectors", TABLE_SPECS.connectors),
    fetchAllTable(admin, "prospects", TABLE_SPECS.prospects),
  ]);
  const restoredMemory = restoredMemoryWithLock.filter(
    (row) => row.id !== lock.id,
  );
  invariant(
    stableStringify(restoredOrganization) ===
      stableStringify(before.organization) &&
      stableStringify(restoredMemory) ===
        stableStringify(before.tables.company_memory) &&
      stableStringify(restoredConnectors) ===
      stableStringify(before.tables.connectors) &&
      stableStringify(restoredProspects) ===
        stableStringify(before.tables.prospects),
    "Le rollback n'a pas restauré exactement les lignes attestées.",
  );
  return {
    restored_memory_sections: restoredMemory.length,
    restored_connectors: restoredConnectors.length,
    restored_prospects: restoredProspects.length,
    restored_activity: true,
  };
}

async function appendCompletionJournal(
  admin,
  operationId,
  evidence,
  fixture,
  backup,
) {
  const payload = {
    operation: JOURNAL_EVENT,
    operation_id: operationId,
    target_organization_id: TARGET_ORGANIZATION_ID,
    deleted_prospects: EXPECTED_PROSPECT_COUNT,
    deleted_connectors: EXPECTED_CONNECTOR_COUNT,
    removed_memory_sections: evidence.memory_sections,
    connector_ids: evidence.connector_ids,
    connector_providers: evidence.connector_providers,
    source_counts: evidence.source_counts,
    source_fixture_sha256: fixture.sha256,
    backup_file: backup.file,
    backup_sha256: backup.sha256,
    organization_name_preserved: true,
    memberships_preserved: true,
    previous_activity_neutralized: true,
    inspected_memory_removed: true,
    legacy_identity_sha256: evidence.legacy_identity_sha256,
    journal_research_value_events_preserved: true,
    next_step: "load_one_certified_demo_v2_from_the_admin_ui",
  };
  const result = await admin
    .from("journal")
    .insert({
      organization_id: TARGET_ORGANIZATION_ID,
      event: JOURNAL_EVENT,
      actor: "agent",
      actor_id: null,
      payload,
    })
    .select("id,organization_id,event,actor,payload,created_at")
    .single();

  if (!result.error && result.data) return result.data;

  const probe = await admin
    .from("journal")
    .select("id,organization_id,event,actor,payload,created_at")
    .eq("organization_id", TARGET_ORGANIZATION_ID)
    .eq("event", JOURNAL_EVENT)
    .contains("payload", { operation_id: operationId })
    .limit(2);
  if (probe.error) {
    throw new OperatorSafetyError(
      "État ambigu après l'écriture du journal : ne pas relancer automatiquement.",
      {
        rollback_safe: false,
        operation_id: operationId,
        insert_error: result.error?.message ?? "réponse vide",
        probe_error: probe.error.message,
      },
    );
  }
  if ((probe.data ?? []).length === 1) return probe.data[0];
  if ((probe.data ?? []).length > 1) {
    throw new OperatorSafetyError(
      "Plusieurs événements de fin portent le même operation_id.",
      { rollback_safe: false, operation_id: operationId },
    );
  }
  throw new OperatorSafetyError(
    `Journal de fin non écrit : ${result.error?.message ?? "réponse vide"}.`,
    { rollback_safe: true, operation_id: operationId },
  );
}

async function executeCleanup(
  admin,
  before,
  evidence,
  fixture,
  backup,
  lock,
  operationId,
) {
  let mutationStarted = false;
  try {
    mutationStarted = true;
    await deleteExactIds(admin, "prospects", evidence.prospect_ids);
    await deleteExactIds(admin, "connectors", evidence.connector_ids);
    await neutralizeLegacyIdentity(admin, before, evidence);

    const afterDeletes = snapshotWithoutOwnedLock(
      await captureSnapshot(admin),
      lock,
    );
    assertCleanupPostconditions(before, afterDeletes);
    const journal = await appendCompletionJournal(
      admin,
      operationId,
      evidence,
      fixture,
      backup,
    );
    try {
      const finalLockedSnapshot = snapshotWithoutOwnedLock(
        await captureSnapshot(admin),
        lock,
      );
      assertFinalPostconditions(before, finalLockedSnapshot, {
        operationId,
        journalId: journal.id,
      });
    } catch (error) {
      throw new OperatorSafetyError(
        "Le nettoyage et son journal ont été écrits, mais leur preuve finale sous verrou a échoué. Ne relancez pas automatiquement.",
        {
          rollback_safe: false,
          cleanup_applied: true,
          operation_id: operationId,
          journal_id: journal.id,
          postcondition_error:
            error instanceof Error ? error.message : String(error),
          postcondition_details: error?.details ?? {},
        },
      );
    }
    return {
      operation_id: operationId,
      deleted_prospects: evidence.prospect_ids.length,
      deleted_connectors: evidence.connector_ids.length,
      journal_id: journal.id,
      organization_name_preserved: true,
      activity_neutralized: true,
      removed_memory_sections: evidence.memory_sections,
    };
  } catch (error) {
    const rollbackSafe = error?.details?.rollback_safe !== false;
    if (!mutationStarted || !rollbackSafe) throw error;
    try {
      const rollback = await rollbackTargets(admin, before, lock);
      throw new OperatorSafetyError(
        `Nettoyage interrompu puis annulé : ${error.message}`,
        {
          rollback: "succeeded",
          rollback_details: rollback,
          operation_id: operationId,
        },
      );
    } catch (rollbackError) {
      if (
        rollbackError instanceof OperatorSafetyError &&
        rollbackError.details?.rollback === "succeeded"
      ) {
        throw rollbackError;
      }
      throw new OperatorSafetyError(
        "Nettoyage interrompu et rollback non prouvé. Utilisez la sauvegarde, sans relancer le script.",
        {
          rollback: "failed_or_ambiguous",
          operation_id: operationId,
          cleanup_error: error.message,
          rollback_error: rollbackError.message,
        },
      );
    }
  }
}

function helpText() {
  return [
    "Prépare Fathi Solution pour le chargement d'un scénario V2.",
    "",
    "Lecture seule par défaut :",
    "  node --env-file-if-exists=.env.local scripts/rebuild-showcase-v2.mjs",
    "",
    "Mutation (double ACK obligatoire) :",
    `  ${WRITE_ACK_ENV}=${WRITE_ACK}`,
    `  node --env-file-if-exists=.env.local scripts/rebuild-showcase-v2.mjs --apply --ack ${WRITE_ACK}`,
    "",
    "Le script ne modifie jamais le nom ni les memberships. Il ne supprime que",
    "48 prospects, 6 connecteurs et les 8 sections de l'ancienne vitrine dont",
    "l'état exact a été attesté. Le nom et les memberships sont préservés ;",
    "l'activité devient null afin que le premier seed V2 sauvegarde un socle neutre.",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(helpText());
    return { status: "help" };
  }
  assertMutationAcknowledged(args, env);

  const url = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const supabaseOrigin = validateSupabaseUrl(url);
  const fixtureBytes = await readFile(fileURLToPath(SOURCE_FIXTURE_URL));
  const fixtureSha = sourceFixtureSha256(fixtureBytes);
  invariant(
    fixtureSha === SOURCE_FIXTURE_SHA256,
    "Le CSV de référence a changé : revue opératoire obligatoire.",
    { expected: SOURCE_FIXTURE_SHA256, actual: fixtureSha },
  );
  const fixtureRows = fixtureRowsFromCsv(fixtureBytes.toString("utf8"));
  const fixture = {
    path: "docs/tests/prospects-test.csv",
    sha256: fixtureSha,
    rows: fixtureRows.length,
  };

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let backup = null;
  try {
    const before = await captureSnapshot(admin);
    const evidence = assertShowcaseSnapshot(before, fixtureRows);

    if (args.mode === "dry-run") {
      const report = {
        status: "dry-run-ok",
        mutation_performed: false,
        target: {
          organization_id: TARGET_ORGANIZATION_ID,
          organization_name: TARGET_ORGANIZATION_NAME,
        },
        schema_version: before.schema_version,
        verified: {
          prospects: evidence.prospect_ids.length,
          connectors: evidence.connector_ids.length,
          providers: evidence.connector_providers,
          source_counts: evidence.source_counts,
          empty_business_tables: MUST_BE_EMPTY_BEFORE_AND_AFTER,
          connector_configuration_fingerprints: "matched",
          prospect_external_id_raw_fingerprints: "matched",
          legacy_identity_sha256: evidence.legacy_identity_sha256,
          memory_sections_to_remove: evidence.memory_sections,
          organization_name_will_be_preserved: true,
          memberships_will_be_preserved: true,
          activity_will_be_set_to_null: true,
          dry_run_local_writes: 0,
        },
        backup_created: false,
      };
      console.log(JSON.stringify(report, null, 2));
      return report;
    }

    const operationId = randomUUID();
    let lock = null;
    let result = null;
    let operationError = null;
    let releaseError = null;
    try {
      lock = await acquireOwnedDemoLock(admin);
      const lockedSnapshot = snapshotWithoutOwnedLock(
        await captureSnapshot(admin),
        lock,
      );
      const lockedEvidence = assertShowcaseSnapshot(
        lockedSnapshot,
        fixtureRows,
      );
      assertSameSnapshot(
        before,
        lockedSnapshot,
        "L'organisation a changé entre le préflight et l'acquisition du verrou.",
      );
      invariant(
        stableStringify(lockedEvidence) === stableStringify(evidence),
        "Les IDs attestés ont changé avant l'écriture.",
      );

      backup = await createBackup(lockedSnapshot, fixture, supabaseOrigin);
      result = await executeCleanup(
        admin,
        lockedSnapshot,
        lockedEvidence,
        fixture,
        backup,
        lock,
        operationId,
      );
    } catch (error) {
      operationError = error;
    } finally {
      if (lock) {
        try {
          await releaseOwnedDemoLock(admin, lock);
        } catch (error) {
          releaseError = error;
        }
      }
    }

    if (operationError && releaseError) {
      throw new OperatorSafetyError(
        "L'opération a échoué et la libération du verrou n'est pas prouvée.",
        {
          operation_error: operationError.message,
          operation_details: operationError.details ?? {},
          release_error: releaseError.message,
          release_details: releaseError.details ?? {},
        },
      );
    }
    if (releaseError) {
      throw new OperatorSafetyError(
        "Le nettoyage est terminé mais la libération du verrou n'est pas prouvée.",
        {
          cleanup_applied: Boolean(result),
          operation_id: operationId,
          release_error: releaseError.message,
          release_details: releaseError.details ?? {},
        },
      );
    }
    if (operationError) throw operationError;
    invariant(result, "Résultat de mutation absent après succès.");
    await assertNoDemoLock(admin);

    const report = {
      status: "applied",
      mutation_performed: true,
      target: {
        organization_id: TARGET_ORGANIZATION_ID,
        organization_name: TARGET_ORGANIZATION_NAME,
      },
      backup,
      ...result,
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } catch (error) {
    if (backup) {
      error.details = {
        ...(error.details ?? {}),
        backup_path: backup.path,
        backup_sha256: backup.sha256,
      };
    }
    throw error;
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          status: "failed",
          error: error.message,
          details: error.details ?? {},
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  });
}
