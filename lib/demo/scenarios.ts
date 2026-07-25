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
    { id: "art_local", name: "Google — Fenêtres sur mesure Chartres", dailyImpressions: 3200, ctr: 0.041, cpc: 0.95, cvr: 0.038, aov: 890 },
    // En perte assumée : beaucoup de vues, zéro devis. C'est LE constat que
    // l'agent doit remonter en premier (≈ 30 €/jour qui ne rapportent rien).
    { id: "art_notoriete", name: "Facebook — Nos réalisations en vidéo", dailyImpressions: 14000, ctr: 0.008, cpc: 0.28, cvr: 0.0002, aov: 300 },
    { id: "art_retarget", name: "Retargeting — Demande de devis", dailyImpressions: 2100, ctr: 0.034, cpc: 0.61, cvr: 0.031, aov: 1150 },
  ],
  products: [
    { label: "Pose fenêtres — maison Chartres", price: 4200 },
    { label: "Escalier bois sur mesure", price: 3600 },
    { label: "Porte d'entrée alu", price: 1850 },
    { label: "Remplacement 2 fenêtres", price: 1720 },
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
    { id: "agc_linkedin", name: "LinkedIn — Diagnostic positionnement", dailyImpressions: 5200, ctr: 0.014, cpc: 3.4, cvr: 0.045, aov: 2400 },
    { id: "agc_search", name: "Google — Agence communication industrie", dailyImpressions: 1800, ctr: 0.052, cpc: 2.1, cvr: 0.021, aov: 2400 },
    // En perte assumée : de la visibilité, aucun rendez-vous.
    { id: "agc_display", name: "Display — Notoriété régionale", dailyImpressions: 42000, ctr: 0.004, cpc: 0.22, cvr: 0.00008, aov: 1200 },
  ],
  products: [
    { label: "Diagnostic positionnement", price: 2400 },
    { label: "Refonte identité + site", price: 16500 },
    { label: "Accompagnement contenus — mensuel", price: 1800 },
    { label: "Atelier stratégie — journée", price: 1400 },
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
    { id: "eco_prospect", name: "Meta — Coffret découverte", dailyImpressions: 26000, ctr: 0.019, cpc: 0.38, cvr: 0.016, aov: 32 },
    { id: "eco_retarget", name: "Retargeting — Panier abandonné", dailyImpressions: 6400, ctr: 0.033, cpc: 0.44, cvr: 0.048, aov: 41 },
    { id: "eco_reels", name: "Reels — Notoriété torréfaction", dailyImpressions: 61000, ctr: 0.007, cpc: 0.26, cvr: 0.002, aov: 24 },
    { id: "eco_search", name: "Google Shopping — Café de spécialité", dailyImpressions: 9200, ctr: 0.026, cpc: 0.51, cvr: 0.022, aov: 29 },
  ],
  products: [
    { label: "Abonnement mensuel", price: 24 },
    { label: "Coffret découverte", price: 32 },
    { label: "Sachet 250 g — Éthiopie", price: 13 },
    { label: "Sachet 1 kg — Brésil", price: 42 },
  ],
};

export const DEMO_SCENARIOS: DemoScenario[] = [ARTISAN, AGENCE, ECOMMERCE];

export const DEMO_SCENARIO_IDS = DEMO_SCENARIOS.map((s) => s.id);

export function findScenario(id: unknown): DemoScenario | null {
  if (typeof id !== "string") return null;
  return DEMO_SCENARIOS.find((s) => s.id === id) ?? null;
}
