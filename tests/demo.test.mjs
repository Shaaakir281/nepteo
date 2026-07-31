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
  buildFindings,
  daysSinceContact,
  isTerminalStage,
  selectDormantProspects,
} from "../lib/analysis-rules.ts";
import {
  buildDemoCampaigns,
  buildDemoProspects,
  buildDemoRevenue,
} from "../lib/demo/demo-rules.ts";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_IDS,
  findScenario,
  getScenarioExpectedCounts,
} from "../lib/demo/scenarios.ts";
import {
  rollupWithStatus,
  windowBounds,
} from "../lib/ads/metrics-rules.ts";

test("scénarios — trois profils distincts et complets", () => {
  assert.equal(DEMO_SCENARIOS.length, 3);
  assert.equal(new Set(DEMO_SCENARIO_IDS).size, 3, "identifiants uniques");

  for (const s of DEMO_SCENARIOS) {
    assert.ok(s.orgName, `${s.id} : nom d'entreprise`);
    assert.ok(s.pitch, `${s.id} : phrase de choix`);
    assert.ok(s.memory.description.length > 80, `${s.id} : description étoffée`);
    assert.ok(s.memory.philosophie.length > 40, `${s.id} : philosophie renseignée`);
    assert.ok(s.memory.offres.length >= 3, `${s.id} : au moins trois offres`);
    assert.ok(s.memory.presence.length >= 3, `${s.id} : communication actuelle décrite`);
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

test("prospects V2 — contrats, défauts et doublons sont exacts", () => {
  for (const scenario of DEMO_SCENARIOS) {
    const expected = getScenarioExpectedCounts(scenario);
    const a = buildDemoProspects(scenario.pool, scenario.id);
    const b = buildDemoProspects(scenario.pool, scenario.id);
    assert.deepEqual(a, b, `${scenario.id} : deux appels donnent la même base`);
    assert.equal(a.length, expected.importedProspects, `${scenario.id} : imports`);

    const ids = a.map((p) => p.external_id);
    assert.equal(new Set(ids).size, ids.length, `${scenario.id} : identifiants uniques`);

    const canonical = a.slice(0, expected.canonicalProspects);
    assert.equal(
      canonical.filter((p) => !p.email).length,
      expected.missingEmails,
      `${scenario.id} : emails manquants`,
    );
    assert.equal(
      canonical.filter((p) => !p.stage).length,
      expected.missingStages,
      `${scenario.id} : statuts manquants`,
    );
    assert.ok(
      canonical.filter((p) => p.notes).length >= 3,
      `${scenario.id} : notes de personnalisation`,
    );
    assert.ok(
      canonical.some((p) => p.last_contact_at === null),
      `${scenario.id} : dernier contact parfois inconnu`,
    );

    const canonicalEmails = canonical.map((p) => p.email).filter(Boolean);
    assert.equal(
      new Set(canonicalEmails).size,
      canonicalEmails.length,
      `${scenario.id} : aucune collision accidentelle`,
    );

    const emailCounts = new Map();
    for (const email of a.map((p) => p.email).filter(Boolean)) {
      emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
    }
    const repeated = [...emailCounts.values()].filter((count) => count > 1);
    assert.equal(
      repeated.length,
      expected.duplicateEmails,
      `${scenario.id} : nombre exact d'adresses dupliquées`,
    );
    assert.ok(
      repeated.every((count) => count === 2),
      `${scenario.id} : chaque adresse volontaire est répétée une seule fois`,
    );
  }
});

test("campagnes — le catalogue reste cohérent avec le provider Meta du seed", () => {
  const metaVocabulary =
    /Meta|Facebook|Instagram|Retargeting|Reels|Audience Network/i;
  for (const scenario of DEMO_SCENARIOS) {
    for (const campaign of scenario.campaigns) {
      assert.match(
        campaign.name,
        metaVocabulary,
        `${scenario.id}/${campaign.id} doit désigner un canal Meta`,
      );
    }
  }
});

test("prospects V2 — 4 à 8 dormants joignables et actifs par scénario", () => {
  const today = new Date().toISOString().slice(0, 10);

  for (const scenario of DEMO_SCENARIOS) {
    const expected = getScenarioExpectedCounts(scenario);
    const list = buildDemoProspects(scenario.pool, scenario.id);
    const dormant = selectDormantProspects(list, today, 30);

    assert.equal(
      dormant.length,
      expected.dormantProspects,
      `${scenario.id} : cohorte dormante annoncée`,
    );
    assert.ok(
      dormant.length >= 4 && dormant.length <= 8,
      `${scenario.id} : volume lisible en démonstration`,
    );
    for (const prospect of dormant) {
      assert.ok(prospect.email, `${scenario.id} : dormant joignable`);
      assert.ok(prospect.stage, `${scenario.id} : dormant classé`);
      assert.equal(
        isTerminalStage(prospect.stage),
        false,
        `${scenario.id} : dormant encore actif`,
      );
      assert.ok(
        daysSinceContact(prospect.last_contact_at, today) >= 30,
        `${scenario.id} : silence factuel`,
      );
    }
  }
});

test("prospects V2 — les particuliers ne déclenchent pas l'entreprise manquante", () => {
  const b2cScenarios = DEMO_SCENARIOS.filter(
    (scenario) => scenario.memory.audience === "Particuliers",
  );
  assert.equal(b2cScenarios.length, 2, "artisan et e-commerce sont B2C");

  for (const scenario of b2cScenarios) {
    const list = buildDemoProspects(scenario.pool, scenario.id);
    assert.ok(
      list.every(
        (prospect) =>
          prospect.company === scenario.pool.companyWhenNotApplicable,
      ),
      `${scenario.id} : la société est explicitement non applicable`,
    );
    const findings = buildFindings(
      list.map((prospect) => ({ ...prospect, source: "demo" })),
      new Date().toISOString().slice(0, 10),
    );
    assert.equal(
      findings.find((finding) => finding.kind === "complete_missing_company"),
      undefined,
      `${scenario.id} : aucun faux positif B2B`,
    );
  }

  const b2b = DEMO_SCENARIOS.find((scenario) => scenario.memory.audience === "Entreprises");
  assert.ok(b2b, "un scénario B2B existe");
  assert.ok(
    buildDemoProspects(b2b.pool, b2b.id).every((prospect) => prospect.company),
    "B2B : entreprise renseignée partout",
  );
});

test("campagnes — chaque campagne a sa propre période de diffusion", () => {
  const s = DEMO_SCENARIOS[2];
  const rows = buildDemoCampaigns(s.campaigns);
  assert.deepEqual(rows, buildDemoCampaigns(s.campaigns), "déterministe");

  // Le nombre de lignes suit le cycle de vie déclaré, pas une durée fixe.
  const expected = s.campaigns.reduce((n, c) => {
    const start = c.startDaysAgo ?? 30;
    const end = Math.min(c.endDaysAgo ?? 1, start);
    return n + (start - end + 1);
  }, 0);
  assert.equal(rows.length, expected);

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

test("ventes V2 — le mix mensuel déclaré est respecté exactement", () => {
  for (const scenario of DEMO_SCENARIOS) {
    const expected = getScenarioExpectedCounts(scenario);
    const sales = buildDemoRevenue(scenario.products, scenario.id);
    assert.equal(sales.length, expected.revenueEvents, `${scenario.id} : volume de ventes`);

    for (const product of scenario.products) {
      assert.equal(
        sales.filter((sale) => sale.label === product.label).length,
        product.demoMonthlySales,
        `${scenario.id} : mix ${product.label}`,
      );
    }
  }
});

test("économie V2 — le revenu publicitaire reste attribuable aux ventes du mois", () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const scenario of DEMO_SCENARIOS) {
    const currentCampaignRows = buildDemoCampaigns(scenario.campaigns).filter((row) => {
      const rowDate = new Date(`${row.date}T00:00:00Z`);
      return (today.getTime() - rowDate.getTime()) / 86_400_000 <= 30;
    });
    const attributedRevenue = currentCampaignRows.reduce(
      (total, row) => total + row.revenue,
      0,
    );
    const totalRevenue = buildDemoRevenue(scenario.products, scenario.id).reduce(
      (total, sale) => total + sale.amount,
      0,
    );

    assert.ok(
      attributedRevenue <= totalRevenue,
      `${scenario.id} : l'attribution publicitaire ne dépasse pas les ventes`,
    );
    assert.ok(
      attributedRevenue >= totalRevenue * 0.45,
      `${scenario.id} : les campagnes restent matériellement reliées aux ventes`,
    );
  }
});

test("campagnes — chaque scénario a un passé : des campagnes terminées", () => {
  for (const s of DEMO_SCENARIOS) {
    const ended = s.campaigns.filter((c) => (c.endDaysAgo ?? 1) > 45);
    assert.ok(
      ended.length >= 2,
      `${s.id} : au moins deux campagnes arrêtées, sinon l'agent n'a aucune mémoire`,
    );
    const running = s.campaigns.filter((c) => (c.endDaysAgo ?? 1) <= 1);
    assert.ok(running.length >= 3, `${s.id} : plusieurs campagnes en cours`);
    // Assez d'antériorité pour comparer à la période précédente (30 j + 30 j).
    assert.ok(
      running.some((c) => (c.startDaysAgo ?? 30) >= 60),
      `${s.id} : au moins une campagne couvre les deux périodes comparées`,
    );
  }
});

test("campagnes — le moteur voit bien de l'actif ET du terminé", () => {
  for (const s of DEMO_SCENARIOS) {
    const rows = buildDemoCampaigns(s.campaigns);
    const out = rollupWithStatus(rows, windowBounds());
    const active = out.filter((c) => c.status === "active");
    const ended = out.filter((c) => c.status === "ended");
    assert.ok(active.length >= 3, `${s.id} : campagnes en cours détectées`);
    assert.ok(ended.length >= 2, `${s.id} : campagnes terminées détectées`);
    // Une campagne terminée qui avait marché, une qui n'avait pas marché.
    assert.ok(ended.some((c) => c.roas >= 1), `${s.id} : un succès passé`);
    assert.ok(ended.some((c) => c.roas < 1), `${s.id} : un échec passé`);
    // Aucune campagne terminée ne doit rester sans dépense (sinon invisible).
    for (const c of ended) assert.ok(c.spend > 0);
  }
});
