/**
 * Conventions d'isolation du mode démonstration.
 *
 * Fichier pur : les règles peuvent être testées sans client Supabase. Les
 * marqueurs sont volontairement explicites ; une suppression de démo ne doit
 * jamais reposer sur le seul provider d'un vrai connecteur (`meta_ads`,
 * `stripe`).
 */

export const DEMO_PROVIDER = "demo";
export const DEMO_LOCK_SECTION = "__demo_lock";

export const DEMO_CAMPAIGN_PREFIX = "demo:";
export const DEMO_REVENUE_PREFIX = "demo:";

export function demoCampaignId(id: string): string {
  return `${DEMO_CAMPAIGN_PREFIX}${id}`;
}

export function demoRevenueId(id: string): string {
  return `${DEMO_REVENUE_PREFIX}${id}`;
}

export function isNamespacedDemoCampaign(id: unknown): boolean {
  return typeof id === "string" && id.startsWith(DEMO_CAMPAIGN_PREFIX);
}

export function isNamespacedDemoRevenue(id: unknown): boolean {
  return typeof id === "string" && id.startsWith(DEMO_REVENUE_PREFIX);
}

export interface DemoActionLike {
  payload?: unknown;
  data_sources?: unknown;
}

/**
 * Reconnaît les actions créées par la démo actuelle et celles de l'ancienne
 * version, avant l'ajout du marqueur `payload.demo`.
 */
export function isDemoAction(action: DemoActionLike): boolean {
  const payload =
    action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
      ? (action.payload as Record<string, unknown>)
      : {};
  if (payload.demo === true) return true;

  if (!Array.isArray(action.data_sources)) return false;
  return action.data_sources.some(
    (source) =>
      typeof source === "string" &&
      (source === "Meta Ads (démo)" ||
        source === "Meta Ads (scénario d'exemple)" ||
        source.includes("prospects (demo)")),
  );
}

export interface DemoIsolationInventory {
  realConnectors: number;
  realProspects: number;
  realCampaignRows: number;
  realRevenueRows: number;
  realActions: number;
  realOutbox: number;
  realBriefings: number;
}

export interface DemoModeMarkerCounts {
  backups: number;
  seededProspects: number;
  trustedDemoConnectors: number;
}

export function isTrustedDemoConnectorConfig(config: unknown): boolean {
  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    (config as Record<string, unknown>).demo === true
  );
}

export function demoProspectsMatchTrustedConnectors(
  trustedConnectorIds: readonly string[],
  prospectConnectorIds: readonly (string | null)[],
): boolean {
  const trusted = new Set(trustedConnectorIds);
  return prospectConnectorIds.every(
    (connectorId) => connectorId !== null && trusted.has(connectorId),
  );
}

/**
 * Un connecteur explicitement réservé et marqué pour la démo est un marqueur à
 * part entière. Cela couvre notamment l'état orphelin laissé par les anciennes
 * versions après le retrait des prospects et de la sauvegarde, sans faire
 * confiance au seul champ texte `provider`.
 */
export function hasActiveDemoMarker(
  markers: DemoModeMarkerCounts,
): boolean {
  return (
    markers.backups > 0 ||
    markers.seededProspects > 0 ||
    markers.trustedDemoConnectors > 0
  );
}

export type DemoIsolationConflict =
  | "connectors"
  | "prospects"
  | "campaigns"
  | "revenue"
  | "actions"
  | "outbox"
  | "briefing";

export interface DemoLoadState {
  active: boolean;
  legacy: boolean;
  conflicts: DemoIsolationConflict[];
}

/**
 * Une démo déjà active peut enchaîner A → B uniquement si tout l'état
 * opérationnel reste marqué démo. Une action, un message ou un briefing non
 * marqué apparu entre-temps ferme le préflight.
 */
export function demoIsolationConflicts(
  inventory: DemoIsolationInventory,
): DemoIsolationConflict[] {
  const conflicts: DemoIsolationConflict[] = [];
  if (inventory.realConnectors > 0) conflicts.push("connectors");
  if (inventory.realProspects > 0) conflicts.push("prospects");
  if (inventory.realCampaignRows > 0) conflicts.push("campaigns");
  if (inventory.realRevenueRows > 0) conflicts.push("revenue");

  if (inventory.realActions > 0) conflicts.push("actions");
  if (inventory.realOutbox > 0) conflicts.push("outbox");
  if (inventory.realBriefings > 0) conflicts.push("briefing");
  return conflicts;
}

export function buildDemoLoadState(
  active: boolean,
  legacy: boolean,
  inventory: DemoIsolationInventory,
): DemoLoadState {
  return {
    active,
    legacy,
    conflicts: demoIsolationConflicts(inventory),
  };
}

/**
 * Les anciens IDs n'étaient pas préfixés. Ils ne deviennent supprimables que
 * si deux preuves se cumulent : mode démo actif + au moins une ligne connue de
 * l'ancien seed. Un ID ressemblant à la démo dans une org inactive reste réel.
 */
export function legacyDemoCleanupAllowed(
  demoActive: boolean,
  legacyCampaignRows: number,
  legacyRevenueRows: number,
): boolean {
  return (
    demoActive &&
    (legacyCampaignRows > 0 || legacyRevenueRows > 0)
  );
}

/** Un marqueur orphelin ne suffit jamais : il n'est fiable qu'en mode actif. */
export function isTrustedDemoArtifact(
  demoActive: boolean,
  markedAsDemo: boolean,
): boolean {
  return demoActive && markedAsDemo;
}

export interface DemoLockContent {
  token: string;
  acquired_at: string;
  purpose: "demo" | "analysis" | "campaign" | "data";
}

export function parseDemoLock(content: unknown): DemoLockContent | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const row = content as Record<string, unknown>;
  if (typeof row.token !== "string" || row.token.length < 8) return null;
  if (typeof row.acquired_at !== "string") return null;
  if (Number.isNaN(Date.parse(row.acquired_at))) return null;
  // Les verrous créés avant l'ajout du type n'indiquaient pas leur objet.
  // On les assimile à une mutation démo : c'est le choix sûr tant que leur
  // ligne n'a pas fait l'objet d'une récupération manuelle vérifiée.
  const purpose =
    row.purpose === undefined
      ? "demo"
      : row.purpose === "demo" ||
          row.purpose === "analysis" ||
          row.purpose === "campaign" ||
          row.purpose === "data"
        ? row.purpose
        : null;
  if (!purpose) return null;
  return { token: row.token, acquired_at: row.acquired_at, purpose };
}

/**
 * Une garde de données réelles ne doit réagir qu'à une mutation démo. Un
 * verrou illisible reste toutefois bloquant, car son objet ne peut être prouvé.
 */
export function isDemoMutationLock(content: unknown): boolean {
  const lock = parseDemoLock(content);
  return !lock || lock.purpose === "demo";
}
