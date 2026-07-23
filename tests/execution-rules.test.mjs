/**
 * Tests des règles d'exécution (Phase 3) — garde-fous purs.
 * Runner : node:test. Node ≥ 22. Aucune I/O, aucun envoi.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  guardExecution,
  planRecipients,
  dedupeByEmail,
  dedupeContacts,
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

test("dedupeByEmail — une seule fois par email (casse/espaces ignorées)", () => {
  const rows = [
    { id: "1", email: "julie@x.fr", name: "Julie (Sheets)" },
    { id: "2", email: " JULIE@x.fr ", name: "Julie (Notion)" },
    { id: "3", email: "sarah@x.fr", name: "Sarah" },
  ];
  const out = dedupeByEmail(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "Julie (Sheets)"); // 1re occurrence gardée
});

test("dedupeByEmail — garde les lignes sans email", () => {
  const rows = [
    { id: "1", email: null, name: "A" },
    { id: "2", email: "", name: "B" },
    { id: "3", email: "a@x.fr", name: "C" },
    { id: "4", email: "a@x.fr", name: "D" },
  ];
  const out = dedupeByEmail(rows);
  assert.equal(out.length, 3); // 2 sans email + 1 dédupliqué
});

test("dedupeContacts — secours nom+entreprise pour les fiches sans email", () => {
  const rows = [
    { id: "1", email: "a@x.fr", name: "Jean Martin", company: "ACME" },
    { id: "2", email: "a@x.fr", name: "Jean Martin", company: "ACME" }, // même email
    { id: "3", email: null, name: "Zoé Blanc", company: "Studio Z" },
    { id: "4", email: "", name: " zoé  blanc ", company: "studio z" }, // même nom+société
    { id: "5", email: null, name: "Zoé Blanc", company: "Autre SARL" }, // société différente
    { id: "6", email: null, name: null, company: null }, // non dédupliquable
  ];
  const out = dedupeContacts(rows);
  // 1 (email a@x.fr), 3 (Zoé/Studio Z ← 4 fusionné), 5 (Zoé/Autre), 6 (gardée)
  assert.equal(out.length, 4);
});
