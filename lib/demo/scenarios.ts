/**
 * Scénarios de démo — trois entreprises fictives, cohérentes de bout en bout
 * (identité + prospects + campagnes + ventes). Parties pures : aucun import.
 *
 * But : montrer que l'agent s'adapte au métier. Trois profils volontairement
 * contrastés — artisan local qui vend à des particuliers, agence de services
 * qui vend à des entreprises, e-commerce. Chacun a une faiblesse réaliste que
 * l'agent doit repérer (une campagne en perte, des emails manquants, un statut
 * qui stagne), sinon la démonstration n'a rien à démontrer.
 */

import type {
  DemoCampaignProfile,
  DemoPeoplePool,
  DemoProduct,
} from "./demo-rules";

export interface DemoOffer {
  name: string;
  price?: string;
  target?: string;
  promise?: string;
}

export interface DemoMemory {
  activity_type: string;
  audience: string;
  description: string;
  zone: string;
  canaux: string[];
  ton: string;
  objectifs: string[];
  philosophie: string;
  /** Ce que l'entreprise fait déjà publiquement — l'agent doit le savoir. */
  presence: string[];
  offres: DemoOffer[];
}

export interface DemoScenario {
  id: string;
  label: string;
  /** Une phrase pour choisir sans lire la fiche entière. */
  pitch: string;
  orgName: string;
  memory: DemoMemory;
  pool: DemoPeoplePool;
  campaigns: DemoCampaignProfile[];
  products: DemoProduct[];
}

export interface DemoScenarioExpectedCounts {
  canonicalProspects: number;
  importedProspects: number;
  duplicateEmails: number;
  missingEmails: number;
  missingStages: number;
  dormantProspects: number;
  campaigns: number;
  revenueEvents: number;
}

/** Comptages annoncés par le scénario, dérivés de sa configuration pure. */
export function getScenarioExpectedCounts(
  scenario: DemoScenario,
): DemoScenarioExpectedCounts {
  const profile = scenario.pool.demoProfile;
  const canonicalProspects = profile?.count ?? 24;
  const duplicateEmails = profile?.duplicateEmails ?? 1;
  const declaredRevenueEvents = scenario.products.reduce(
    (total, product) => total + Math.max(0, Math.floor(product.demoMonthlySales ?? 0)),
    0,
  );

  return {
    canonicalProspects,
    importedProspects: canonicalProspects + duplicateEmails,
    duplicateEmails,
    missingEmails: profile?.missingEmails ?? Math.floor(canonicalProspects / 6),
    missingStages: profile?.missingStages ?? Math.floor(canonicalProspects / 8),
    dormantProspects: profile?.dormantProspects ?? 6,
    campaigns: scenario.campaigns.length,
    revenueEvents: declaredRevenueEvents || 18,
  };
}

const FIRST_NAMES = [
  "Julie", "Marc", "Sarah", "Thomas", "Nadia", "Antoine",
  "Camille", "Youssef", "Élodie", "Pierre", "Leïla", "Hugo",
];
const LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Petit", "Moreau", "Laurent",
  "Benali", "Girard", "Rousseau", "Marchand", "Nguyen", "Faure",
];

// ===== 1. Artisan local, vend à des particuliers =====

const ARTISAN: DemoScenario = {
  id: "artisan",
  label: "Menuiserie Dubreuil — artisan local",
  pitch: "Vend à des particuliers, près de chez lui. Beaucoup de bouche-à-oreille, peu de suivi.",
  orgName: "Menuiserie Dubreuil",
  memory: {
    activity_type: "Services",
    audience: "Particuliers",
    description:
      "Nous fabriquons et posons des fenêtres, portes et escaliers sur mesure, en bois et en aluminium. Nos clients sont des propriétaires qui rénovent leur maison, souvent sur recommandation d'un voisin ou d'un architecte.",
    zone: "Eure-et-Loir et sud de l'Île-de-France",
    canaux: ["Recommandations", "Google", "Réseaux sociaux"],
    ton: "Simple et direct, sans jargon technique. On explique, on ne survend pas.",
    objectifs: ["Trouver plus de clients", "Relancer mes prospects"],
    philosophie:
      "Je préfère perdre un chantier que promettre un délai que je ne tiendrai pas. Le devis est gratuit et sans relance insistante : si le client hésite, c'est souvent qu'il a raison d'attendre.",
    presence: [
      "Fiche Google Business à jour, 34 avis (4,8/5)",
      "Publicités Google actives sur « fenêtres sur mesure »",
      "Page Facebook avec des photos de chantiers, ~2 publications par mois",
      "Aucune newsletter",
    ],
    offres: [
      { name: "Fenêtres sur mesure", price: "à partir de 850 € posé", target: "Propriétaires en rénovation", promise: "Pose en une journée, sans dégâts" },
      { name: "Escalier bois", price: "à partir de 3 200 €", target: "Maisons individuelles", promise: "Dessiné avec vous, fabriqué à l'atelier" },
      { name: "Visite conseil à domicile", price: "gratuite", target: "Projets de rénovation", promise: "Un chiffrage clair sous 48 h" },
    ],
  },
  pool: {
    firstNames: FIRST_NAMES,
    lastNames: LAST_NAMES,
    companies: [],
    companyWhenNotApplicable: "Particulier — projet habitat",
    demoProfile: {
      count: 26,
      duplicateEmails: 2,
      missingEmails: 4,
      missingStages: 3,
      dormantProspects: 5,
    },
    stages: ["Devis envoyé", "Visite planifiée", "Premier contact", "En réflexion", "Chantier signé"],
    notes: [
      "Rencontré au salon de l'habitat, projet pour le printemps.",
      "Attend l'accord de son prêt travaux.",
      "Veut du bois clair, budget serré.",
      "A déjà fait poser une véranda par un concurrent, mécontent.",
      "Recommandé par M. Lecomte, chantier de 2024.",
    ],
  },
  campaigns: [
    // --- En cours ---
    { id: "art_local", name: "Meta Ads — Fenêtres sur mesure Chartres", dailyImpressions: 900, ctr: 0.041, cpc: 0.95, cvr: 0.015, aov: 890, startDaysAgo: 90, trend: 1.15 },
    { id: "art_retarget", name: "Retargeting — Demande de devis", dailyImpressions: 450, ctr: 0.034, cpc: 0.61, cvr: 0.035, aov: 1150, startDaysAgo: 70, trend: 0.7 },
    // En perte assumée : beaucoup de vues, zéro devis. C'est LE constat que
    // l'agent doit remonter en premier (≈ 30 €/jour qui ne rapportent rien).
    { id: "art_notoriete", name: "Facebook — Nos réalisations en vidéo", dailyImpressions: 14000, ctr: 0.008, cpc: 0.28, cvr: 0.0002, aov: 300, startDaysAgo: 45 },
    // --- Terminées (mémoire de ce qui a déjà été tenté) ---
    { id: "art_hiver", name: "Meta Ads — Isolation avant l'hiver", dailyImpressions: 2600, ctr: 0.035, cpc: 1.1, cvr: 0.011, aov: 480, startDaysAgo: 175, endDaysAgo: 130 },
    { id: "art_tiktok", name: "Instagram Reels — Test format court", dailyImpressions: 18000, ctr: 0.012, cpc: 0.22, cvr: 0.0004, aov: 300, startDaysAgo: 105, endDaysAgo: 88 },
  ],
  products: [
    { label: "Pose fenêtres — maison Chartres", price: 4200, demoMonthlySales: 6 },
    { label: "Escalier bois sur mesure", price: 3600, demoMonthlySales: 3 },
    { label: "Porte d'entrée alu", price: 1850, demoMonthlySales: 5 },
    { label: "Remplacement 2 fenêtres", price: 1720, demoMonthlySales: 4 },
  ],
};

// ===== 2. Agence de services, vend à des entreprises =====

const AGENCE: DemoScenario = {
  id: "agence",
  label: "Atelier Northwind — agence B2B",
  pitch: "Vend des prestations à des entreprises. Cycle long, relances indispensables.",
  orgName: "Atelier Northwind",
  memory: {
    activity_type: "Services",
    audience: "Entreprises",
    description:
      "Nous accompagnons des PME industrielles dans la refonte de leur communication : positionnement, identité visuelle, site web et contenus. Missions de trois à six mois, en direct avec le dirigeant.",
    zone: "France, majoritairement Grand Ouest",
    canaux: ["Recommandations", "Prospection", "Événements", "Email"],
    ton: "Professionnel et franc. On dit quand une demande n'est pas la bonne priorité.",
    objectifs: ["Obtenir plus de rendez-vous", "Relancer mes prospects"],
    philosophie:
      "On refuse les missions où l'on n'apporte rien. Un client qui repart avec un diagnostic honnête et sans devis vaut mieux qu'un contrat qu'on n'assumera pas. Pas de forfait au rabais : le prix reflète le temps réel.",
    presence: [
      "Publicités LinkedIn actives sur le diagnostic positionnement",
      "Études de cas publiées sur le site, 1 nouvelle par trimestre",
      "Présence au salon Global Industrie",
      "Aucune newsletter, aucun compte Instagram",
    ],
    offres: [
      { name: "Diagnostic positionnement", price: "2 400 €", target: "PME de 10 à 200 personnes", promise: "Un cap clair en trois semaines" },
      { name: "Refonte identité + site", price: "12 000 à 25 000 €", target: "Industriels en croissance", promise: "Livré en quatre mois, formation incluse" },
      { name: "Accompagnement contenus", price: "1 800 €/mois", target: "Équipes marketing d'une personne", promise: "Deux publications par mois, écrites avec vous" },
    ],
  },
  pool: {
    firstNames: FIRST_NAMES,
    lastNames: LAST_NAMES,
    companies: [
      "Fonderie Delaunay", "Groupe Vervent", "Plastimold", "Cartonnages Réault",
      "Hydrotech Ouest", "Menuiseries Barot", "Sodial Industries", "Verrerie Nantaise",
    ],
    demoProfile: {
      count: 30,
      duplicateEmails: 2,
      missingEmails: 4,
      missingStages: 3,
      dormantProspects: 7,
    },
    stages: ["Rendez-vous fait", "Proposition envoyée", "Premier contact", "En attente budget", "Signé"],
    notes: [
      "Rencontré au salon Global Industrie, à recontacter après l'été.",
      "Budget voté au T4, pas avant.",
      "Le dirigeant veut être en copie de tous les échanges.",
      "A refusé notre proposition en 2025, trop chère à l'époque.",
      "Nous a été recommandé par la Fonderie Delaunay.",
    ],
  },
  campaigns: [
    // --- En cours ---
    { id: "agc_linkedin", name: "Meta Lead Ads — Diagnostic positionnement", dailyImpressions: 500, ctr: 0.014, cpc: 3.4, cvr: 0.058, aov: 2400, startDaysAgo: 90, trend: 1.1 },
    { id: "agc_search", name: "Meta Retargeting — Communication industrie", dailyImpressions: 200, ctr: 0.052, cpc: 2.1, cvr: 0.05, aov: 2400, startDaysAgo: 90, trend: 0.85 },
    // En perte assumée : de la visibilité, aucun rendez-vous.
    { id: "agc_display", name: "Meta Audience Network — Notoriété régionale", dailyImpressions: 42000, ctr: 0.004, cpc: 0.22, cvr: 0.00008, aov: 1200, startDaysAgo: 40 },
    // --- Terminées ---
    { id: "agc_salon", name: "Meta Lead Ads — Salon Global Industrie", dailyImpressions: 7000, ctr: 0.016, cpc: 3.6, cvr: 0.013, aov: 2400, startDaysAgo: 170, endDaysAgo: 140 },
    { id: "agc_webinar", name: "Meta — Inscriptions au webinaire", dailyImpressions: 5000, ctr: 0.009, cpc: 1.9, cvr: 0.0009, aov: 2400, startDaysAgo: 120, endDaysAgo: 100 },
  ],
  products: [
    { label: "Diagnostic positionnement", price: 2400, demoMonthlySales: 4 },
    { label: "Refonte identité + site", price: 16500, demoMonthlySales: 2 },
    { label: "Accompagnement contenus — mensuel", price: 1800, demoMonthlySales: 6 },
    { label: "Atelier stratégie — journée", price: 1400, demoMonthlySales: 3 },
  ],
};

// ===== 3. E-commerce =====

const ECOMMERCE: DemoScenario = {
  id: "ecommerce",
  label: "Racines & Co — e-commerce",
  pitch: "Vend en ligne, gros volume de contacts. Le panier moyen et la publicité pilotent tout.",
  orgName: "Racines & Co",
  memory: {
    activity_type: "E-commerce",
    audience: "Particuliers",
    description:
      "Nous vendons en ligne des cafés de spécialité torréfiés en France, en sachets et en abonnement mensuel. Nos clients sont des amateurs qui veulent savoir d'où vient leur café.",
    zone: "France métropolitaine et Belgique",
    canaux: ["Réseaux sociaux", "Publicité", "Email", "Google"],
    ton: "Chaleureux et pédagogue, un peu passionné. Jamais donneur de leçons.",
    objectifs: ["Vendre davantage", "Fidéliser mes clients"],
    philosophie:
      "On dit d'où vient chaque lot et ce qu'on paie au producteur, même quand ce n'est pas flatteur. Pas de fausse rareté ni de compte à rebours : si une origine est épuisée, on l'écrit.",
    presence: [
      "Publicités Meta actives sur le coffret découverte",
      "Instagram très actif, ~4 publications par semaine",
      "Newsletter hebdomadaire à environ 6 000 abonnés",
      "Code promo -10 % pour la première commande affiché sur le site",
    ],
    offres: [
      { name: "Abonnement mensuel", price: "24 €/mois", target: "Amateurs réguliers", promise: "Une origine différente chaque mois, sans engagement" },
      { name: "Coffret découverte", price: "32 €", target: "Cadeaux et premiers achats", promise: "Trois origines, livré en 48 h" },
      { name: "Sachet 250 g", price: "13 €", target: "Achat à l'unité", promise: "Torréfié à la commande" },
    ],
  },
  pool: {
    firstNames: FIRST_NAMES,
    lastNames: LAST_NAMES,
    companies: [],
    companyWhenNotApplicable: "Particulier — client e-commerce",
    demoProfile: {
      count: 36,
      duplicateEmails: 3,
      missingEmails: 6,
      missingStages: 4,
      dormantProspects: 6,
    },
    stages: ["Panier abandonné", "Première commande", "Client fidèle", "Abonné", "Inactif depuis 3 mois"],
    notes: [
      "A demandé un café décaféiné, on n'en propose pas encore.",
      "Commande toujours en fin de mois.",
      "Livraison en retard en mai, geste commercial fait.",
      "Nous suit sur Instagram depuis le lancement.",
      "Veut une facture au nom de son entreprise.",
    ],
  },
  campaigns: [
    // --- En cours ---
    { id: "eco_prospect", name: "Meta — Coffret découverte", dailyImpressions: 5000, ctr: 0.019, cpc: 0.25, cvr: 0.008, aov: 32, startDaysAgo: 90, trend: 0.8 },
    { id: "eco_retarget", name: "Retargeting — Panier abandonné", dailyImpressions: 1500, ctr: 0.033, cpc: 0.3, cvr: 0.03, aov: 41, startDaysAgo: 90, trend: 1.1 },
    { id: "eco_search", name: "Meta — Collection café de spécialité", dailyImpressions: 2500, ctr: 0.026, cpc: 0.32, cvr: 0.012, aov: 29, startDaysAgo: 75 },
    // En perte assumée : énormément de vues, presque aucune vente.
    { id: "eco_reels", name: "Reels — Notoriété torréfaction", dailyImpressions: 61000, ctr: 0.007, cpc: 0.26, cvr: 0.002, aov: 24, startDaysAgo: 50 },
    // --- Terminées ---
    { id: "eco_noel", name: "Meta — Coffrets de fin d'année", dailyImpressions: 34000, ctr: 0.024, cpc: 0.41, cvr: 0.035, aov: 38, startDaysAgo: 180, endDaysAgo: 150 },
    { id: "eco_influence", name: "Instagram créateurs — Test", dailyImpressions: 22000, ctr: 0.006, cpc: 0.6, cvr: 0.002, aov: 24, startDaysAgo: 130, endDaysAgo: 115 },
  ],
  products: [
    { label: "Abonnement mensuel", price: 24, demoMonthlySales: 70 },
    { label: "Coffret découverte", price: 32, demoMonthlySales: 50 },
    { label: "Sachet 250 g — Éthiopie", price: 13, demoMonthlySales: 75 },
    { label: "Sachet 1 kg — Brésil", price: 42, demoMonthlySales: 25 },
  ],
};

export const DEMO_SCENARIOS: DemoScenario[] = [ARTISAN, AGENCE, ECOMMERCE];

export const DEMO_SCENARIO_IDS = DEMO_SCENARIOS.map((s) => s.id);

export function findScenario(id: unknown): DemoScenario | null {
  if (typeof id !== "string") return null;
  return DEMO_SCENARIOS.find((s) => s.id === id) ?? null;
}
