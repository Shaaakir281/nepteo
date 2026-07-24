/**
 * Tests du plan de campagne (Phase 4) — pur, déterministe.
 * Runner : node:test. Node ≥ 22. Aucun LLM, aucune I/O. Ne lance rien.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCampaignPlan,
  objectiveLabel,
  channelLabel,
  CAMPAIGN_DURATION_DAYS,
} from "../lib/campaign-plan.ts";

const brief = (over = {}) => ({
  objectif: "clients",
  canal: "meta",
  budgetJour: 10,
  contexte: "",
  ...over,
});

test("buildCampaignPlan — budget total = budget/jour × durée, plafond = budget/jour", () => {
  const p = buildCampaignPlan(brief());
  assert.equal(p.budgetTotal, 10 * CAMPAIGN_DURATION_DAYS);
  assert.equal(p.capJour, 10);
  assert.equal(p.dureeJours, CAMPAIGN_DURATION_DAYS);
});

test("buildCampaignPlan — sans données réelles : coût/contact par défaut, confiance basse", () => {
  const p = buildCampaignPlan(brief({ canal: "meta" }));
  assert.equal(p.coutContact, 35); // défaut meta
  assert.equal(p.confiance, 0.6);
  assert.ok(p.contactsMin >= 1 && p.contactsMax >= p.contactsMin);
  assert.ok(p.arretContact >= 60);
});

test("buildCampaignPlan — calibré sur le réel : coût/contact réel + confiance relevée", () => {
  const p = buildCampaignPlan(brief(), { avgCostPerContact: 38 });
  assert.equal(p.coutContact, 38);
  assert.equal(p.confiance, 0.76);
});

test("buildCampaignPlan — avg invalide (0 ou null) → repli sur le défaut", () => {
  assert.equal(buildCampaignPlan(brief(), { avgCostPerContact: 0 }).coutContact, 35);
  assert.equal(buildCampaignPlan(brief(), { avgCostPerContact: null }).confiance, 0.6);
});

test("libellés objectif/canal", () => {
  assert.equal(objectiveLabel("relance"), "Relancer des prospects");
  assert.equal(channelLabel("meta"), "Meta");
  assert.equal(channelLabel("inconnu"), "inconnu"); // repli sur la valeur
});
