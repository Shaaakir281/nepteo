/**
 * Tests des règles d'exécution (Phase 3) — garde-fous purs.
 * Runner : node:test. Node ≥ 22. Aucune I/O, aucun envoi.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  guardExecution,
  planRecipients,
  MAX_PER_RUN,
  MAX_PER_DAY,
} from "../lib/execution-rules.ts";

test("guardExecution — n'exécute qu'une action validée", () => {
  assert.deepEqual(guardExecution({ status: "approved", paused: false }), {
    ok: true,
  });
  assert.equal(
    guardExecution({ status: "proposed", paused: false }).ok,
    false,
  );
  assert.equal(
    guardExecution({ status: "proposed", paused: false }).reason,
    "not_approved",
  );
});

test("guardExecution — la pause (bouton d'arrêt) prime sur tout", () => {
  const r = guardExecution({ status: "approved", paused: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "blocked_paused");
});

test("guardExecution — idempotence : une action déjà exécutée est refusée", () => {
  const r = guardExecution({ status: "executed", paused: false });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "already_executed");
});

const mk = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    email: `p${i}@x.fr`,
    name: `N${i}`,
  }));

test("planRecipients — écarte les fiches sans email", () => {
  const rows = [
    { id: "a", email: "a@x.fr", name: "A" },
    { id: "b", email: "", name: "B" },
    { id: "c", email: null, name: "C" },
  ];
  const r = planRecipients(rows, { sentToday: 0 });
  assert.equal(r.recipients.length, 1);
  assert.equal(r.skippedNoEmail, 2);
});

test("planRecipients — borne au plafond par exécution", () => {
  const r = planRecipients(mk(MAX_PER_RUN + 10), { sentToday: 0 });
  assert.equal(r.recipients.length, MAX_PER_RUN);
  assert.equal(r.capped, true);
});

test("planRecipients — borne au reste du budget quotidien", () => {
  const r = planRecipients(mk(20), { sentToday: MAX_PER_DAY - 5 });
  assert.equal(r.recipients.length, 5);
  assert.equal(r.capped, true);
});

test("planRecipients — budget quotidien épuisé → aucun envoi", () => {
  const r = planRecipients(mk(10), { sentToday: MAX_PER_DAY });
  assert.equal(r.recipients.length, 0);
  assert.equal(r.capped, true);
});

test("planRecipients — sous les plafonds, tout passe", () => {
  const r = planRecipients(mk(3), { sentToday: 0 });
  assert.equal(r.recipients.length, 3);
  assert.equal(r.capped, false);
});
