import type { CampaignMetric } from "./metrics-rules";

/**
 * Fournisseur de données fictives Meta Ads (aucun import `@/`, déterministe).
 * Sert à développer le connecteur sans compte ni dépense. L'API réelle (Meta
 * Insights) remplacera cette fonction en produisant les mêmes lignes.
 * Un profil par campagne (dont une en perte, une très rentable) réparti sur N
 * jours avec une variation reproductible (pseudo-aléatoire semé).
 */

export interface MockDailyRow extends CampaignMetric {
  date: string; // YYYY-MM-DD
}

interface Profile {
  id: string;
  name: string;
  dailyImpressions: number;
  ctr: number; // clics / impressions
  cpc: number; // coût par clic (€)
  cvr: number; // conversions / clics
  aov: number; // panier moyen (€) par conversion
}

// ROAS visés : prospection ~2,4 · retargeting ~4,5 · notoriété ~0,6 (perte) · lead ~1,6.
const PROFILES: Profile[] = [
  { id: "cmp_prospection", name: "Prospection Facebook — Offre découverte", dailyImpressions: 12000, ctr: 0.018, cpc: 0.42, cvr: 0.013, aov: 78 },
  { id: "cmp_retargeting", name: "Retargeting Instagram — Panier abandonné", dailyImpressions: 4200, ctr: 0.031, cpc: 0.55, cvr: 0.026, aov: 95 },
  { id: "cmp_notoriete", name: "Notoriété Reels — Vidéo de marque", dailyImpressions: 26000, ctr: 0.009, cpc: 0.30, cvr: 0.004, aov: 45 },
  { id: "cmp_leadads", name: "Lead Ads — Guide gratuit", dailyImpressions: 8000, ctr: 0.022, cpc: 0.36, cvr: 0.011, aov: 52 },
];

/** Pseudo-aléatoire déterministe dans [1-amp, 1+amp]. */
function jitter(seed: number, amp = 0.25): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = x - Math.floor(x); // [0,1)
  return 1 + (frac * 2 - 1) * amp;
}

/** Lignes quotidiennes fictives sur `days` jours (jusqu'à hier). */
export function mockMetaCampaigns(days = 7): MockDailyRow[] {
  const rows: MockDailyRow[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  PROFILES.forEach((p, ci) => {
    for (let d = 1; d <= days; d++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - d);
      const date = day.toISOString().slice(0, 10);

      const impressions = Math.round(p.dailyImpressions * jitter(ci * 100 + d));
      const clicks = Math.round(impressions * p.ctr * jitter(ci * 200 + d, 0.15));
      const spend = Math.round(clicks * p.cpc * jitter(ci * 300 + d, 0.1) * 100) / 100;
      const conversions = Math.round(clicks * p.cvr * jitter(ci * 400 + d, 0.3));
      const revenue = Math.round(conversions * p.aov * jitter(ci * 500 + d, 0.2) * 100) / 100;

      rows.push({
        campaign_id: p.id,
        campaign_name: p.name,
        date,
        impressions,
        clicks,
        spend,
        conversions,
        revenue,
      });
    }
  });

  return rows;
}
