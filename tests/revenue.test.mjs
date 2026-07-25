/**
 * Tests de la boucle revenu (Phase 4) — pur, déterministe.
 * Runner : node:test. Node ≥ 22. Aucune I/O.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { revenueStats, overallRoas } from "../lib/revenue/revenue-rules.ts";

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
