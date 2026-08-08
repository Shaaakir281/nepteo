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

// ===== Fenêtre d'analyse et historique =====

/**
 * Toutes les vues raisonnent sur les 30 derniers jours. Sans fenêtre, une
 * campagne mauvaise il y a six mois puis redressée paraîtrait tiède, et une
 * campagne arrêtée depuis longtemps continuerait d'être proposée « à couper ».
 */
export const ANALYSIS_WINDOW_DAYS = 30;

export interface DatedMetric extends CampaignMetric {
  date: string; // YYYY-MM-DD
}

export interface PeriodBounds {
  /** Début de la période courante (incluse). */
  currentFrom: string;
  /** Fin de la période courante (incluse) ; toute date future est exclue. */
  currentTo: string;
  /** Début de la période précédente, de même durée (incluse). */
  previousFrom: string;
  /** Fin de la période précédente (incluse). */
  previousTo: string;
}

function isoDaysAgo(now: Date, days: number): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Bornes des deux périodes comparées (courante et précédente, même durée). */
export function windowBounds(
  now: Date = new Date(),
  days: number = ANALYSIS_WINDOW_DAYS,
): PeriodBounds {
  return {
    currentFrom: isoDaysAgo(now, days - 1),
    currentTo: isoDaysAgo(now, 0),
    previousFrom: isoDaysAgo(now, days * 2 - 1),
    previousTo: isoDaysAgo(now, days),
  };
}

export interface PeriodSplit {
  current: DatedMetric[];
  previous: DatedMetric[];
  /** Plus ancien que les deux périodes — sert l'historique, pas les KPI. */
  older: DatedMetric[];
  /** Postérieur à la date d'observation — jamais compté dans un KPI. */
  future: DatedMetric[];
}

export function splitByPeriod(
  rows: DatedMetric[],
  bounds: PeriodBounds,
): PeriodSplit {
  const split: PeriodSplit = {
    current: [],
    previous: [],
    older: [],
    future: [],
  };
  for (const r of rows) {
    if (r.date > bounds.currentTo) split.future.push(r);
    else if (r.date >= bounds.currentFrom) split.current.push(r);
    else if (r.date >= bounds.previousFrom && r.date <= bounds.previousTo) {
      split.previous.push(r);
    }
    else split.older.push(r);
  }
  return split;
}

export type CampaignStatus = "active" | "ended";

export interface CampaignHistory extends CampaignKpis {
  status: CampaignStatus;
  firstDate: string;
  lastDate: string;
  /** Jours écoulés depuis la dernière ligne (0 si la campagne tourne encore). */
  daysSinceLast: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Agrège par campagne en distinguant les campagnes **en cours** des campagnes
 * **terminées** (aucune ligne dans la fenêtre courante).
 *
 * Le périmètre de calcul diffère volontairement : une campagne en cours est
 * jugée sur la fenêtre courante (c'est ce sur quoi on peut encore agir), une
 * campagne terminée sur toute sa durée de vie (sinon il n'y aurait rien à
 * montrer). Chaque ligne porte ses dates, donc rien n'est ambigu à l'affichage.
 */
export function rollupWithStatus(
  rows: DatedMetric[],
  bounds: PeriodBounds,
  today: string = new Date().toISOString().slice(0, 10),
): CampaignHistory[] {
  const byCampaign = new Map<string, DatedMetric[]>();
  for (const r of rows.filter((row) => row.date <= bounds.currentTo)) {
    const list = byCampaign.get(r.campaign_id);
    if (list) list.push(r);
    else byCampaign.set(r.campaign_id, [r]);
  }

  const out: CampaignHistory[] = [];
  for (const list of byCampaign.values()) {
    const dates = list.map((r) => r.date).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const status: CampaignStatus =
      lastDate >= bounds.currentFrom ? "active" : "ended";
    const scope = status === "active"
      ? list.filter(
          (r) => r.date >= bounds.currentFrom && r.date <= bounds.currentTo,
        )
      : list;
    out.push({
      ...deriveKpis(rollupByCampaign(scope)[0]),
      status,
      firstDate,
      lastDate,
      daysSinceLast: status === "active" ? 0 : daysBetween(lastDate, today),
    });
  }
  return out;
}

export interface PeriodComparison {
  spend: number;
  previousSpend: number;
  revenue: number;
  previousRevenue: number;
  conversions: number;
  previousConversions: number;
  roas: number;
  previousRoas: number;
  /** Variations relatives (0,12 = +12 %). 0 quand la base précédente est nulle. */
  spendChange: number;
  revenueChange: number;
}

const change = (now: number, before: number) =>
  before > 0 ? (now - before) / before : 0;

/**
 * Compare la période courante à la précédente. Renvoie `null` s'il n'y a rien
 * avant : mieux vaut ne rien dire que d'inventer une tendance.
 */
export function comparePeriods(
  current: CampaignMetric[],
  previous: CampaignMetric[],
): PeriodComparison | null {
  if (previous.length === 0) return null;
  const now = deriveKpis(aggregate(current));
  const before = deriveKpis(aggregate(previous));
  if (before.spend <= 0) return null;
  return {
    spend: now.spend,
    previousSpend: before.spend,
    revenue: now.revenue,
    previousRevenue: before.revenue,
    conversions: now.conversions,
    previousConversions: before.conversions,
    roas: now.roas,
    previousRoas: before.roas,
    spendChange: change(now.spend, before.spend),
    revenueChange: change(now.revenue, before.revenue),
  };
}

export interface AdFinding {
  kind: string;
  title: string;
  detail: string;
  severity: "good" | "warn" | "bad";
}

const eur = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const x = (n: number) =>
  `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 4,
  })}×`;

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

const pct = (n: number) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 100))} %`;

/**
 * Constat de tendance : la question que se pose vraiment un dirigeant, « est-ce
 * que ça va mieux ou moins bien que le mois dernier ? ». `null` sans période de
 * comparaison — on ne commente pas une tendance qu'on ne peut pas établir.
 */
export function buildTrendFinding(cmp: PeriodComparison | null): AdFinding | null {
  if (!cmp) return null;
  const better = cmp.roas >= cmp.previousRoas;
  return {
    kind: "ads_trend",
    title: better
      ? `Vos campagnes rapportent mieux que la période précédente`
      : `Vos campagnes rapportent moins que la période précédente`,
    detail:
      `Dépense ${eur(cmp.spend)} (${pct(cmp.spendChange)}) pour ${eur(cmp.revenue)} ` +
      `de revenu (${pct(cmp.revenueChange)}). ROAS ${x(cmp.roas)} contre ` +
      `${x(cmp.previousRoas)} sur les 30 jours d'avant.`,
    severity: better ? "good" : "warn",
  };
}

/**
 * Bilan d'une campagne terminée — ce qui a déjà été tenté et ce que ça a donné.
 * C'est la mémoire qui manque à la plupart des outils : sans elle, on repropose
 * indéfiniment ce qui a déjà échoué.
 */
export function buildHistoryFindings(campaigns: CampaignHistory[]): AdFinding[] {
  const ended = campaigns
    .filter((c) => c.status === "ended" && c.spend > 0)
    .sort((a, b) => a.daysSinceLast - b.daysSinceLast)
    .slice(0, 3);

  return ended.map((c) => {
    const worked = c.roas >= 1;
    return {
      kind: `ads_past_${c.campaign_id}`,
      title: worked
        ? `« ${c.campaign_name} » avait bien marché`
        : `« ${c.campaign_name} » n'avait pas marché`,
      detail:
        `Arrêtée il y a ${c.daysSinceLast} jours. Sur toute sa durée : ` +
        `${eur(c.spend)} dépensés, ${eur(c.revenue)} de revenu, ROAS ${x(c.roas)}. ` +
        (worked
          ? `À reconduire si les conditions sont comparables.`
          : `Inutile de retenter à l'identique.`),
      severity: worked ? "good" : "warn",
    };
  });
}

export interface AdProposal {
  kind: string;
  title: string;
  finding: string;
  rationale: string;
  data_sources: string[];
  expected_impact: string;
  confidence: number | null;
  risk: "low" | "medium" | "high";
  payload: Record<string, unknown>;
}

/**
 * Propositions d'action à partir des KPI de campagnes — pour l'instant :
 * mettre en pause les campagnes en perte (ROAS < 1) au-delà d'un seuil de
 * dépense. CAMP-2 en fait uniquement une demande d'arbitrage humain : elle
 * n'est jamais claimable ni appliquée chez le fournisseur. Un `kind` unique
 * par campagne porte la déduplication et la mémoire de ce qui a déjà été jugé.
 */
export function buildAdsProposals(
  campaigns: (Pick<
    CampaignKpis,
    "campaign_id" | "campaign_name" | "spend" | "revenue" | "roas"
  > & {
    status?: CampaignStatus;
    firstDate?: string;
    lastDate?: string;
  })[],
  options: { demo?: boolean } = {},
): AdProposal[] {
  const losers = campaigns
    // Une campagne déjà terminée n'a rien à couper : la proposer serait faux.
    // Le serveur persiste un ROAS canonique à deux décimales. Un ratio brut
    // comme 0,9999 deviendrait 1,00 et ferait échouer tout le lot ; on l'écarte
    // donc plutôt que d'afficher une perte arrondie contradictoire.
    .filter(
      (c) =>
        c.status !== "ended" &&
        c.spend >= 50 &&
        Math.round(c.roas * 100) / 100 < 1,
    )
    .sort((a, b) => a.roas - b.roas);
  return losers.map((c) => {
    const canonicalRoas = Math.round(c.roas * 100) / 100;
    return {
      kind: `ads_pause_${c.campaign_id}`,
      title: `Examiner la mise en pause de « ${c.campaign_name} »`,
      finding: `ROAS ${x(canonicalRoas)} sur ${eur(c.spend)} dépensés — le revenu enregistré est inférieur à la dépense (${eur(c.revenue)}).`,
      rationale:
        `Chaque euro observé correspond à ${x(canonicalRoas)} de revenu enregistré. Ces métriques justifient un examen humain ; ` +
        `elles ne prouvent ni un statut fournisseur actif ni qu'une pause a été appliquée.`,
      data_sources: [
        options.demo
          ? `Meta Ads — données du scénario d'exemple Nepteo${c.firstDate && c.lastDate ? ` du ${c.firstDate} au ${c.lastDate}` : ""}`
          : `Meta Ads — métriques observées${c.firstDate && c.lastDate ? ` du ${c.firstDate} au ${c.lastDate}` : ""}`,
      ],
      expected_impact:
        "Dépense future potentiellement réduite ; montant non estimé sans statut fournisseur actif.",
      confidence: null,
      risk: "low",
      payload: {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        roas: canonicalRoas,
        spend: c.spend,
        revenue: c.revenue,
        provider: "meta_ads",
        ...(c.firstDate ? { observation_from: c.firstDate } : {}),
        ...(c.lastDate ? { observation_to: c.lastDate } : {}),
      },
    };
  });
}
