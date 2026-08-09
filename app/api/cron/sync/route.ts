import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONNECTOR_SELECT,
  isSyncable,
  syncConnectorRow,
  type ConnectorRow,
} from "@/lib/connectors/sync";
import { runAnalysis } from "@/lib/analysis";
import { withDemoMutationLock } from "@/lib/demo/lock";
import { purgeExpiredWebsitePreviews } from "@/lib/research/website-preview";
import { purgeAbandonedCreativeObjects } from "@/lib/creative-assets";

/**
 * Sync quotidienne de tous les connecteurs configurés (toutes organisations),
 * puis analyse (Phase 2 : propose, n'exécute jamais) sur chaque organisation
 * fraîchement synchronisée. L'acteur est « agent » de bout en bout.
 * Appelée par un scheduler externe avec `Authorization: Bearer CRON_SECRET`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  // Rétention du laboratoire : les analyses de test disparaissent après 30 j.
  // Un échec est rendu honnêtement mais ne bloque pas la sync des connecteurs.
  const [websitePreviewResult, creativeStorageResult] = await Promise.allSettled([
    purgeExpiredWebsitePreviews(admin),
    purgeAbandonedCreativeObjects(admin),
  ]);
  const websitePreviewRetention =
    websitePreviewResult.status === "fulfilled"
      ? websitePreviewResult.value
      : { ok: false as const, reason: "retention_unavailable" as const };
  const creativeStorageRetention =
    creativeStorageResult.status === "fulfilled"
      ? creativeStorageResult.value
      : {
          ok: false as const,
          attempted: 0,
          removed: 0,
          failed: 0,
          skipped: 0,
          reason: "retention_unavailable" as const,
        };
  const { data, error: connectorReadError } = await admin
    .from("connectors")
    .select(CONNECTOR_SELECT)
    .eq("status", "connected");

  const results: {
    provider: string;
    organization_id: string;
    count?: number;
    error?: string;
  }[] = [];
  const syncedOrgs = new Set<string>();

  for (const c of (data ?? []) as ConnectorRow[]) {
    if (!isSyncable(c)) continue;
    try {
      const count = await syncConnectorRow(admin, c, "agent", null);
      results.push({ provider: c.provider, organization_id: c.organization_id, count });
      syncedOrgs.add(c.organization_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erreur inconnue";
      results.push({
        provider: c.provider,
        organization_id: c.organization_id,
        error: msg,
      });
      await admin.from("journal").insert({
        organization_id: c.organization_id,
        event: "connector_sync_failed",
        actor: "agent",
        actor_id: null,
        payload: { provider: c.provider, error: msg },
      });
    }
  }

  // Analyse post-sync : une passe par organisation synchronisée.
  // Acteur « agent » (journal analysis_run + action_proposed). Ne dépend pas
  // du LLM : sans clé, l'habillage retombe sur les templates (cf. runAnalysis).
  const analyzed: { organization_id: string; proposed?: number; error?: string }[] = [];
  for (const orgId of syncedOrgs) {
    try {
      const proposed = await withDemoMutationLock(
        admin,
        orgId,
        "analysis",
        async () => {
          await admin.from("journal").insert({
            organization_id: orgId,
            event: "analysis_run",
            actor: "agent",
            actor_id: null,
            payload: { mode: "auto" },
          });
          return runAnalysis(admin, orgId, null);
        },
      );
      analyzed.push({ organization_id: orgId, proposed });
    } catch (e) {
      analyzed.push({
        organization_id: orgId,
        error: e instanceof Error ? e.message : "erreur inconnue",
      });
    }
  }

  const retentionOk =
    websitePreviewRetention.ok && creativeStorageRetention.ok;
  const connectorsOk =
    !connectorReadError && results.every((result) => !result.error);
  const analysisOk = analyzed.every((result) => !result.error);
  const operationOk = retentionOk && connectorsOk && analysisOk;
  return NextResponse.json(
    {
      ok: operationOk,
      at: new Date().toISOString(),
      connector_read_error: connectorReadError?.message,
      results,
      analyzed,
      website_preview_retention: websitePreviewRetention,
      creative_storage_retention: creativeStorageRetention,
    },
    { status: operationOk ? 200 : 503 },
  );
}
