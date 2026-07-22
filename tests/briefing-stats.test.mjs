/**
 * Tests du briefing (Phase 2) — parties pures : stats de funnel + repli.
 * Runner : node:test. Node ≥ 22. Aucun LLM, aucune I/O.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeFunnelStats } from "../lib/analysis-rules.ts";
import { templateBriefing } from "../lib/briefing-stats.ts";

const p = (email, stage, company) => ({ email, stage, company });

test("computeFunnelStats — compte prioritaires, sans email, sans statut, top statut", () => {
  const stats = computeFunnelStats([
    p("a@x.fr", "Nouveau", "ACME"), // prioritaire
    p("b@x.fr", "Nouveau", null), // prioritaire (entreprise vide OK)
    p("c@x.fr", "Client", "Z"), // terminal → pas prioritaire
    p(null, "Nouveau", "Y"), // injoignable → pas prioritaire, noEmail
    p("d@x.fr", "", "W"), // sans statut
  ]);
  assert.equal(stats.total, 5);
  assert.equal(stats.priority, 2);
  assert.equal(stats.noEmail, 1);
  assert.equal(stats.noStage, 1);
  assert.deepEqual(stats.topStage, { stage: "Nouveau", count: 3 });
});

test("computeFunnelStats — base vide", () => {
  const stats = computeFunnelStats([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.priority, 0);
  assert.equal(stats.topStage, null);
});

test("templateBriefing — base vide invite à connecter une source", () => {
  const txt = templateBriefing(computeFunnelStats([]));
  assert.ok(/connect/i.test(txt));
});

test("templateBriefing — cite total, prioritaires et top statut, sans invention", () => {
  const stats = computeFunnelStats([
    p("a@x.fr", "Nouveau", "ACME"),
    p("b@x.fr", "Nouveau", "B"),
    p(null, "Relancé", "C"),
  ]);
  const txt = templateBriefing(stats);
  assert.ok(txt.includes("3 prospect"));
  assert.ok(txt.includes("Nouveau"));
  assert.ok(!txt.includes("undefined"));
  assert.ok(!txt.includes("NaN"));
});
