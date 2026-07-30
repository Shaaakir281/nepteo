/**
 * Générateurs de données de démo — parties pures (aucun import, testable).
 * Tout est DÉTERMINISTE : le même scénario produit toujours la même base, donc
 * une démo se rejoue à l'identique et le seed reste idempotent.
 *
 * Les définitions des scénarios vivent dans lib/demo/scenarios.ts, l'écriture en
 * base dans lib/demo/seed.ts.
 */

export interface DemoProspect {
  external_id: string;
  name: string;
  email: string | null;
  company: string | null;
  stage: string;
  notes: string | null;
  last_contact_at: string | null;
}

export interface DemoCampaignProfile {
  id: string;
  name: string;
  dailyImpressions: number;
  ctr: number;
  cpc: number;
  cvr: number;
  aov: number;
  /** Premier jour de diffusion, en jours avant aujourd'hui. Défaut : 30. */
  startDaysAgo?: number;
  /** Dernier jour de diffusion. Défaut : 1 (la campagne tourne encore). */
  endDaysAgo?: number;
  /**
   * Dérive de performance sur la durée de vie : 1 = stable, 0,5 = la campagne
   * a perdu la moitié de son efficacité entre son début et sa fin, 1,6 = elle
   * s'est améliorée. Rend l'historique lisible plutôt que plat.
   */
  trend?: number;
}

export interface DemoCampaignRow {
  campaign_id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface DemoProduct {
  label: string;
  price: number;
}

export interface DemoSale {
  external_id: string;
  label: string;
  amount: number;
  occurred_on: string;
}

/** Vivier de noms et de sociétés d'un scénario — combiné de façon déterministe. */
export interface DemoPeoplePool {
  firstNames: string[];
  lastNames: string[];
  /** Vide pour un scénario B2C : les prospects n'ont alors pas d'entreprise. */
  companies: string[];
  stages: string[];
  notes: string[];
}

/** Pseudo-aléatoire déterministe dans [0,1) — même patron que les autres mocks. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.floor(rand(seed) * list.length) % list.length];
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Base de prospects fictive et réaliste. Volontairement IMPARFAITE : quelques
 * emails manquants, quelques statuts vides, un doublon — c'est exactement ce que
 * l'agent doit repérer. Une base trop propre ne démontre rien.
 */
export function buildDemoProspects(
  pool: DemoPeoplePool,
  prefix: string,
  count = 24,
): DemoProspect[] {
  const out: DemoProspect[] = [];

  for (let i = 0; i < count; i++) {
    const first = pick(pool.firstNames, i * 3 + 1);
    const last = pick(pool.lastNames, i * 5 + 2);
    const name = `${first} ${last}`;
    const company =
      pool.companies.length > 0 ? pick(pool.companies, i * 7 + 3) : null;

    // 1 fiche sur 6 sans email : l'agent doit proposer de les compléter.
    const hasEmail = i % 6 !== 4;
    const domain = company ? `${slug(company)}.fr` : "email.fr";
    const email = hasEmail ? `${slug(first)}.${slug(last)}@${domain}` : null;

    // 1 fiche sur 8 sans statut : autre signal que l'agent sait relever.
    const stage = i % 8 === 5 ? "" : pick(pool.stages, i * 11 + 4);

    // 1 fiche sur 5 porte une note personnelle (matière à personnalisation).
    const notes = i % 5 === 2 ? pick(pool.notes, i * 13 + 5) : null;

    // Le temps fait partie du scénario : contacts récents à laisser tranquilles,
    // relances ordinaires et silences de plus de 21 jours. `null` représente une
    // source qui ne connaît pas cette information.
    const contactDaysAgo = [2, 10, 24, 45, null, 14][i % 6];

    out.push({
      external_id: `${prefix}-${String(i + 1).padStart(3, "0")}`,
      name,
      email,
      company,
      stage,
      notes,
      last_contact_at:
        contactDaysAgo === null ? null : isoDaysAgo(contactDaysAgo),
    });
  }

  // Un doublon d'email volontaire : la dédup et la proposition « doublons »
  // n'ont d'intérêt que s'il y en a un à trouver.
  const source = out.find((p) => p.email);
  if (source) {
    out.push({
      ...source,
      external_id: `${prefix}-dup`,
      stage: pool.stages[0] ?? source.stage,
      notes: null,
    });
  }

  return out;
}

/**
 * Lignes quotidiennes de campagnes, chacune sur SA propre période de diffusion.
 * Certaines campagnes sont terminées depuis des mois : c'est ce qui donne à
 * l'agent une mémoire de ce qui a déjà été tenté, au lieu d'une photo à 14 jours.
 */
export function buildDemoCampaigns(
  profiles: readonly DemoCampaignProfile[],
  defaultDays = 30,
): DemoCampaignRow[] {
  const rows: DemoCampaignRow[] = [];

  profiles.forEach((p, pi) => {
    const start = p.startDaysAgo ?? defaultDays;
    const end = Math.min(p.endDaysAgo ?? 1, start);
    const span = Math.max(1, start - end);
    const trend = p.trend ?? 1;

    for (let d = start; d >= end; d--) {
      // Progression de 0 (premier jour) à 1 (dernier jour) : la dérive s'applique
      // graduellement, sans marche d'escalier.
      const progress = (start - d) / span;
      const drift = 1 + (trend - 1) * progress;
      const seed = pi * 1000 + d;
      const wobble = 0.8 + rand(seed) * 0.4; // ±20 %, reproductible

      const impressions = Math.round(p.dailyImpressions * wobble);
      const clicks = Math.round(impressions * p.ctr);
      const spend = Math.round(clicks * p.cpc * 100) / 100;
      const conversions = Math.round(clicks * p.cvr * drift);
      const revenue = Math.round(conversions * p.aov * 100) / 100;

      rows.push({
        campaign_id: p.id,
        campaign_name: p.name,
        date: isoDaysAgo(d),
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

/** Ventes fictives réparties sur `days` jours — cohérentes avec les offres. */
export function buildDemoRevenue(
  products: readonly DemoProduct[],
  prefix: string,
  days = 30,
  count = 18,
): DemoSale[] {
  const out: DemoSale[] = [];
  for (let i = 0; i < count; i++) {
    const p = pick(products, i * 3 + 1);
    const dayBack = 1 + Math.floor(rand(i * 5 + 2) * days);
    const wobble = 0.9 + rand(i * 7 + 3) * 0.2; // ±10 %
    out.push({
      external_id: `${prefix}-sale-${String(i + 1).padStart(3, "0")}`,
      label: p.label,
      amount: Math.round(p.price * wobble * 100) / 100,
      occurred_on: isoDaysAgo(dayBack),
    });
  }
  return out;
}
