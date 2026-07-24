/**
 * Tests du plan marketing du mois (Phase 4) — pur, déterministe.
 * Runner : node:test. Node ≥ 22. Aucun LLM, aucune I/O. Ne crée aucune action.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketingPlan } from "../lib/plan.ts";

const sig = (over = {}) => ({
  offre: "Pack Découverte",
  priorityCount: 15,
  noEmailCount: 5,
  losingCampaigns: ["Notoriété Reels"],
  bestCampaign: { name: "Retargeting", roas: 4.5 },
  ...over,
});

test("buildMarketingPlan — mouvements priorisés : couper, relancer, renforcer, acquérir, contenu", () => {
  const p = buildMarketingPlan(sig());
  const titles = p.moves.map((m) => m.title.toLowerCase());
  assert.ok(titles[0].includes("couper")); // pertes d'abord
  assert.ok(p.moves.some((m) => /relancer les 15/i.test(m.title)));
  assert.ok(p.moves.some((m) => /renforcer/i.test(m.title)));
  assert.ok(p.moves.some((m) => /acquisition/i.test(m.title)));
  assert.ok(p.moves.some((m) => m.channel === "Contenu"));
  assert.ok(p.moves.length <= 5); // borné
  assert.ok(p.budgetIndicatif > 0); // offre → campagne acquisition
});

test("buildMarketingPlan — chaque mouvement pointe vers un écran", () => {
  const p = buildMarketingPlan(sig());
  for (const m of p.moves) {
    assert.ok(["/", "/campagnes", "/contenu"].includes(m.ctaHref));
    assert.ok(m.ctaLabel.length > 0 && m.impact.length > 0);
  }
});

test("buildMarketingPlan — sans signaux : au moins le contenu, intro neutre", () => {
  const p = buildMarketingPlan({
    offre: "",
    priorityCount: 0,
    noEmailCount: 0,
    losingCampaigns: [],
    bestCampaign: null,
  });
  assert.ok(p.moves.length >= 1);
  assert.ok(p.moves.some((m) => m.channel === "Contenu"));
  assert.equal(p.budgetIndicatif, 0);
  assert.ok(!/priorité/i.test(p.intro)); // intro neutre
});

test("buildMarketingPlan — meilleure campagne peu rentable → pas de 'renforcer'", () => {
  const p = buildMarketingPlan(sig({ bestCampaign: { name: "X", roas: 1.2 } }));
  assert.ok(!p.moves.some((m) => /renforcer/i.test(m.title)));
});
