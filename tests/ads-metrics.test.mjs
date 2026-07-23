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
