import { DEMO_SEED_VERSION } from "./version.ts";
import { DEMO_SCENARIO_IDS } from "./scenarios.ts";
import type {
  DemoIsolationConflict,
  DemoLoadState,
} from "./isolation-rules.ts";

/**
 * Ce type décrit uniquement la manière honnête de présenter l'environnement.
 * Les garde-fous d'écriture restent portés par `lib/demo/isolation.ts`.
 */
export type DemoPresentation =
  | "none"
  | "certified-demo"
  | "test-environment";

const BRIEFING_DATA_SOURCE_LABELS: Record<DemoPresentation, string> = {
  "certified-demo": "à partir des données fictives du scénario Nepteo.",
  "test-environment": "à partir des données de cet environnement de test.",
  none: "à partir de vos données réelles.",
};

export function briefingDataSourceLabel(
  presentation: DemoPresentation,
): string {
  return BRIEFING_DATA_SOURCE_LABELS[presentation];
}

export interface DemoLoadGuard {
  canLoad: boolean;
  checkFailed: boolean;
  requiresDemoRemoval: boolean;
  conflicts: DemoIsolationConflict[];
}

export interface DemoPresentationEvidence {
  evidenceComplete: boolean;
  backups: number;
  trustedDemoConnectors: number;
  certifiedDemoConnectors: number;
  certifiedCounts: CertifiedDemoCounts | null;
  demoProspects: number;
  nonDemoConnectors: number;
  nonDemoProspects: number;
  demoCampaignRows: number;
  nonDemoCampaignRows: number;
  demoRevenueRows: number;
  nonDemoRevenueRows: number;
}

export interface CertifiedDemoCounts {
  prospects: number;
  campaignRows: number;
  revenueEvents: number;
}

export function certifiedDemoCounts(
  config: unknown,
): CertifiedDemoCounts | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }
  const raw = (config as Record<string, unknown>).counts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const prospects = row.prospects;
  const campaignRows = row.campaign_rows;
  const revenueEvents = row.revenue_events;
  if (
    !Number.isInteger(prospects) ||
    Number(prospects) <= 0 ||
    !Number.isInteger(campaignRows) ||
    Number(campaignRows) <= 0 ||
    !Number.isInteger(revenueEvents) ||
    Number(revenueEvents) <= 0
  ) {
    return null;
  }
  return {
    prospects: Number(prospects),
    campaignRows: Number(campaignRows),
    revenueEvents: Number(revenueEvents),
  };
}

/**
 * Un simple `{ demo: true }` est un garde-fou, pas une preuve que toutes les
 * données du tenant sont fictives. La certification d'affichage exige le
 * contrat versionné écrit par le seed Nepteo.
 */
export function isCertifiedDemoConnectorConfig(config: unknown): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }

  const row = config as Record<string, unknown>;
  const loadedAt =
    typeof row.loaded_at === "string" ? new Date(row.loaded_at) : null;
  return (
    row.demo === true &&
    row.complete === true &&
    typeof row.scenario === "string" &&
    DEMO_SCENARIO_IDS.includes(row.scenario) &&
    row.seed_version === DEMO_SEED_VERSION &&
    certifiedDemoCounts(row) !== null &&
    loadedAt !== null &&
    !Number.isNaN(loadedAt.getTime()) &&
    loadedAt.toISOString() === row.loaded_at
  );
}

/**
 * « Données fictives » n'est affiché que pour un seed complet, unique et sans
 * données apportées par le testeur. Toute preuve incomplète ou tout mélange
 * bascule vers le libellé prudent « Environnement de test ».
 */
export function classifyDemoPresentation(
  evidence: DemoPresentationEvidence,
): DemoPresentation {
  const {
    evidenceComplete,
    backups,
    trustedDemoConnectors,
    certifiedDemoConnectors,
    certifiedCounts,
    demoProspects,
    nonDemoConnectors,
    nonDemoProspects,
    demoCampaignRows,
    nonDemoCampaignRows,
    demoRevenueRows,
    nonDemoRevenueRows,
  } = evidence;

  const isCertifiedDemo =
    evidenceComplete &&
    backups === 1 &&
    trustedDemoConnectors === 1 &&
    certifiedDemoConnectors === 1 &&
    certifiedCounts !== null &&
    demoProspects === certifiedCounts.prospects &&
    demoCampaignRows === certifiedCounts.campaignRows &&
    demoRevenueRows === certifiedCounts.revenueEvents &&
    nonDemoConnectors === 0 &&
    nonDemoProspects === 0 &&
    nonDemoCampaignRows === 0 &&
    nonDemoRevenueRows === 0;
  if (isCertifiedDemo) return "certified-demo";

  const hasAnyEvidence =
    backups > 0 ||
    trustedDemoConnectors > 0 ||
    certifiedDemoConnectors > 0 ||
    demoProspects > 0 ||
    nonDemoConnectors > 0 ||
    nonDemoProspects > 0 ||
    demoCampaignRows > 0 ||
    nonDemoCampaignRows > 0 ||
    demoRevenueRows > 0 ||
    nonDemoRevenueRows > 0;
  if (!evidenceComplete || hasAnyEvidence) return "test-environment";

  return "none";
}

/**
 * Une certification V2 active peut changer de scénario, à condition que
 * l'inventaire de sécurité reste vide. Un ancien marqueur demande en revanche
 * un retrait explicite : on ne transforme jamais silencieusement un état
 * ambigu en nouveau seed.
 */
export function classifyDemoLoadGuard(
  state: DemoLoadState | null,
  hasCertifiedDemoMarker: boolean,
): DemoLoadGuard {
  if (!state) {
    return {
      canLoad: false,
      checkFailed: true,
      requiresDemoRemoval: false,
      conflicts: [],
    };
  }

  const requiresDemoRemoval =
    state.active && !hasCertifiedDemoMarker;
  return {
    canLoad: state.conflicts.length === 0 && !requiresDemoRemoval,
    checkFailed: false,
    requiresDemoRemoval,
    conflicts: state.conflicts,
  };
}
