import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeProspectCohort,
  createSupabaseProspectReader,
  loadProspectCohort,
} from "../lib/prospect-cohort-loader.ts";
import { selectDormantProspects } from "../lib/analysis-rules.ts";

const row = (
  id,
  {
    email = `${id}@example.test`,
    syncedAt = "2026-07-30T12:00:00.000Z",
    stage = "Nouveau",
    lastContactAt = null,
    name = `Contact ${id}`,
    company = "Nepteo",
  } = {},
) => ({
  id,
  name,
  email,
  company,
  stage,
  source: "notion",
  last_contact_at: lastContactAt,
  synced_at: syncedAt,
});

const snapshot = (count, head = count > 0
  ? { id: String(count), synced_at: "2026-07-30T12:00:00.000Z" }
  : null) => ({ ok: true, count, head });

const stableReader = (rows, overrides = {}) => ({
  snapshot: async () =>
    snapshot(
      rows.length,
      rows.length > 0
        ? {
            id: rows[0].id,
            synced_at: rows[0].synced_at,
          }
        : null,
    ),
  page: async (from, to) => ({ ok: true, rows: rows.slice(from, to + 1) }),
  ...overrides,
});

const assertNoRows = (result) => {
  assert.equal("rawRows" in result, false);
  assert.equal("dedupedRows" in result, false);
  assert.equal("canonicalRows" in result, false);
};

test("48 lignes importées donnent 24 fiches et 24 doublons masqués", async () => {
  const rows = Array.from({ length: 24 }, (_, index) => [
    row(`${index.toString().padStart(2, "0")}-b`, {
      email: `contact${index}@example.test`,
    }),
    row(`${index.toString().padStart(2, "0")}-a`, {
      email: ` CONTACT${index}@example.test `,
    }),
  ]).flat();

  const result = await loadProspectCohort(stableReader(rows));

  assert.equal(result.status, "complete");
  assert.equal(result.importedCount, 48);
  assert.equal(result.rawRows.length, 48);
  assert.equal(result.dedupedRows.length, 24);
  assert.equal(result.dedupedCount, 24);
  assert.equal(result.maskedCount, 24);
  assert.equal(result.canonicalRows.length, 24);
  assert.equal(result.canonicalCount, 24);
  assert.equal(result.canonicalMaskedCount, 24);
});

test("un DNC plus ancien gagne sur la ligne active la plus récente", async () => {
  const rows = [
    row("active", {
      email: "contact@example.test",
      stage: "Nouveau",
      syncedAt: "2026-07-30T14:00:00.000Z",
      lastContactAt: "2026-07-20",
    }),
    row("dnc", {
      email: " CONTACT@example.test ",
      stage: "DNC",
      syncedAt: "2026-07-30T13:00:00.000Z",
      lastContactAt: "2026-07-28",
    }),
  ];

  const result = await loadProspectCohort(stableReader(rows));

  assert.equal(result.status, "complete");
  assert.equal(result.dedupedRows[0].stage, "Nouveau");
  assert.equal(result.canonicalRows[0].id, "active");
  assert.equal(result.canonicalRows[0].stage, "DNC");
  assert.equal(result.canonicalRows[0].cohort_conflict, undefined);
  assert.equal(result.canonicalRows[0].last_contact_at, "2026-07-28");
  assert.equal(result.canonicalCount, 1);
  assert.equal(result.canonicalMaskedCount, 1);
});

test("canonicaliser avant le snapshot propage un DNC hors snapshot et bloque la cible", () => {
  const rows = [
    row("active-in-snapshot", {
      email: "contact@example.test",
      stage: "Nouveau",
      syncedAt: "2026-07-30T14:00:00.000Z",
      lastContactAt: "2026-06-01",
    }),
    row("dnc-outside-snapshot", {
      email: "contact@example.test",
      stage: "Ne pas contacter",
      syncedAt: "2026-07-30T13:00:00.000Z",
      lastContactAt: "2026-06-01",
    }),
  ];
  const snapshotIds = new Set(["active-in-snapshot"]);

  const canonical = canonicalizeProspectCohort(rows);
  const strictIntersection = canonical.filter((prospect) =>
    snapshotIds.has(prospect.id),
  );

  assert.equal(strictIntersection.length, 1);
  assert.equal(strictIntersection[0].stage, "Ne pas contacter");
  assert.deepEqual(
    selectDormantProspects(strictIntersection, "2026-07-30", 30),
    [],
  );
});

test("des statuts actifs contradictoires neutralisent la relance", async () => {
  const rows = [
    row("latest", {
      email: "contact@example.test",
      stage: "Nouveau",
      syncedAt: "2026-07-30T14:00:00.000Z",
      lastContactAt: "date invalide",
    }),
    row("conflict", {
      email: "contact@example.test",
      stage: "À relancer",
      syncedAt: "2026-07-30T13:00:00.000Z",
      lastContactAt: "2026-07-28",
    }),
    row("same-active", {
      email: "contact@example.test",
      stage: " nouveau ",
      syncedAt: "2026-07-30T12:00:00.000Z",
      lastContactAt: "2026-07-29",
    }),
  ];

  const result = await loadProspectCohort(stableReader(rows));

  assert.equal(result.status, "complete");
  assert.equal(result.canonicalRows[0].stage, null);
  assert.equal(
    result.canonicalRows[0].cohort_conflict,
    "active_stage_conflict",
  );
  assert.equal(result.canonicalRows[0].last_contact_at, "2026-07-29");
  assert.equal(result.canonicalCount, 1);
  assert.equal(result.canonicalMaskedCount, 2);
});

test("les homonymes sans email fusionnent visuellement mais restent distincts en métier", async () => {
  const rows = [
    row("recent", {
      email: " ",
      name: "Alice Martin",
      company: "Nepteo",
      syncedAt: "2026-07-30T14:00:00.000Z",
    }),
    row("older", {
      email: null,
      name: " alice  martin ",
      company: " NEPTEO ",
      syncedAt: "2026-07-30T13:00:00.000Z",
    }),
  ];

  const result = await loadProspectCohort(stableReader(rows));

  assert.equal(result.status, "complete");
  assert.equal(result.rawRows.length, 2);
  assert.equal(result.dedupedCount, 1);
  assert.equal(result.maskedCount, 1);
  assert.equal(result.canonicalCount, 2);
  assert.equal(result.canonicalMaskedCount, 0);
  assert.deepEqual(
    result.canonicalRows.map(({ id }) => id),
    ["recent", "older"],
  );
  assert.equal(result.canonicalRows[0].email.trim(), "");
  assert.equal(result.canonicalRows[1].email, null);
});

test("5 001 lignes suspendent la lecture sans lancer de page", async () => {
  let pageCalls = 0;
  const result = await loadProspectCohort({
    snapshot: async () => snapshot(5_001),
    page: async () => {
      pageCalls += 1;
      return { ok: true, rows: [] };
    },
  });

  assert.deepEqual(result, {
    status: "partial",
    reason: "limit_exceeded",
    importedCount: 5_001,
    maxRows: 5_000,
  });
  assert.equal(pageCalls, 0);
  assertNoRows(result);
});

test("une erreur du snapshot initial devient count_failed", async () => {
  const result = await loadProspectCohort({
    snapshot: async () => ({ ok: false }),
    page: async () => {
      throw new Error("page ne doit pas être lue");
    },
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "count_failed",
    importedCount: null,
  });
  assertNoRows(result);
});

test("une erreur de page devient page_failed sans exposer de lignes", async () => {
  const result = await loadProspectCohort({
    snapshot: async () =>
      snapshot(1, {
        id: "1",
        synced_at: "2026-07-30T12:00:00.000Z",
      }),
    page: async () => ({ ok: false }),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "page_failed",
    importedCount: 1,
  });
  assertNoRows(result);
});

test("une erreur du snapshot final devient verification_failed", async () => {
  let calls = 0;
  const onlyRow = row("1");
  const result = await loadProspectCohort({
    snapshot: async () => {
      calls += 1;
      return calls === 1
        ? snapshot(1, {
            id: onlyRow.id,
            synced_at: onlyRow.synced_at,
          })
        : { ok: false };
    },
    page: async () => ({ ok: true, rows: [onlyRow] }),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "verification_failed",
    importedCount: 1,
  });
  assertNoRows(result);
});

test("une page courte deux fois devient concurrent_change", async () => {
  const first = row("2");
  const result = await loadProspectCohort({
    snapshot: async () =>
      snapshot(2, { id: first.id, synced_at: first.synced_at }),
    page: async () => ({ ok: true, rows: [first] }),
  });

  assert.deepEqual(result, {
    status: "unavailable",
    reason: "concurrent_change",
    importedCount: 2,
  });
  assertNoRows(result);
});

test("des identifiants répétés deux fois deviennent concurrent_change", async () => {
  const duplicate = row("2");
  const result = await loadProspectCohort({
    snapshot: async () =>
      snapshot(2, { id: duplicate.id, synced_at: duplicate.synced_at }),
    page: async () => ({ ok: true, rows: [duplicate, duplicate] }),
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "concurrent_change");
  assertNoRows(result);
});

test("une tête modifiée déclenche un retry puis accepte le passage stable", async () => {
  const oldRows = [row("old")];
  const newRows = [
    row("new", { syncedAt: "2026-07-30T13:00:00.000Z" }),
  ];
  const snapshots = [
    snapshot(1, {
      id: oldRows[0].id,
      synced_at: oldRows[0].synced_at,
    }),
    snapshot(1, {
      id: newRows[0].id,
      synced_at: newRows[0].synced_at,
    }),
    snapshot(1, {
      id: newRows[0].id,
      synced_at: newRows[0].synced_at,
    }),
    snapshot(1, {
      id: newRows[0].id,
      synced_at: newRows[0].synced_at,
    }),
  ];
  let snapshotCalls = 0;
  let pageCalls = 0;

  const result = await loadProspectCohort({
    snapshot: async () => snapshots[snapshotCalls++],
    page: async () => {
      pageCalls += 1;
      return { ok: true, rows: pageCalls === 1 ? oldRows : newRows };
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.rawRows[0].id, "new");
  assert.equal(snapshotCalls, 4);
  assert.equal(pageCalls, 2);
});

test("la résolution inverse des pages conserve l'ordre synced_at/id décroissant", async () => {
  const rows = [
    row("c", { email: "same@example.test", syncedAt: "2026-07-30T14:00:00.000Z" }),
    row("b", { email: "same@example.test", syncedAt: "2026-07-30T13:00:00.000Z" }),
    row("a", { syncedAt: "2026-07-30T12:00:00.000Z" }),
  ];

  const result = await loadProspectCohort(
    {
      snapshot: async () =>
        snapshot(3, { id: rows[0].id, synced_at: rows[0].synced_at }),
      page: async (from, to) => {
        await new Promise((resolve) => setTimeout(resolve, (3 - from) * 3));
        return { ok: true, rows: rows.slice(from, to + 1) };
      },
    },
    { pageSize: 1 },
  );

  assert.equal(result.status, "complete");
  assert.deepEqual(result.rawRows.map(({ id }) => id), ["c", "b", "a"]);
  assert.equal(result.dedupedRows[0].id, "c");
});

test("la concurrence des pages reste bornée à cinq", async () => {
  const rows = Array.from({ length: 1_000 }, (_, index) =>
    row(index.toString().padStart(4, "0")),
  ).reverse();
  let active = 0;
  let peak = 0;

  const result = await loadProspectCohort(
    stableReader(rows, {
      page: async (from, to) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return { ok: true, rows: rows.slice(from, to + 1) };
      },
    }),
    { pageSize: 100 },
  );

  assert.equal(result.status, "complete");
  assert.equal(peak, 5);
});

test("la borne exacte de 5 000 lit cinq pages complètes", async () => {
  const rows = Array.from({ length: 5_000 }, (_, index) =>
    row(index.toString().padStart(4, "0")),
  ).reverse();
  let pageCalls = 0;
  const result = await loadProspectCohort(
    stableReader(rows, {
      page: async (from, to) => {
        pageCalls += 1;
        return { ok: true, rows: rows.slice(from, to + 1) };
      },
    }),
  );

  assert.equal(result.status, "complete");
  assert.equal(result.importedCount, 5_000);
  assert.equal(result.rawRows.length, 5_000);
  assert.equal(pageCalls, 5);
});

test("l'adaptateur Supabase applique filtres, ordre total et plages inclusives", async () => {
  const calls = [];
  const makeQuery = () => {
    const query = {
      kind: "",
      select(columns, options) {
        this.kind = options?.count === "exact" ? "snapshot" : "page";
        calls.push(["select", columns, options ?? null]);
        return this;
      },
      eq(column, value) {
        calls.push(["eq", column, value]);
        return this;
      },
      neq(column, value) {
        calls.push(["neq", column, value]);
        return this;
      },
      order(column, options) {
        calls.push(["order", column, options]);
        return this;
      },
      limit(value) {
        calls.push(["limit", value]);
        return this;
      },
      range(from, to) {
        calls.push(["range", from, to]);
        return this;
      },
      then(resolve) {
        resolve(
          this.kind === "snapshot"
            ? {
                data: [
                  {
                    id: "head",
                    synced_at: "2026-07-30T12:00:00.000Z",
                  },
                ],
                count: 1,
                error: null,
              }
            : { data: [row("head")], error: null },
        );
      },
    };
    return query;
  };
  const client = {
    from(table) {
      calls.push(["from", table]);
      return makeQuery();
    },
  };
  const reader = createSupabaseProspectReader(client, {
    organizationId: "org-1",
    source: "notion",
    excludeSource: "demo",
  });

  assert.equal((await reader.snapshot()).ok, true);
  assert.equal((await reader.page(1_000, 1_999)).ok, true);
  assert.equal(
    calls.filter(([name, column]) => name === "order" && column === "synced_at")
      .length,
    2,
  );
  assert.equal(
    calls.filter(([name, column]) => name === "order" && column === "id").length,
    2,
  );
  assert.deepEqual(
    calls.filter(([name]) => ["eq", "neq"].includes(name)),
    [
      ["eq", "organization_id", "org-1"],
      ["eq", "source", "notion"],
      ["neq", "source", "demo"],
      ["eq", "organization_id", "org-1"],
      ["eq", "source", "notion"],
      ["neq", "source", "demo"],
    ],
  );
  assert.ok(
    calls.some(
      ([name, from, to]) =>
        name === "range" && from === 1_000 && to === 1_999,
    ),
  );
});
