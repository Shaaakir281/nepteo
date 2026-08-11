import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEMO_CAMPAIGN_PREFIX,
  DEMO_PROVIDER,
  DEMO_REVENUE_PREFIX,
  isConnectorRequestPlaceholder,
  isTrustedDemoConnectorConfig,
} from "@/lib/demo/isolation-rules";
import { DEMO_BACKUP_SECTION } from "@/lib/demo/memory-backup-rules";
import {
  certifiedDemoCounts,
  classifyDemoPresentation,
  isCertifiedDemoConnectorConfig,
  type DemoPresentation,
  type DemoPresentationEvidence,
} from "@/lib/demo/presentation-rules";

export interface DemoPresentationSnapshot {
  presentation: DemoPresentation;
  hasDemoMarker: boolean;
  evidence: DemoPresentationEvidence;
}

/**
 * Lecture serveur unique et mise en cache pour toute la requête RSC.
 *
 * Le layout et l'onglet Connecteurs partagent ainsi exactement la même preuve
 * sans répéter leurs COUNT. Toute erreur de lecture échoue vers le libellé
 * prudent « Environnement de test » et maintient les connexions bloquées.
 */
export const readDemoPresentation = cache(
  async (organizationId: string): Promise<DemoPresentationSnapshot> => {
    const admin = createAdminClient();
    const [
      backupResult,
      connectorsResult,
      demoProspectsResult,
      nonDemoProspectsResult,
      campaignTotalResult,
      demoCampaignResult,
      revenueTotalResult,
      demoRevenueResult,
    ] = await Promise.all([
      admin
        .from("company_memory")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("section", DEMO_BACKUP_SECTION),
      admin
        .from("connectors")
        .select("provider, status, config")
        .eq("organization_id", organizationId),
      admin
        .from("prospects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("source", DEMO_PROVIDER),
      admin
        .from("prospects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .or(`source.neq.${DEMO_PROVIDER},source.is.null`),
      admin
        .from("ad_metrics")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      admin
        .from("ad_metrics")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("provider", "meta_ads")
        .like("campaign_id", `${DEMO_CAMPAIGN_PREFIX}%`),
      admin
        .from("revenue_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      admin
        .from("revenue_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("source", "stripe")
        .like("external_id", `${DEMO_REVENUE_PREFIX}%`),
    ]);

    const rows = connectorsResult.data ?? [];
    const trustedRows = rows.filter(
      (row) =>
        row.provider === DEMO_PROVIDER &&
        isTrustedDemoConnectorConfig(row.config),
    );
    const certifiedRows = trustedRows.filter((row) =>
      isCertifiedDemoConnectorConfig(row.config),
    );
    const totalCampaigns = campaignTotalResult.count ?? 0;
    const demoCampaigns = demoCampaignResult.count ?? 0;
    const totalRevenue = revenueTotalResult.count ?? 0;
    const demoRevenue = demoRevenueResult.count ?? 0;
    const evidenceComplete = [
      backupResult,
      connectorsResult,
      demoProspectsResult,
      nonDemoProspectsResult,
      campaignTotalResult,
      demoCampaignResult,
      revenueTotalResult,
      demoRevenueResult,
    ].every((result) => !result.error);

    const evidence: DemoPresentationEvidence = {
      evidenceComplete,
      backups: backupResult.count ?? 0,
      trustedDemoConnectors: trustedRows.length,
      certifiedDemoConnectors: certifiedRows.length,
      certifiedCounts:
        certifiedRows.length === 1
          ? certifiedDemoCounts(certifiedRows[0].config)
          : null,
      demoProspects: demoProspectsResult.count ?? 0,
      nonDemoConnectors: rows.filter(
        (row) =>
          (row.provider !== DEMO_PROVIDER ||
            !isTrustedDemoConnectorConfig(row.config)) &&
          !isConnectorRequestPlaceholder(row.status, row.config),
      ).length,
      nonDemoProspects: nonDemoProspectsResult.count ?? 0,
      demoCampaignRows: demoCampaigns,
      nonDemoCampaignRows: Math.max(0, totalCampaigns - demoCampaigns),
      demoRevenueRows: demoRevenue,
      nonDemoRevenueRows: Math.max(0, totalRevenue - demoRevenue),
    };

    return {
      presentation: classifyDemoPresentation(evidence),
      hasDemoMarker:
        !evidenceComplete ||
        evidence.backups > 0 ||
        evidence.trustedDemoConnectors > 0 ||
        evidence.demoProspects > 0,
      evidence,
    };
  },
);
