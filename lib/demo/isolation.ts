import { ensureOk, type Admin } from "@/lib/demo/db";
import {
  DEMO_CAMPAIGN_PREFIX,
  DEMO_LOCK_SECTION,
  DEMO_PROVIDER,
  DEMO_REVENUE_PREFIX,
  demoIsolationConflicts,
  hasActiveDemoMarker,
  isDemoAction,
  isDemoMutationLock,
  isTrustedDemoConnectorConfig,
  isTrustedDemoArtifact,
  legacyDemoCleanupAllowed,
  type DemoIsolationConflict,
  type DemoIsolationInventory,
} from "@/lib/demo/isolation-rules";
import { DEMO_BACKUP_SECTION } from "@/lib/demo/memory-backup-rules";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";

const LEGACY_CAMPAIGN_IDS = DEMO_SCENARIOS.flatMap((scenario) =>
  scenario.campaigns.map((campaign) => campaign.id),
);
const LEGACY_REVENUE_PATTERNS = DEMO_SCENARIOS.map(
  (scenario) => `${scenario.id}-sale-%`,
);

const CONFLICT_LABELS: Record<DemoIsolationConflict, string> = {
  connectors: "connecteurs",
  prospects: "prospects",
  campaigns: "campagnes",
  revenue: "ventes",
  actions: "propositions",
  outbox: "messages préparés",
  briefing: "briefing",
};

export class DemoIsolationError extends Error {
  readonly conflicts: DemoIsolationConflict[];

  constructor(conflicts: DemoIsolationConflict[]) {
    const labels = conflicts.map((conflict) => CONFLICT_LABELS[conflict]).join(", ");
    super(
      `Chargement refusé : cette organisation contient déjà des données réelles (${labels}). Utilisez une organisation de test vide.`,
    );
    this.name = "DemoIsolationError";
    this.conflicts = conflicts;
  }
}

function checkedCount(
  result: { count: number | null; error: { message: string } | null },
  what: string,
): number {
  ensureOk(result.error, what);
  return result.count ?? 0;
}

function checkedRows<T>(
  result: { data: T[] | null; error: { message: string } | null },
  what: string,
): T[] {
  ensureOk(result.error, what);
  return result.data ?? [];
}

export interface DemoModeMarkers {
  active: boolean;
  legacy: boolean;
  seededProspects: number;
  trustedDemoConnectors: number;
}

export async function readDemoModeMarkers(
  admin: Admin,
  orgId: string,
): Promise<DemoModeMarkers> {
  const [backup, prospects, connector] = await Promise.all([
    admin
      .from("company_memory")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("section", DEMO_BACKUP_SECTION),
    admin
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("source", DEMO_PROVIDER),
    admin
      .from("connectors")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("provider", DEMO_PROVIDER)
      .contains("config", { demo: true }),
  ]);
  const backups = checkedCount(backup, "détection de la sauvegarde de démonstration");
  const seededProspects = checkedCount(
    prospects,
    "détection des prospects de démonstration",
  );
  const trustedDemoConnectors = checkedCount(
    connector,
    "détection du connecteur de démonstration marqué",
  );
  const active = hasActiveDemoMarker({
    backups,
    seededProspects,
    trustedDemoConnectors,
  });
  if (!active) {
    return {
      active: false,
      legacy: false,
      seededProspects,
      trustedDemoConnectors,
    };
  }

  const [campaigns, ...revenues] = await Promise.all([
    admin
      .from("ad_metrics")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("provider", "meta_ads")
      .in("campaign_id", LEGACY_CAMPAIGN_IDS),
    ...LEGACY_REVENUE_PATTERNS.map((pattern) =>
      admin
        .from("revenue_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("source", "stripe")
        .like("external_id", pattern),
    ),
  ]);
  const legacyCampaigns = checkedCount(
    campaigns,
    "détection des anciennes campagnes de démonstration",
  );
  const legacyRevenue = revenues.reduce(
    (count, result) =>
      count + checkedCount(result, "détection des anciennes ventes de démonstration"),
    0,
  );
  return {
    active: true,
    legacy: legacyDemoCleanupAllowed(
      active,
      legacyCampaigns,
      legacyRevenue,
    ),
    seededProspects,
    trustedDemoConnectors,
  };
}

export async function isDemoModeActive(admin: Admin, orgId: string): Promise<boolean> {
  return (await readDemoModeMarkers(admin, orgId)).active;
}

/**
 * Garde des mutations réelles : bloque aussi pendant la courte fenêtre située
 * entre la prise du verrou et la création de la sauvegarde de démo.
 */
export async function isDemoModeOrMutationActive(
  admin: Admin,
  orgId: string,
): Promise<boolean> {
  const [markers, lock] = await Promise.all([
    readDemoModeMarkers(admin, orgId),
    admin
      .from("company_memory")
      .select("content")
      .eq("organization_id", orgId)
      .eq("section", DEMO_LOCK_SECTION)
      .maybeSingle(),
  ]);
  ensureOk(lock.error, "détection d'une opération de démonstration");
  return markers.active || Boolean(lock.data && isDemoMutationLock(lock.data.content));
}

/**
 * Inventorie ce qui rendrait une démonstration dangereuse. Seuls les préfixes
 * introduits par cette version font foi pour campagnes et ventes. Les anciennes
 * clés non préfixées ne sont exclues de l'inventaire que si un marqueur actif
 * prouve qu'il s'agit bien d'un scénario hérité ; sinon elles restent réelles.
 */
export async function readDemoIsolation(
  admin: Admin,
  orgId: string,
): Promise<{
  active: boolean;
  legacy: boolean;
  inventory: DemoIsolationInventory;
}> {
  const { active, legacy } = await readDemoModeMarkers(admin, orgId);

  let unknownMetaCampaigns = admin
    .from("ad_metrics")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads");
  if (active) {
    unknownMetaCampaigns = unknownMetaCampaigns.not(
      "campaign_id",
      "like",
      `${DEMO_CAMPAIGN_PREFIX}%`,
    );
    if (legacy) {
      unknownMetaCampaigns = unknownMetaCampaigns.not(
        "campaign_id",
        "in",
        `(${LEGACY_CAMPAIGN_IDS.join(",")})`,
      );
    }
  }

  let unknownStripeRevenue = admin
    .from("revenue_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("source", "stripe");
  if (active) {
    unknownStripeRevenue = unknownStripeRevenue.not(
      "external_id",
      "like",
      `${DEMO_REVENUE_PREFIX}%`,
    );
    if (legacy) {
      for (const pattern of LEGACY_REVENUE_PATTERNS) {
        unknownStripeRevenue = unknownStripeRevenue.not(
          "external_id",
          "like",
          pattern,
        );
      }
    }
  }

  const [
    connectors,
    providerDemoConnectors,
    prospects,
    otherCampaignProviders,
    unknownCampaigns,
    otherRevenueSources,
    unknownRevenue,
    actions,
    outbox,
    briefing,
  ] = await Promise.all([
    admin
      .from("connectors")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .or(`provider.neq.${DEMO_PROVIDER},provider.is.null`),
    admin
      .from("connectors")
      .select("config")
      .eq("organization_id", orgId)
      .eq("provider", DEMO_PROVIDER),
    admin
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .or(`source.neq.${DEMO_PROVIDER},source.is.null`),
    admin
      .from("ad_metrics")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .or("provider.neq.meta_ads,provider.is.null"),
    unknownMetaCampaigns,
    admin
      .from("revenue_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .or("source.neq.stripe,source.is.null"),
    unknownStripeRevenue,
    admin
      .from("actions")
      .select("id, payload, data_sources")
      .eq("organization_id", orgId),
    admin
      .from("outbox_messages")
      .select("id, action_id")
      .eq("organization_id", orgId),
    admin
      .from("briefings")
      .select("stats")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);

  const actionRows = checkedRows(actions, "inventaire des propositions");
  const untrustedDemoConnectors = checkedRows<{ config: unknown }>(
    providerDemoConnectors,
    "inventaire des connecteurs portant le provider réservé",
  ).filter(
    (connector) => !isTrustedDemoConnectorConfig(connector.config),
  ).length;
  const demoActionIds = new Set(
    actionRows
      .filter((action) =>
        isTrustedDemoArtifact(active, isDemoAction(action)),
      )
      .map((action) => action.id),
  );
  const outboxRows = checkedRows(outbox, "inventaire des messages préparés");
  ensureOk(briefing.error, "inventaire du briefing");
  const briefingStats =
    briefing.data?.stats &&
    typeof briefing.data.stats === "object" &&
    !Array.isArray(briefing.data.stats)
      ? (briefing.data.stats as Record<string, unknown>)
      : {};

  return {
    active,
    legacy,
    inventory: {
      realConnectors:
        checkedCount(connectors, "inventaire des connecteurs réels") +
        untrustedDemoConnectors,
      realProspects: checkedCount(prospects, "inventaire des prospects réels"),
      realCampaignRows:
        checkedCount(
          otherCampaignProviders,
          "inventaire des autres fournisseurs de campagnes",
        ) +
        checkedCount(unknownCampaigns, "inventaire des campagnes Meta réelles"),
      realRevenueRows:
        checkedCount(
          otherRevenueSources,
          "inventaire des autres sources de revenu",
        ) +
        checkedCount(unknownRevenue, "inventaire des ventes Stripe réelles"),
      realActions: actionRows.filter((action) => !demoActionIds.has(action.id)).length,
      realOutbox: outboxRows.filter(
        (message) => !demoActionIds.has(message.action_id),
      ).length,
      realBriefings:
        briefing.data &&
        !isTrustedDemoArtifact(
          active,
          briefingStats.demo === true || legacy,
        )
          ? 1
          : 0,
    },
  };
}

export async function assertDemoLoadIsSafe(
  admin: Admin,
  orgId: string,
): Promise<{ active: boolean; legacy: boolean }> {
  const state = await readDemoIsolation(admin, orgId);
  const conflicts = demoIsolationConflicts(state.inventory);
  if (conflicts.length > 0) throw new DemoIsolationError(conflicts);
  return { active: state.active, legacy: state.legacy };
}
