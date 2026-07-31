import assert from "node:assert/strict";
import test from "node:test";
import {
  DemoBusyError,
  withDemoMutationLock,
} from "../lib/demo/lock.ts";
import { DEMO_LOCK_SECTION } from "../lib/demo/isolation-rules.ts";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

function matchesFilters(row, filters) {
  if (!row) return false;
  return filters.every(([operator, column, value]) => {
    if (operator === "eq") return row[column] === value;
    if (operator !== "contains") return false;
    const actual = row[column];
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      return false;
    }
    return Object.entries(value).every(
      ([key, expected]) => actual[key] === expected,
    );
  });
}

function createLockAdmin({
  insertMode = "ok",
  deleteMode = "ok",
  probeMode = "state",
} = {}) {
  let row = null;
  let insertedRow = null;
  let insertCalls = 0;
  let deleteCalls = 0;
  const deleteFilters = [];
  const probeFilters = [];

  const admin = {
    from(table) {
      assert.equal(table, "company_memory");
      return {
        insert(value) {
          insertCalls += 1;
          insertedRow = value;
          return {
            select(columns) {
              assert.equal(columns, "id");
              return {
                async maybeSingle() {
                  if (
                    insertMode === "ok" ||
                    insertMode === "committed_error" ||
                    insertMode === "throw_after_commit"
                  ) {
                    row = { id: "lock-owned", ...value };
                  }
                  if (insertMode === "ok") {
                    return { data: { id: row.id }, error: null };
                  }
                  if (insertMode === "conflict") {
                    return {
                      data: null,
                      error: {
                        code: "23505",
                        message: "duplicate key value violates unique constraint",
                      },
                    };
                  }
                  if (insertMode === "throw_after_commit") {
                    throw new Error("connexion perdue après commit");
                  }
                  return {
                    data: null,
                    error: {
                      code: "FETCH_ERROR",
                      message: "réponse d'insert perdue",
                    },
                  };
                },
              };
            },
          };
        },
        delete() {
          deleteCalls += 1;
          const filters = [];
          deleteFilters.push(filters);
          const builder = {
            eq(column, value) {
              filters.push(["eq", column, value]);
              return builder;
            },
            contains(column, value) {
              filters.push(["contains", column, value]);
              return builder;
            },
            async select(columns) {
              assert.equal(columns, "id");
              const matched = matchesFilters(row, filters);
              const deletedId = matched ? row.id : null;
              if (
                matched &&
                (deleteMode === "ok" ||
                  deleteMode === "committed_error" ||
                  deleteMode === "throw_after_commit")
              ) {
                row = null;
              }
              if (deleteMode === "ok") {
                return {
                  data: deletedId ? [{ id: deletedId }] : [],
                  error: null,
                };
              }
              if (deleteMode === "throw_after_commit") {
                throw new Error("connexion perdue après suppression");
              }
              return {
                data: null,
                error: {
                  code: "FETCH_ERROR",
                  message: "réponse de suppression perdue",
                },
              };
            },
          };
          return builder;
        },
        select(columns) {
          assert.equal(columns, "id");
          const filters = [];
          const builder = {
            eq(column, value) {
              filters.push(["eq", column, value]);
              return builder;
            },
            contains(column, value) {
              filters.push(["contains", column, value]);
              return builder;
            },
            async limit(value) {
              assert.equal(value, 2);
              probeFilters.push([...filters]);
              if (probeMode === "throw") {
                throw new Error("sondage réseau impossible");
              }
              if (probeMode === "error") {
                return {
                  data: null,
                  error: {
                    code: "FETCH_ERROR",
                    message: "réponse du sondage perdue",
                  },
                };
              }
              return {
                data: matchesFilters(row, filters) ? [{ id: row.id }] : [],
                error: null,
              };
            },
          };
          return builder;
        },
      };
    },
  };

  return {
    admin,
    get row() {
      return row;
    },
    get insertedRow() {
      return insertedRow;
    },
    get insertCalls() {
      return insertCalls;
    },
    get deleteCalls() {
      return deleteCalls;
    },
    deleteFilters,
    probeFilters,
  };
}

test("verrou distribué — reprend uniquement son token après un insert commité dont la réponse est perdue", async () => {
  const mock = createLockAdmin({
    insertMode: "committed_error",
    deleteMode: "ok",
  });
  let taskCalls = 0;

  const result = await withDemoMutationLock(
    mock.admin,
    ORG_ID,
    "data",
    async () => {
      taskCalls += 1;
      return "done";
    },
  );

  assert.equal(result, "done");
  assert.equal(taskCalls, 1);
  assert.equal(mock.insertCalls, 1);
  assert.equal(mock.deleteCalls, 1);
  assert.equal(mock.row, null);
  assert.deepEqual(mock.probeFilters, [
    [
      ["eq", "organization_id", ORG_ID],
      ["eq", "section", DEMO_LOCK_SECTION],
      ["contains", "content", { token: mock.insertedRow.content.token }],
    ],
  ]);
});

test("verrou distribué — réconcilie aussi les exceptions réseau levées après commit", async () => {
  const mock = createLockAdmin({
    insertMode: "throw_after_commit",
    deleteMode: "throw_after_commit",
  });

  const result = await withDemoMutationLock(
    mock.admin,
    ORG_ID,
    "analysis",
    async () => "done",
  );

  assert.equal(result, "done");
  assert.equal(mock.row, null);
  assert.equal(mock.probeFilters.length, 2);
});

test("verrou distribué — refuse d'exécuter si l'insert ambigu ne peut pas être prouvé", async () => {
  const mock = createLockAdmin({ insertMode: "absent_error" });
  let taskCalls = 0;

  await assert.rejects(
    withDemoMutationLock(mock.admin, ORG_ID, "data", async () => {
      taskCalls += 1;
    }),
    /Acquisition du verrou non prouvée/,
  );

  assert.equal(taskCalls, 0);
  assert.equal(mock.insertCalls, 1);
  assert.equal(mock.deleteCalls, 0);
  assert.equal(mock.probeFilters.length, 1);
});

test("verrou distribué — une collision 23505 reste un état occupé sans reprise", async () => {
  const mock = createLockAdmin({ insertMode: "conflict" });
  let taskCalls = 0;

  await assert.rejects(
    withDemoMutationLock(mock.admin, ORG_ID, "data", async () => {
      taskCalls += 1;
    }),
    (error) => error instanceof DemoBusyError,
  );

  assert.equal(taskCalls, 0);
  assert.equal(mock.probeFilters.length, 0);
  assert.equal(mock.deleteCalls, 0);
});

test("verrou distribué — accepte une suppression ambiguë seulement après absence exacte prouvée", async () => {
  const mock = createLockAdmin({
    insertMode: "ok",
    deleteMode: "committed_error",
  });

  const result = await withDemoMutationLock(
    mock.admin,
    ORG_ID,
    "analysis",
    async () => 42,
  );

  assert.equal(result, 42);
  assert.equal(mock.row, null);
  assert.deepEqual(mock.deleteFilters, [
    [
      ["eq", "organization_id", ORG_ID],
      ["eq", "section", DEMO_LOCK_SECTION],
      ["eq", "id", "lock-owned"],
      ["contains", "content", { token: mock.insertedRow.content.token }],
    ],
  ]);
  assert.deepEqual(mock.probeFilters, [
    [
      ["eq", "organization_id", ORG_ID],
      ["eq", "section", DEMO_LOCK_SECTION],
      ["contains", "content", { token: mock.insertedRow.content.token }],
      ["eq", "id", "lock-owned"],
    ],
  ]);
});

test("verrou distribué — échoue fermé si notre ligne subsiste après un delete ambigu", async () => {
  const mock = createLockAdmin({
    insertMode: "ok",
    deleteMode: "retained_error",
  });
  let taskCalls = 0;

  await assert.rejects(
    withDemoMutationLock(mock.admin, ORG_ID, "demo", async () => {
      taskCalls += 1;
      return "applied";
    }),
    /notre ligne exacte est encore présente/,
  );

  assert.equal(taskCalls, 1);
  assert.equal(mock.row.id, "lock-owned");
  assert.equal(mock.probeFilters.length, 1);
});

test("verrou distribué — un sondage de libération lui-même ambigu reste bloquant", async () => {
  const mock = createLockAdmin({
    insertMode: "ok",
    deleteMode: "retained_error",
    probeMode: "error",
  });

  await assert.rejects(
    withDemoMutationLock(mock.admin, ORG_ID, "campaign", async () => "done"),
    /impossible de prouver l'absence/,
  );

  assert.equal(mock.row.id, "lock-owned");
});

test("verrou distribué — une libération ambiguë ne masque jamais l'erreur métier initiale", async (t) => {
  const mock = createLockAdmin({
    insertMode: "ok",
    deleteMode: "retained_error",
  });
  const taskError = new Error("échec métier");
  const logged = [];
  t.mock.method(console, "error", (...args) => logged.push(args));

  await assert.rejects(
    withDemoMutationLock(mock.admin, ORG_ID, "data", async () => {
      throw taskError;
    }),
    (error) => error === taskError,
  );

  assert.equal(mock.row.id, "lock-owned");
  assert.equal(logged.length, 1);
});
