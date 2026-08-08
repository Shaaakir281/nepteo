/** Contrats purs CAMP-0 — aucune I/O, aucun LLM, aucun lancement. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_BUDGET_LIMITS,
  buildCampaignPlan,
  channelLabel,
  objectiveLabel,
  validateCampaignBrief,
  validateCampaignVariants,
} from "../lib/campaign-plan.ts";

const validBrief = (overrides = {}) => ({
  objective: "new_customers",
  campaignType: "acquisition",
  audience: "Dirigeants de PME industrielles en France",
  offer: "Audit de positionnement",
  hypothesis: "Une preuve client concrète augmentera les demandes",
  channel: "meta",
  dailyBudget: 20,
  durationDays: 14,
  primaryMetric: "appointments",
  successThreshold: 8,
  context: "Ton direct et professionnel",
  ...overrides,
});

test("brief CAMP-0 — chaque champ engageant est obligatoire", () => {
  const result = validateCampaignBrief({});
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    "audience",
    "campaignType",
    "channel",
    "dailyBudget",
    "durationDays",
    "hypothesis",
    "objective",
    "offer",
    "primaryMetric",
    "successThreshold",
  ]);
  assert.equal(result.errors.context, undefined, "le contexte reste facultatif");
});

test("brief CAMP-0 — listes fermées et durée 7/14/30 seulement", () => {
  const result = validateCampaignBrief(
    validBrief({ objective: "inventé", campaignType: "continu", channel: "tiktok", durationDays: 365 }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.objective);
  assert.ok(result.errors.campaignType);
  assert.ok(result.errors.channel);
  assert.ok(result.errors.durationDays);
});

test("brief CAMP-0 — bornes budget, seuil et textes appliquées", () => {
  for (const dailyBudget of [CAMPAIGN_BUDGET_LIMITS.min - 0.01, CAMPAIGN_BUDGET_LIMITS.max + 0.01]) {
    const result = validateCampaignBrief(validBrief({ dailyBudget }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.dailyBudget);
  }
  const result = validateCampaignBrief(
    validBrief({ audience: "x", hypothesis: "court", primaryMetric: "roas", successThreshold: 21 }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.audience);
  assert.ok(result.errors.hypothesis);
  assert.ok(result.errors.successThreshold);
});

test("brief CAMP-0 — deux décimales binaires usuelles restent acceptées", () => {
  const result = validateCampaignBrief(
    validBrief({
      dailyBudget: 5.29,
      primaryMetric: "conversion_rate",
      successThreshold: 0.29,
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(
    validateCampaignBrief(validBrief({ dailyBudget: 5.291 })).ok,
    false,
  );
});

test("brief CAMP-0 — les textes sont nettoyés avant persistance", () => {
  const result = validateCampaignBrief(
    validBrief({
      audience: "  Dirigeants\n  de PME  ",
      offer: "  Audit\u0000 stratégique  ",
      context: "   ",
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.audience, "Dirigeants de PME");
  assert.equal(result.value.offer, "Audit stratégique");
  assert.equal(result.value.context, "");
});

test("plan CAMP-0 — budget total recalculé depuis budget journalier × durée", () => {
  const validation = validateCampaignBrief(validBrief({ dailyBudget: 12.5, durationDays: 30 }));
  assert.equal(validation.ok, true);
  const plan = buildCampaignPlan(validation.value);
  assert.equal(plan.totalBudget, 375);
  assert.equal(plan.dailyCap, 12.5);
  assert.equal(plan.durationDays, 30);
});

test("plan CAMP-1 — projection uniquement avec coût observé exploitable", () => {
  const validation = validateCampaignBrief(validBrief());
  assert.equal(validation.ok, true);
  assert.equal(buildCampaignPlan(validation.value, { avgCostPerContact: 38 }).costPerContact, 38);
  assert.equal(buildCampaignPlan(validation.value, { avgCostPerContact: 38 }).confidence, 0.6);
  assert.equal(buildCampaignPlan(validation.value, { avgCostPerContact: 0 }).costPerContact, null);
  assert.equal(buildCampaignPlan(validation.value, { avgCostPerContact: Number.NaN }).confidence, null);
  assert.equal(buildCampaignPlan(validation.value).contactsMin, null);
  assert.equal(buildCampaignPlan(validation.value).stopCostPerContact, null);
});

test("variantes CAMP-0 — exactement deux textes nettoyés et bornés", () => {
  const valid = validateCampaignVariants([
    "  Une preuve\nconcrète pour décider. ",
    "Un audit clair avant d'investir davantage.",
  ]);
  assert.equal(valid.ok, true);
  assert.equal(valid.value[0], "Une preuve concrète pour décider.");

  for (const variants of [
    ["Une seule variante suffisamment longue"],
    ["court", "Une seconde variante suffisamment longue"],
    ["a".repeat(501), "Une seconde variante suffisamment longue"],
    ["A valide et suffisamment longue", "B valide et suffisamment longue", "C en trop"],
  ]) {
    assert.equal(validateCampaignVariants(variants).ok, false);
  }
});

test("libellés CAMP-0", () => {
  assert.equal(objectiveLabel("reactivation"), "Réactiver des contacts");
  assert.equal(channelLabel("meta"), "Meta");
  assert.equal(channelLabel("inconnu"), "inconnu");
});
