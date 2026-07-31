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
  /**
   * Volume mensuel du scénario de démonstration. Quand il est renseigné,
   * `buildDemoRevenue` respecte exactement le mix déclaré au lieu d'inventer
   * un même volume pour une vente artisanale et une commande e-commerce.
   */
  demoMonthlySales?: number;
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
  /** Vide pour un scénario B2C. */
  companies: string[];
  stages: string[];
  notes: string[];
  /**
   * Valeur explicite quand la notion d'entreprise ne s'applique pas.
   * Elle évite de présenter les particuliers comme des fiches incomplètes,
   * sans leur inventer une raison sociale.
   */
  companyWhenNotApplicable?: string;
  /** Contrat déterministe du jeu de prospects V2. */
  demoProfile?: DemoProspectProfile;
}

export interface DemoProspectProfile {
  /** Fiches canoniques avant ajout des doublons volontaires. */
  count: number;
  /** Nombre exact d'adresses répétées une fois. */
  duplicateEmails: number;
  /** Nombre exact de fiches canoniques sans email. */
  missingEmails: number;
  /** Nombre exact de fiches canoniques sans statut. */
  missingStages: number;
  /** Contacts joignables, actifs et silencieux depuis au moins 30 jours. */
  dormantProspects: number;
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
 * emails manquants, quelques statuts vides et un nombre EXPLICITE de doublons.
 * Les contacts dormants restent joignables et actifs : l'agent peut donc
 * proposer une relance utile plutôt qu'un faux signal.
 */
export function buildDemoProspects(
  pool: DemoPeoplePool,
  prefix: string,
  count?: number,
): DemoProspect[] {
  const out: DemoProspect[] = [];
  const profile = pool.demoProfile;
  const baseCount = Math.max(0, Math.floor(count ?? profile?.count ?? 24));
  const duplicateEmails = Math.min(
    Math.max(0, Math.floor(profile?.duplicateEmails ?? 1)),
    baseCount,
  );
  const missingEmails = Math.min(
    Math.max(0, Math.floor(profile?.missingEmails ?? Math.floor(baseCount / 6))),
    Math.max(0, baseCount - duplicateEmails),
  );
  const missingStages = Math.min(
    Math.max(0, Math.floor(profile?.missingStages ?? Math.floor(baseCount / 8))),
    Math.max(0, baseCount - duplicateEmails),
  );
  const dormantProspects = Math.min(
    Math.max(0, Math.floor(profile?.dormantProspects ?? 6)),
    Math.max(0, baseCount - missingEmails - missingStages),
  );

  // Les défauts sont placés à des indices distincts et hors de la cohorte
  // dormante. Cela garantit les comptages annoncés par le scénario.
  const missingEmailIndexes = new Set<number>();
  const missingStageIndexes = new Set<number>();
  for (let n = 0; n < missingEmails; n++) {
    missingEmailIndexes.add(baseCount - 1 - n);
  }
  for (let n = 0; n < missingStages; n++) {
    missingStageIndexes.add(baseCount - 1 - missingEmails - n);
  }

  for (let i = 0; i < baseCount; i++) {
    // Parcours bijectif du produit prénoms × noms : aucune collision de nom ou
    // d'email n'est possible avant épuisement de toutes les combinaisons.
    const pairCount = pool.firstNames.length * pool.lastNames.length;
    const pairIndex = pairCount > 0 ? (i * 37 + 17) % pairCount : i;
    const first = pool.firstNames[pairIndex % pool.firstNames.length] ?? `Contact ${i + 1}`;
    const last =
      pool.lastNames[Math.floor(pairIndex / Math.max(1, pool.firstNames.length))] ??
      String(i + 1);
    const cycle = pairCount > 0 ? Math.floor(i / pairCount) : 0;
    const name = cycle > 0 ? `${first} ${last} ${cycle + 1}` : `${first} ${last}`;
    const company =
      pool.companies.length > 0
        ? pick(pool.companies, i * 7 + 3)
        : pool.companyWhenNotApplicable ?? null;

    const hasEmail = !missingEmailIndexes.has(i);
    // Le libellé B2C « non applicable » ne devient pas un faux domaine.
    const domain =
      pool.companies.length > 0 && company ? `${slug(company)}.fr` : "email.fr";
    const cycleSuffix = cycle > 0 ? `.${cycle + 1}` : "";
    const email = hasEmail
      ? `${slug(first)}.${slug(last)}${cycleSuffix}@${domain}`
      : null;

    const isDormant = i < dormantProspects;
    const stage = missingStageIndexes.has(i)
      ? ""
      : isDormant
        ? pool.stages[0] ?? ""
        : pick(pool.stages, i * 11 + 4);

    // 1 fiche sur 5 porte une note personnelle (matière à personnalisation).
    const notes = i % 5 === 2 ? pick(pool.notes, i * 13 + 5) : null;

    // Le temps fait partie du scénario : contacts récents à laisser tranquilles,
    // relances ordinaires et silences d'au moins 30 jours. `null` représente une
    // source qui ne connaît pas cette information.
    const contactDaysAgo = isDormant
      ? [31, 38, 45, 52, 60, 75, 90, 120][i % 8]
      : [2, 8, 14, 20, null][i % 5];

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

  // Doublons strictement maîtrisés : les fiches canoniques ont des emails
  // uniques et chaque source sélectionnée n'est dupliquée qu'une fois.
  const duplicateSources = out.filter(
    (p, index) =>
      index >= dormantProspects &&
      p.email !== null &&
      p.stage !== "",
  );
  for (let i = 0; i < duplicateEmails; i++) {
    const source = duplicateSources[i];
    if (!source) break;
    out.push({
      ...source,
      external_id: `${prefix}-dup-${String(i + 1).padStart(3, "0")}`,
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
  count?: number,
): DemoSale[] {
  const out: DemoSale[] = [];
  const declaredMix = products.flatMap((product) =>
    Array.from(
      { length: Math.max(0, Math.floor(product.demoMonthlySales ?? 0)) },
      () => product,
    ),
  );
  const useDeclaredMix = count === undefined && declaredMix.length > 0;
  const saleCount = Math.max(
    0,
    Math.floor(count ?? (useDeclaredMix ? declaredMix.length : 18)),
  );
  // Même volume par produit à chaque seed, ordre seulement brassé pour que la
  // chronologie ne soit pas artificiellement groupée par offre.
  const scheduledProducts = useDeclaredMix
    ? declaredMix
        .map((product, index) => ({ product, index, order: rand(index * 17 + 11) }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ product }) => product)
    : [];

  for (let i = 0; i < saleCount; i++) {
    const p = useDeclaredMix ? scheduledProducts[i] : pick(products, i * 3 + 1);
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
