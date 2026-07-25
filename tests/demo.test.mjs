/**
 * Tests des scénarios de démo — parties pures uniquement.
 * Runner : node:test. Node ≥ 22.
 * Ce qui compte ici : le déterminisme (une démo se rejoue à l'identique), la
 * cohérence des données, et la présence VOLONTAIRE de défauts que l'agent doit
 * repérer — une base parfaite ne démontrerait rien.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoCampaigns,
  buildDemoProspects,
  buildDemoRevenue,
} from "../lib/demo/demo-rules.ts";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_IDS,
  findScenario,
} from "../lib/demo/scenarios.ts";

test("scénarios — trois profils distincts et complets", () => {
  assert.equal(DEMO_SCENARIOS.length, 3);
  assert.equal(new Set(DEMO_SCENARIO_IDS).size, 3, "identifiants uniques");

  for (const s of DEMO_SCENARIOS) {
    assert.ok(s.orgName, `${s.id} : nom d'entreprise`);
    assert.ok(s.pitch, `${s.id} : phrase de choix`);
    assert.ok(s.memory.description.length > 80, `${s.id} : description étoffée`);
    assert.ok(s.memory.philosophie.length > 40, `${s.id} : philosophie renseignée`);
    assert.ok(s.memory.offres.length >= 3, `${s.id} : au moins trois offres`);
    assert.ok(s.memory.objectifs.length <= 2, `${s.id} : deux objectifs maximum`);
    assert.ok(s.campaigns.length >= 3, `${s.id} : plusieurs campagnes`);
    assert.ok(s.products.length >= 3, `${s.id} : plusieurs produits`);
    assert.ok(s.pool.stages.length >= 4, `${s.id} : plusieurs statuts`);
  }
});

test("scénarios — chacun a une campagne en perte à repérer (ROAS < 1)", () => {
  for (const s of DEMO_SCENARIOS) {
    const losing = s.campaigns.filter((c) => {
      const revenuePerClick = c.cvr * c.aov;
      return revenuePerClick < c.cpc;
    });
    assert.ok(
      losing.length >= 1,
      `${s.id} : au moins une campagne en perte, sinon rien à couper`,
    );
    const winning = s.campaigns.filter((c) => c.cvr * c.aov > c.cpc * 2);
    assert.ok(winning.length >= 1, `${s.id} : au moins une campagne nettement rentable`);
  }
});

test("findScenario — retrouve par identifiant, refuse le reste", () => {
  assert.equal(findScenario("artisan")?.id, "artisan");
  assert.equal(findScenario("inconnu"), null);
  assert.equal(findScenario(null), null);
  assert.equal(findScenario(42), null);
});

test("prospects — déterministes et identifiants uniques", () => {
  const pool = DEMO_SCENARIOS[0].pool;
  const a = buildDemoProspects(pool, "art", 24);
  const b = buildDemoProspects(pool, "art", 24);
  assert.deepEqual(a, b, "deux appels donnent exactement la même base");

  const ids = a.map((p) => p.external_id);
  assert.equal(new Set(ids).size, ids.length, "identifiants uniques");
  assert.equal(a.length, 25, "24 fiches + le doublon volontaire");
});

test("prospects — défauts volontaires présents (matière pour l'agent)", () => {
  const pool = DEMO_SCENARIOS[1].pool;
  const list = buildDemoProspects(pool, "agc", 24);

  const sansEmail = list.filter((p) => !p.email);
  assert.ok(sansEmail.length >= 3, "des emails manquants à compléter");

  const sansStatut = list.filter((p) => !p.stage);
  assert.ok(sansStatut.length >= 2, "des fiches sans statut");

  const avecNotes = list.filter((p) => p.notes);
  assert.ok(avecNotes.length >= 3, "des notes pour la personnalisation");

  const emails = list.map((p) => p.email).filter(Boolean);
  assert.ok(
    new Set(emails).size < emails.length,
    "au moins un doublon d'email à dédupliquer",
  );

  // Scénario B2B : les prospects ont une entreprise.
  assert.ok(list.every((p) => p.company), "B2B : entreprise renseignée partout");
});

test("prospects — un scénario B2C n'invente pas d'entreprise", () => {
  const b2c = DEMO_SCENARIOS.find((s) => s.pool.companies.length === 0);
  assert.ok(b2c, "au moins un scénario particuliers");
  const list = buildDemoProspects(b2c.pool, "b2c", 12);
  assert.ok(list.every((p) => p.company === null));
});

test("campagnes — une ligne par campagne et par jour, chiffres cohérents", () => {
  const s = DEMO_SCENARIOS[2];
  const rows = buildDemoCampaigns(s.campaigns, 14);
  assert.equal(rows.length, s.campaigns.length * 14);
  assert.deepEqual(rows, buildDemoCampaigns(s.campaigns, 14), "déterministe");

  for (const r of rows) {
    assert.ok(r.clicks <= r.impressions, "moins de clics que d'impressions");
    assert.ok(r.conversions <= r.clicks, "moins de conversions que de clics");
    assert.ok(r.spend >= 0 && r.revenue >= 0);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("ventes — déterministes, datées dans le passé, montants plausibles", () => {
  const s = DEMO_SCENARIOS[0];
  const sales = buildDemoRevenue(s.products, "art", 30, 18);
  assert.equal(sales.length, 18);
  assert.deepEqual(sales, buildDemoRevenue(s.products, "art", 30, 18), "déterministe");

  const ids = sales.map((x) => x.external_id);
  assert.equal(new Set(ids).size, ids.length);

  const today = new Date().toISOString().slice(0, 10);
  for (const sale of sales) {
    assert.ok(sale.amount > 0);
    assert.ok(sale.occurred_on < today, "aucune vente dans le futur");
    assert.ok(
      s.products.some((p) => p.label === sale.label),
      "le libellé correspond à une offre du scénario",
    );
  }
});
