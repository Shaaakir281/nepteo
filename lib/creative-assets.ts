import { creativeAssetFromRow, type CreativeAsset } from "@/lib/creative-asset-rules";
import { createAdminClient } from "@/lib/supabase/admin";

const CREATIVE_BUCKET = "campaign-creatives";
const SIGNED_URL_SECONDS = 60 * 60;
export const FREE_CREATIVE_PAGE_SIZE = 8;

type AdminClient = ReturnType<typeof createAdminClient>;

async function withSignedUrls(
  admin: AdminClient,
  assets: CreativeAsset[],
): Promise<CreativeAsset[]> {
  return Promise.all(
    assets.map(async (asset) => {
      const { data: signed } = await admin.storage
        .from(CREATIVE_BUCKET)
        .createSignedUrl(asset.storagePath, SIGNED_URL_SECONDS);
      return signed?.signedUrl
        ? { ...asset, imageUrl: signed.signedUrl }
        : asset;
    }),
  );
}

export async function loadCampaignCreativeAssets(
  admin: AdminClient,
  organizationId: string,
  actionIds: string[],
): Promise<CreativeAsset[]> {
  if (actionIds.length === 0) return [];
  const { data, error } = await admin
    .from("creative_assets")
    .select(
      "id, action_id, format, headline, version, status, storage_path, model, created_at",
    )
    .eq("organization_id", organizationId)
    .in("action_id", actionIds)
    .order("version", { ascending: false });
  if (error || !data) return [];

  const assets = data
    .map(creativeAssetFromRow)
    .filter((asset): asset is CreativeAsset => asset !== null);
  return withSignedUrls(admin, assets);
}

export async function loadFreeCreativeAssets(
  admin: AdminClient,
  organizationId: string,
  page = 1,
  pageSize = FREE_CREATIVE_PAGE_SIZE,
): Promise<{
  assets: CreativeAsset[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safePageSize =
    Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 24
      ? pageSize
      : FREE_CREATIVE_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const { data, error, count } = await admin
    .from("creative_assets")
    .select(
      "id, action_id, format, headline, version, status, storage_path, model, created_at",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("action_id", null)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error || !data) {
    return { assets: [], total: 0, page: safePage, pageSize: safePageSize };
  }

  const assets = data
    .map(creativeAssetFromRow)
    .filter((asset): asset is CreativeAsset => asset !== null);
  return {
    assets: await withSignedUrls(admin, assets),
    total: count ?? assets.length,
    page: safePage,
    pageSize: safePageSize,
  };
}

interface AbandonedCreativeRequest {
  id: string;
  organization_id: string;
  storage_path: string;
  status: "reserved" | "failed";
}

export interface CreativeStorageRetentionResult {
  ok: boolean;
  attempted: number;
  removed: number;
  failed: number;
  skipped: number;
  reason?: "retention_unavailable" | "partial_failure";
}

function unavailableCreativeRetention(): CreativeStorageRetentionResult {
  return {
    ok: false,
    attempted: 0,
    removed: 0,
    failed: 0,
    skipped: 0,
    reason: "retention_unavailable",
  };
}

/** Réconcilie les uploads dont le processus s'est arrêté avant la RPC finale. */
export async function purgeAbandonedCreativeObjects(
  admin: AdminClient,
): Promise<CreativeStorageRetentionResult> {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const columns = "id, organization_id, storage_path, status";
    const [failedResult, reservedResult] = await Promise.all([
      admin
        .from("creative_generation_requests")
        .select(columns)
        .eq("status", "failed")
        .not("storage_path", "is", null)
        .order("created_at", { ascending: true })
        .limit(50),
      admin
        .from("creative_generation_requests")
        .select(columns)
        .eq("status", "reserved")
        .not("storage_path", "is", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);
    if (failedResult.error || reservedResult.error) {
      return unavailableCreativeRetention();
    }

    const requests = [
      ...(failedResult.data ?? []),
      ...(reservedResult.data ?? []),
    ].filter(
      (row): row is AbandonedCreativeRequest =>
        typeof row.id === "string" &&
        typeof row.organization_id === "string" &&
        typeof row.storage_path === "string" &&
        (row.status === "reserved" || row.status === "failed"),
    );

    let removed = 0;
    let failed = 0;
    let skipped = 0;
    for (const request of requests) {
      const expectedPrefix = `${request.organization_id}/`;
      if (
        !request.storage_path.startsWith(expectedPrefix) ||
        request.storage_path.includes("..")
      ) {
        failed += 1;
        continue;
      }

      try {
        const { data: claimData, error: claimError } = await admin.rpc(
          "claim_creative_storage_cleanup",
          {
            p_request_id: request.id,
            p_organization_id: request.organization_id,
            p_storage_path: request.storage_path,
          },
        );
        if (claimError || !claimData || typeof claimData !== "object") {
          failed += 1;
          continue;
        }
        if (!("claimed" in claimData) || claimData.claimed !== true) {
          skipped += 1;
          continue;
        }
        const cleanupToken = "token" in claimData ? claimData.token : null;
        if (typeof cleanupToken !== "string" || cleanupToken.length < 32) {
          failed += 1;
          continue;
        }

        const { error: storageError } = await admin.storage
          .from(CREATIVE_BUCKET)
          .remove([request.storage_path]);
        if (storageError) {
          await admin.rpc("finish_creative_storage_cleanup", {
            p_request_id: request.id,
            p_organization_id: request.organization_id,
            p_storage_path: request.storage_path,
            p_cleanup_token: cleanupToken,
            p_removed: false,
          });
          failed += 1;
          continue;
        }
        const { data: finalized, error: finalizeError } = await admin.rpc(
          "finish_creative_storage_cleanup",
          {
            p_request_id: request.id,
            p_organization_id: request.organization_id,
            p_storage_path: request.storage_path,
            p_cleanup_token: cleanupToken,
            p_removed: true,
          },
        );
        if (finalizeError || finalized !== true) {
          failed += 1;
          continue;
        }
        removed += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      ok: failed === 0,
      attempted: requests.length,
      removed,
      failed,
      skipped,
      ...(failed > 0 ? { reason: "partial_failure" as const } : {}),
    };
  } catch {
    return unavailableCreativeRetention();
  }
}

export function creativesByCampaign(
  assets: CreativeAsset[],
): Record<string, CreativeAsset[]> {
  const grouped: Record<string, CreativeAsset[]> = {};
  for (const asset of assets) {
    if (!asset.actionId) continue;
    (grouped[asset.actionId] ??= []).push(asset);
  }
  return grouped;
}
