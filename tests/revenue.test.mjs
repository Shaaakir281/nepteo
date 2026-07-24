/**
 * Tests de la boucle revenu (Phase 4) — pur, déterministe.
 * Runner : node:test. Node ≥ 22. Aucune I/O.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { revenueStats, overallRoas } from "../lib/revenue/revenue-rules.ts";
import { mockRevenueEvents } from "../lib/revenue/mock-provider.ts";

test("revenueStats — total, nombre et panier moyen", () => {
  const s = revenueStats([
    { amount: 100, occurred_on: "2026-07-01" },
    { amount: 50, occurred_on: "2026-07-02" },
    { amount: 150, occurred_on: "2026-07-03" },
  ]);
  assert.equal(s.total, 300);
  assert.equal(s.count, 3);
  assert.equal(s.avg, 100);
});

test("revenueStats — base vide → zéros, pas de NaN", () => {
  const s = revenueStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.count, 0);
  assert.equal(s.avg, 0);
});

test("overallRoas — revenu / dépense, 0 si pas de dépense", () => {
  assert.equal(overallRoas(400, 100), 4);
  assert.equal(overallRoas(400, 0), 0);
});

test("mockRevenueEvents — ventes déterministes et cohérentes", () => {
  const a = mockRevenueEvents();
  const b = mockRevenueEvents();
  assert.deepEqual(a, b); // reproductible
  assert.ok(a.length > 0);
  const s = revenueStats(a);
  assert.ok(s.total > 0 && s.avg > 0);
  for (const e of a) {
    assert.ok(e.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.occurred_on));
    assert.equal(e.source, "stripe");
  }
});
