/**
 * KPI de campagnes payantes — parties pures (aucun import `@/`, testable).
 * Calcule des indicateurs orientés vente/revenu (ROAS, CAC, taux de conversion)
 * et des constats simples. Sert la vue Campagnes ; alimentera l'analyse.
 * Aucune métrique inventée : tout dérive des chiffres fournis.
 */

export interface CampaignMetric {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number; // €
  conversions: number;
  revenue: number; // €
}

export interface CampaignKpis extends CampaignMetric {
  ctr: number; // clics / impressions
  cpc: number; // coût par clic
  cvr: number; // conversions / clics
  cac: number; // coût d'acquisition = dépense / conversions
  roas: number; // revenu / dépense
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

/** Indicateurs dérivés d'une ligne agrégée de campagne. */
export function deriveKpis(m: CampaignMetric): CampaignKpis {
  return {
    ...m,
    ctr: ratio(m.clicks, m.impressions),
    cpc: ratio(m.spend, m.clicks),
    cvr: ratio(m.conversions, m.clicks),
    cac: ratio(m.spend, m.conversions),
    roas: ratio(m.revenue, m.spend),
  };
}

/** Agrège des lignes (souvent quotidiennes) par campagne (somme). */
export function rollupByCampaign(rows: CampaignMetric[]): CampaignMetric[] {
  const by = new Map<string, CampaignMetric>();
  for (const r of rows) {
    const cur = by.get(r.campaign_id);
    if (!cur) {
      by.set(r.campaign_id, { ...r });
    } else {
      cur.impressions += r.impressions;
      cur.clicks += r.clicks;
      cur.spend += r.spend;
      cur.conversions += r.conversions;
      cur.revenue += r.revenue;
    }
  }
  return [...by.values()];
}

/** Totaux tous campagnes confondus. */
export function aggregate(rows: CampaignMetric[]): CampaignMetric {
  return rows.reduce(
    (a, r) => ({
      campaign_id: "all",
      campaign_name: "Toutes campagnes",
      impressions: a.impressions + r.impressions,
      clicks: a.clicks + r.clicks,
      spend: a.spend + r.spend,
      conversions: a.conversions + r.conversions,
      revenue: a.revenue + r.revenue,
    }),
    {
      campaign_id: "all",
      campaign_name: "Toutes campagnes",
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      revenue: 0,
    },
  );
}

export interface AdFinding {
  kind: string;
  title: string;
  detail: string;
  severity: "good" | "warn" | "bad";
}

const eur = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const x = (n: number) => `${n.toFixed(1)}×`;

/**
 * Constats sur un ensemble de campagnes (déjà agrégées par campagne) :
 * campagnes en perte (ROAS < 1), meilleure campagne à renforcer, CAC global.
 */
export function buildAdsFindings(campaigns: CampaignKpis[]): AdFinding[] {
  const findings: AdFinding[] = [];
  const active = campaigns.filter((c) => c.spend > 0);
  if (active.length === 0) return findings;

  // Campagnes qui coûtent plus qu'elles ne rapportent (priorité revenu).
  const losers = active
    .filter((c) => c.roas < 1)
    .sort((a, b) => a.roas - b.roas);
  for (const c of losers.slice(0, 2)) {
    findings.push({
      kind: "ads_losing",
      title: `« ${c.campaign_name} » coûte plus qu'elle ne rapporte`,
      detail: `ROAS ${x(c.roas)} — ${eur(c.spend)} dépensés pour ${eur(c.revenue)} de revenu. À revoir ou mettre en pause.`,
      severity: "bad",
    });
  }

  // Meilleure campagne rentable → à renforcer.
  const best = active
    .filter((c) => c.roas >= 1)
    .sort((a, b) => b.roas - a.roas)[0];
  if (best) {
    findings.push({
      kind: "ads_best",
      title: `« ${best.campaign_name} » est ta meilleure campagne`,
      detail: `ROAS ${x(best.roas)}, ${best.conversions} conversions. La renforcer amplifierait le revenu.`,
      severity: "good",
    });
  }

  // Coût d'acquisition global.
  const total = deriveKpis(aggregate(active));
  if (total.conversions > 0) {
    findings.push({
      kind: "ads_cac",
      title: `Coût d'acquisition moyen : ${eur(total.cac)}`,
      detail: `${total.conversions} conversions pour ${eur(total.spend)} dépensés, soit un ROAS global de ${x(total.roas)}.`,
      severity: total.roas >= 1 ? "good" : "warn",
    });
  }

  return findings;
}

export interface AdProposal {
  kind: string;
  title: string;
  finding: string;
  rationale: string;
  data_sources: string[];
  expected_impact: string;
  confidence: number;
  risk: "low" | "medium" | "high";
  payload: Record<string, unknown>;
}

/**
 * Propositions d'action à partir des KPI de campagnes — pour l'instant :
 * mettre en pause les campagnes en perte (ROAS < 1) au-delà d'un seuil de
 * dépense. Action **réversible et à faible risque** (réactivable), donc idéale
 * comme première action ads exécutable. Un `kind` unique par campagne (dédup).
 */
export function buildAdsProposals(campaigns: CampaignKpis[]): AdProposal[] {
  const losers = campaigns
    .filter((c) => c.spend >= 50 && c.roas < 1)
    .sort((a, b) => a.roas - b.roas);
  return losers.map((c) => ({
    kind: `ads_pause_${c.campaign_id}`,
    title: `Mettre en pause « ${c.campaign_name} »`,
    finding: `ROAS ${x(c.roas)} sur ${eur(c.spend)} dépensés — la campagne perd de l'argent (${eur(c.revenue)} de revenu).`,
    rationale: `Chaque euro investi n'en rapporte que ${x(c.roas)}. La mettre en pause stoppe la perte immédiatement ; l'action est réversible, on peut la réactiver à tout moment.`,
    data_sources: ["Meta Ads (démo)"],
    expected_impact: `~${eur(c.spend)} de dépense évitée sur 7 jours`,
    confidence: 0.8,
    risk: "low",
    payload: {
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      roas: Math.round(c.roas * 100) / 100,
      spend: c.spend,
      revenue: c.revenue,
      provider: "meta_ads",
    },
  }));
}
