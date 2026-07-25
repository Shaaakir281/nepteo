/**
 * Tests des KPI de campagnes (connecteur ads) — parties pures.
 * Runner : node:test. Node ≥ 22. Aucune I/O.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveKpis,
  rollupByCampaign,
  aggregate,
  buildAdsFindings,
  buildAdsProposals,
  buildHistoryFindings,
  buildTrendFinding,
  comparePeriods,
  rollupWithStatus,
  splitByPeriod,
  windowBounds,
} from "../lib/ads/metrics-rules.ts";
import { mockMetaCampaigns } from "../lib/ads/mock-provider.ts";

const m = (over = {}) => ({
  campaign_id: "c1",
  campaign_name: "C1",
  impressions: 1000,
  clicks: 50,
  spend: 20,
  conversions: 5,
  revenue: 60,
  ...over,
});

test("deriveKpis — ROAS, CAC, CTR, CVR corrects", () => {
  const k = deriveKpis(m());
  assert.equal(k.roas, 3); // 60 / 20
  assert.equal(k.cac, 4); // 20 / 5
  assert.equal(k.ctr, 0.05); // 50 / 1000
  assert.equal(k.cvr, 0.1); // 5 / 50
});

test("deriveKpis — divisions par zéro → 0, pas de NaN/Infinity", () => {
  const k = deriveKpis(m({ impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 }));
  assert.equal(k.ctr, 0);
  assert.equal(k.roas, 0);
  assert.equal(k.cac, 0);
  assert.ok(Number.isFinite(k.cpc));
});

test("rollupByCampaign — somme les lignes quotidiennes par campagne", () => {
  const rows = [
    m({ campaign_id: "a", spend: 10, revenue: 30 }),
    m({ campaign_id: "a", spend: 5, revenue: 20 }),
    m({ campaign_id: "b", spend: 8, revenue: 4 }),
  ];
  const out = rollupByCampaign(rows).sort((x, y) => x.campaign_id.localeCompare(y.campaign_id));
  assert.equal(out.length, 2);
  assert.equal(out[0].spend, 15);
  assert.equal(out[0].revenue, 50);
  assert.equal(out[1].spend, 8);
});

test("aggregate — totaux tous campagnes confondus", () => {
  const total = aggregate([m({ spend: 10 }), m({ spend: 15 })]);
  assert.equal(total.spend, 25);
  assert.equal(total.campaign_id, "all");
});

test("buildAdsFindings — repère une campagne en perte et la meilleure", () => {
  const campaigns = [
    deriveKpis(m({ campaign_id: "win", campaign_name: "Gagnante", spend: 100, revenue: 400, conversions: 20 })),
    deriveKpis(m({ campaign_id: "lose", campaign_name: "Perdante", spend: 100, revenue: 50, conversions: 2 })),
  ];
  const f = buildAdsFindings(campaigns);
  assert.ok(f.some((x) => x.kind === "ads_losing" && /Perdante/.test(x.title)));
  assert.ok(f.some((x) => x.kind === "ads_best" && /Gagnante/.test(x.title)));
  assert.ok(f.some((x) => x.kind === "ads_cac"));
});

test("buildAdsProposals — propose de couper les campagnes en perte (au-dessus du seuil)", () => {
  const campaigns = [
    deriveKpis(m({ campaign_id: "lose", campaign_name: "Perdante", spend: 200, revenue: 80, conversions: 2 })),
    deriveKpis(m({ campaign_id: "win", campaign_name: "Gagnante", spend: 100, revenue: 400, conversions: 20 })),
    deriveKpis(m({ campaign_id: "tiny", campaign_name: "Micro", spend: 10, revenue: 2, conversions: 0 })),
  ];
  const props = buildAdsProposals(campaigns);
  // 'lose' proposée (perte + dépense ≥ 50), 'win' non (rentable), 'tiny' non (sous le seuil)
  assert.equal(props.length, 1);
  assert.equal(props[0].kind, "ads_pause_lose");
  assert.equal(props[0].risk, "low");
  assert.equal(props[0].payload.campaign_id, "lose");
  assert.ok(/pause/i.test(props[0].title));
});

test("mockMetaCampaigns — lignes déterministes, une campagne en perte, une très rentable", () => {
  const rows = mockMetaCampaigns(7);
  assert.equal(rows.length, 4 * 7);
  // Reproductible
  assert.deepEqual(mockMetaCampaigns(7)[0], rows[0]);
  const camps = rollupByCampaign(rows).map(deriveKpis);
  const noto = camps.find((c) => c.campaign_id === "cmp_notoriete");
  const reta = camps.find((c) => c.campaign_id === "cmp_retargeting");
  assert.ok(noto.roas < 1, `notoriété devrait être en perte, ROAS=${noto.roas}`);
  assert.ok(reta.roas > 2, `retargeting devrait être rentable, ROAS=${reta.roas}`);
  // Aucune valeur aberrante
  for (const c of camps) {
    assert.ok(Number.isFinite(c.roas) && Number.isFinite(c.cac));
    assert.ok(c.impressions > 0 && c.spend > 0);
  }
});

// ===== Fenêtre d'analyse, statut et comparaison =====

const NOW = new Date("2026-07-25T12:00:00Z");
const dated = (id, date, over = {}) => ({
  campaign_id: id,
  campaign_name: id,
  date,
  impressions: 1000,
  clicks: 50,
  spend: 100,
  conversions: 5,
  revenue: 300,
  ...over,
});

test("windowBounds — deux périodes contiguës de même durée", () => {
  const b = windowBounds(NOW, 30);
  assert.equal(b.currentFrom, "2026-06-25");
  assert.equal(b.previousFrom, "2026-05-26");
});

test("splitByPeriod — range chaque ligne dans la bonne période", () => {
  const b = windowBounds(NOW, 30);
  const rows = [
    dated("a", "2026-07-20"), // courante
    dated("a", "2026-06-25"), // courante (borne incluse)
    dated("a", "2026-06-24"), // précédente
    dated("a", "2026-05-26"), // précédente (borne incluse)
    dated("a", "2026-05-25"), // plus ancienne
  ];
  const s = splitByPeriod(rows, b);
  assert.equal(s.current.length, 2);
  assert.equal(s.previous.length, 2);
  assert.equal(s.older.length, 1);
});

test("rollupWithStatus — distingue en cours et terminée, et change de périmètre", () => {
  const b = windowBounds(NOW, 30);
  const rows = [
    // « live » tourne encore : jugée sur la fenêtre courante uniquement.
    dated("live", "2026-07-20", { spend: 100 }),
    dated("live", "2026-05-01", { spend: 900 }), // hors fenêtre, ignoré
    // « old » s'est arrêtée : jugée sur toute sa vie.
    dated("old", "2026-03-01", { spend: 200 }),
    dated("old", "2026-03-10", { spend: 300 }),
  ];
  const out = rollupWithStatus(rows, b, "2026-07-25");
  const live = out.find((c) => c.campaign_id === "live");
  const old = out.find((c) => c.campaign_id === "old");

  assert.equal(live.status, "active");
  assert.equal(live.spend, 100, "une campagne en cours ne traîne pas son passé");
  assert.equal(live.daysSinceLast, 0);

  assert.equal(old.status, "ended");
  assert.equal(old.spend, 500, "une campagne terminée est jugée sur toute sa vie");
  assert.equal(old.firstDate, "2026-03-01");
  assert.equal(old.lastDate, "2026-03-10");
  assert.equal(old.daysSinceLast, 137);
});

test("buildAdsProposals — ne propose jamais de couper une campagne terminée", () => {
  const losing = { spend: 200, revenue: 50, conversions: 1 };
  const ended = deriveKpis(m({ campaign_id: "old", ...losing }));
  const active = deriveKpis(m({ campaign_id: "live", ...losing }));

  const props = buildAdsProposals([
    { ...ended, status: "ended" },
    { ...active, status: "active" },
  ]);
  assert.equal(props.length, 1);
  assert.equal(props[0].kind, "ads_pause_live");

  // Sans statut (appelants historiques), le comportement ne change pas.
  assert.equal(buildAdsProposals([active]).length, 1);
});

test("comparePeriods — null sans passé, sinon variations relatives", () => {
  assert.equal(comparePeriods([dated("a", "2026-07-20")], []), null);

  const cmp = comparePeriods(
    [dated("a", "2026-07-20", { spend: 110, revenue: 200, conversions: 4 })],
    [dated("a", "2026-06-10", { spend: 100, revenue: 400, conversions: 8 })],
  );
  assert.equal(cmp.spend, 110);
  assert.equal(cmp.previousSpend, 100);
  assert.ok(Math.abs(cmp.spendChange - 0.1) < 1e-9, "+10 % de dépense");
  assert.ok(Math.abs(cmp.revenueChange + 0.5) < 1e-9, "−50 % de revenu");
  assert.ok(cmp.roas < cmp.previousRoas);
});

test("buildTrendFinding — muet sans comparaison, alerte quand ça se dégrade", () => {
  assert.equal(buildTrendFinding(null), null);
  const worse = buildTrendFinding(
    comparePeriods(
      [dated("a", "2026-07-20", { spend: 110, revenue: 200 })],
      [dated("a", "2026-06-10", { spend: 100, revenue: 400 })],
    ),
  );
  assert.equal(worse.severity, "warn");
  assert.ok(/moins/.test(worse.title));
  assert.ok(/−50 %/.test(worse.detail), "la baisse de revenu est chiffrée");
});

test("buildHistoryFindings — résume ce qui a déjà été tenté", () => {
  const b = windowBounds(NOW, 30);
  const rows = [
    dated("gagnante", "2026-03-01", { spend: 100, revenue: 400 }),
    dated("ratee", "2026-04-01", { spend: 300, revenue: 20 }),
    dated("live", "2026-07-20"),
  ];
  const findings = buildHistoryFindings(rollupWithStatus(rows, b, "2026-07-25"));
  assert.equal(findings.length, 2, "seules les campagnes terminées");
  const ratee = findings.find((f) => f.kind === "ads_past_ratee");
  assert.equal(ratee.severity, "warn");
  assert.ok(/pas march/.test(ratee.title));
  assert.ok(/Inutile de retenter/.test(ratee.detail));
  const gagnante = findings.find((f) => f.kind === "ads_past_gagnante");
  assert.equal(gagnante.severity, "good");
  assert.ok(/reconduire/.test(gagnante.detail));
});
