/** Catalogue des connecteurs — textes issus des maquettes validées. */

/** Familles d'outils branchables — alignées sur `supabase/migrations/0001_init.sql`. */
export type ConnectorType =
  | "crm"
  | "analytics"
  | "ads"
  | "email"
  | "payments"
  | "files";

export interface CatalogTool {
  provider: string; // slug stocké en DB
  name: string;
  letter: string;
  color: string;
  darkText?: boolean;
  type: ConnectorType;
  description: string;
}

export interface CatalogGroup {
  title: string;
  sub: string;
  tools: CatalogTool[];
}

/**
 * Un connecteur proposé n'est pas un connecteur activable. Ce registre est la
 * source de vérité des parcours réellement exposés par l'application.
 */
export type ConnectorActivation = "oauth" | "import" | "proposal";

export interface ConnectorCapability {
  activation: ConnectorActivation;
  read: boolean;
  write: false;
  sync: "manual" | "none";
}

export const CONNECTOR_CATALOG: CatalogGroup[] = [
  {
    title: "Trouver et suivre les prospects",
    sub: "Les personnes intéressées, leurs coordonnées et l'avancement des échanges.",
    tools: [
      { provider: "hubspot", name: "HubSpot", letter: "H", color: "#ff7a59", type: "crm", description: "Retrouver vos contacts, vos échanges et vos opportunités en cours." },
      { provider: "pipedrive", name: "Pipedrive", letter: "P", color: "#1a1a2e", type: "crm", description: "Suivre vos ventes en cours et repérer les affaires qui n'avancent plus." },
      { provider: "salesforce", name: "Salesforce", letter: "S", color: "#00a1e0", type: "crm", description: "Relier votre base commerciale existante sans rien déplacer." },
      { provider: "airtable", name: "Airtable", letter: "A", color: "#f6b93b", type: "crm", description: "Utiliser vos tableaux de contacts comme base de prospects." },
      { provider: "csv", name: "Fichier CSV", letter: "CSV", color: "#5a4fe0", type: "crm", description: "Importer un export de votre base pour tester Nepteo avec vos propres contacts." },
      { provider: "google_sheets", name: "Google Sheets", letter: "G", color: "#1c9e5f", type: "crm", description: "Un simple fichier de contacts suffit pour commencer à relancer." },
      { provider: "notion", name: "Notion", letter: "N", color: "#26262b", type: "crm", description: "Importer vos listes de clients et de prospects déjà organisées." },
    ],
  },
  {
    title: "Comprendre les visiteurs",
    sub: "D'où viennent les visiteurs de votre site et ce qu'ils y font.",
    tools: [
      { provider: "google_analytics", name: "Google Analytics", letter: "GA", color: "#e8710a", type: "analytics", description: "Comprendre comment les visiteurs arrivent sur votre site et ce qu'ils font ensuite." },
      { provider: "matomo", name: "Matomo", letter: "M", color: "#35845d", type: "analytics", description: "La même lecture de votre trafic, avec vos données hébergées chez vous." },
      { provider: "posthog", name: "PostHog", letter: "P", color: "#f9bd2b", darkText: true, type: "analytics", description: "Voir précisément comment votre application ou votre site est utilisé." },
      { provider: "website", name: "Site internet", letter: "◍", color: "#5a4fe0", type: "files", description: "Nepteo lit votre site pour connaître vos offres et votre discours." },
    ],
  },
  {
    title: "Suivre les campagnes",
    sub: "Ce que vous dépensez en publicité et ce que cela vous rapporte.",
    tools: [
      { provider: "meta_ads", name: "Meta Ads", letter: "M", color: "#0866ff", type: "ads", description: "Suivre vos publicités Facebook et Instagram et leur coût par contact." },
      { provider: "google_ads", name: "Google Ads", letter: "G", color: "#4285f4", type: "ads", description: "Savoir quelles recherches Google vous amènent réellement des clients." },
      { provider: "linkedin_ads", name: "LinkedIn Ads", letter: "in", color: "#0a66c2", type: "ads", description: "Mesurer vos campagnes auprès des professionnels et des entreprises." },
    ],
  },
  {
    title: "Communiquer",
    sub: "Vos emails, vos newsletters et vos messages de relance.",
    tools: [
      { provider: "brevo", name: "Brevo", letter: "B", color: "#0b996e", type: "email", description: "Relier vos campagnes email et vos listes de contacts." },
      { provider: "mailchimp", name: "Mailchimp", letter: "M", color: "#ffdf6b", darkText: true, type: "email", description: "Voir qui ouvre vos emails et qui mérite une relance." },
      { provider: "activecampaign", name: "ActiveCampaign", letter: "A", color: "#2e6ee6", type: "email", description: "Suivre vos séquences d'emails automatiques et leurs résultats." },
      { provider: "gmail", name: "Gmail", letter: "G", color: "#ea4335", type: "email", description: "Préparer vos relances directement depuis votre boîte mail." },
    ],
  },
  {
    title: "Suivre les ventes",
    sub: "Vos paiements et vos revenus, pour mesurer ce qui rapporte vraiment.",
    tools: [
      { provider: "stripe", name: "Stripe", letter: "S", color: "#635bff", type: "payments", description: "Relier vos paiements pour voir quelles actions génèrent du revenu." },
      { provider: "shopify", name: "Shopify", letter: "S", color: "#95bf47", type: "payments", description: "Suivre vos commandes et repérer vos produits les plus rentables." },
      { provider: "woocommerce", name: "WooCommerce", letter: "W", color: "#7f54b3", type: "payments", description: "Connecter la boutique de votre site WordPress en quelques clics." },
      { provider: "invoicing", name: "Logiciel de facturation", letter: "F", color: "#3f3d56", type: "payments", description: "Utiliser vos factures pour suivre le chiffre d'affaires réel." },
    ],
  },
];

export const CONNECTOR_CAPABILITIES = {
  hubspot: { activation: "proposal", read: false, write: false, sync: "none" },
  pipedrive: { activation: "proposal", read: false, write: false, sync: "none" },
  salesforce: { activation: "proposal", read: false, write: false, sync: "none" },
  airtable: { activation: "proposal", read: false, write: false, sync: "none" },
  csv: { activation: "import", read: true, write: false, sync: "manual" },
  google_sheets: { activation: "oauth", read: true, write: false, sync: "manual" },
  notion: { activation: "oauth", read: true, write: false, sync: "manual" },
  google_analytics: { activation: "proposal", read: false, write: false, sync: "none" },
  matomo: { activation: "proposal", read: false, write: false, sync: "none" },
  posthog: { activation: "proposal", read: false, write: false, sync: "none" },
  website: { activation: "proposal", read: false, write: false, sync: "none" },
  // META-READ : OAuth et lectures manuelles bornées uniquement. Aucun endpoint
  // de création, mise à jour, pause ou lancement Ads n'est enregistré ici.
  meta_ads: { activation: "oauth", read: true, write: false, sync: "manual" },
  google_ads: { activation: "proposal", read: false, write: false, sync: "none" },
  linkedin_ads: { activation: "proposal", read: false, write: false, sync: "none" },
  brevo: { activation: "proposal", read: false, write: false, sync: "none" },
  mailchimp: { activation: "proposal", read: false, write: false, sync: "none" },
  activecampaign: { activation: "proposal", read: false, write: false, sync: "none" },
  gmail: { activation: "proposal", read: false, write: false, sync: "none" },
  stripe: { activation: "proposal", read: false, write: false, sync: "none" },
  shopify: { activation: "proposal", read: false, write: false, sync: "none" },
  woocommerce: { activation: "proposal", read: false, write: false, sync: "none" },
  invoicing: { activation: "proposal", read: false, write: false, sync: "none" },
} as const satisfies Record<string, ConnectorCapability>;

export function connectorCapability(
  provider: string,
): ConnectorCapability | undefined {
  return CONNECTOR_CAPABILITIES[provider as keyof typeof CONNECTOR_CAPABILITIES];
}

export function isRequestableConnector(provider: string): boolean {
  return connectorCapability(provider)?.activation === "proposal";
}

export function findTool(provider: string): CatalogTool | undefined {
  for (const g of CONNECTOR_CATALOG) {
    const t = g.tools.find((x) => x.provider === provider);
    if (t) return t;
  }
  return undefined;
}
