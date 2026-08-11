import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { readMemory } from "@/lib/memory-store";
import { memoText } from "@/lib/draft-template";
import { computeFunnelStats } from "@/lib/analysis-rules";
import {
  deriveKpis,
  rollupByCampaign,
  windowBounds,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";
import { buildCreativeSuggestions } from "@/lib/creative-template";
import {
  campaignCreativeSource,
  type CampaignCreativeSource,
} from "@/lib/campaign-creative-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_CREATIVE_PAGE_SIZE,
  loadCampaignCreativeAssets,
  loadFreeCreativeAssets,
} from "@/lib/creative-assets";
import { CreativeWorkspace } from "./_components/creative-workspace";
import {
  createSupabaseProspectReader,
  DEFAULT_PROSPECT_MAX_ROWS,
  loadProspectCohort,
} from "@/lib/prospect-cohort-loader";

export default async function ContenuPage({
  searchParams,
}: {
  searchParams: Promise<{
    campagne?: string;
    libre?: string;
    creatives_page?: string;
  }>;
}) {
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  const canEdit = membership.canEdit;
  const params = await searchParams;

  // Idées proposées par l'agent, à partir de ce qu'il sait déjà.
  const memCtx = await readMemory(supabase, ["offres", "activite"]);
  const offre = memoText(memCtx, "offres") || memoText(memCtx, "activite");

  const today = new Date().toISOString().slice(0, 10);
  const prospectCohort = await loadProspectCohort(
    createSupabaseProspectReader(supabase),
    { maxRows: DEFAULT_PROSPECT_MAX_ROWS },
  );
  const stats =
    prospectCohort.status === "complete"
      ? computeFunnelStats(prospectCohort.canonicalRows, today)
      : null;

  const { data: adRows } = membership.canViewFinancials
    ? await supabase
        .from("ad_metrics")
        .select(
          "campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue",
        )
        .eq("provider", "meta_ads")
        .gte("date", windowBounds().currentFrom)
    : { data: [] };
  const losingCampaigns = rollupByCampaign(
    (adRows ?? []).map((r) => ({
      ...r,
      spend: Number(r.spend),
      revenue: Number(r.revenue),
    })) as CampaignMetric[],
  )
    .map(deriveKpis)
    .filter((c) => c.spend >= 50 && c.roas < 1)
    .map((c) => c.campaign_name);

  const suggestions = buildCreativeSuggestions({
    offre,
    priorityCount: stats?.priority,
    losingCampaigns,
  });

  const campaignColumns = "id, kind, title, status, payload";
  const [{ data: activeCampaignRows }, { data: approvedCampaignRows }] =
    await Promise.all([
      supabase
        .from("actions")
        .select(campaignColumns)
        .eq("kind", "launch_campaign")
        .in("status", ["proposed", "postponed"])
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("actions")
        .select(campaignColumns)
        .eq("kind", "launch_campaign")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
  const requestedCampaignId = z.string().uuid().safeParse(params.campagne).data;
  const recentRows = [...(activeCampaignRows ?? []), ...(approvedCampaignRows ?? [])];
  let requestedCampaignRow: (typeof recentRows)[number] | null = null;
  if (
    requestedCampaignId &&
    !recentRows.some((row) => row.id === requestedCampaignId)
  ) {
    const { data } = await supabase
      .from("actions")
      .select(campaignColumns)
      .eq("id", requestedCampaignId)
      .eq("kind", "launch_campaign")
      .in("status", ["proposed", "postponed", "approved"])
      .maybeSingle();
    requestedCampaignRow = data;
  }
  const campaignRows = [
    ...recentRows,
    ...(requestedCampaignRow ? [requestedCampaignRow] : []),
  ].filter(
    (row, index, rows) => rows.findIndex((item) => item.id === row.id) === index,
  );
  const candidateCampaigns = campaignRows
    .map(campaignCreativeSource)
    .filter((campaign): campaign is CampaignCreativeSource => campaign !== null)
    .sort(
      (left, right) =>
        Number(left.status === "approved") - Number(right.status === "approved"),
    );
  const admin = createAdminClient();
  const requestedFreePage = Number(params.creatives_page);
  const freePage =
    Number.isSafeInteger(requestedFreePage) && requestedFreePage > 0
      ? Math.min(requestedFreePage, 10_000)
      : 1;
  const [campaignAssets, freeAssetsPage] = await Promise.all([
    loadCampaignCreativeAssets(
      admin,
      membership.organizationId,
      candidateCampaigns.map((campaign) => campaign.id),
    ),
    membership.canViewFinancials
      ? loadFreeCreativeAssets(admin, membership.organizationId, freePage)
      : Promise.resolve({
          assets: [],
          total: 0,
          page: 1,
          pageSize: FREE_CREATIVE_PAGE_SIZE,
        }),
  ]);
  const campaigns = candidateCampaigns;
  const creativeAssets = [...campaignAssets, ...freeAssetsPage.assets];

  return (
    <>
      <div className="mb-5">
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#8a232d]">
          Créer
        </p>
        <h1 className="font-display text-[27px] font-light tracking-[-.02em] text-ink">
          Atelier Story
        </h1>
        <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-muted">
          La campagne récente, son message et son format conseillé sont déjà
          sélectionnés. Chaque génération reste explicite ; rien n&apos;est publié.
        </p>
      </div>

      {prospectCohort.status !== "complete" && (
        <div className="mb-4 rounded-[13px] border border-line-soft bg-tint-soft px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          Suggestions chiffrées liées aux prospects suspendues : la cohorte
          dédoublonnée complète est indisponible
          {prospectCohort.status === "partial"
            ? ` au-delà de ${prospectCohort.maxRows.toLocaleString("fr-FR")} lignes importées`
            : ""}
          . Aucun total partiel n&apos;est utilisé.
        </div>
      )}

      <CreativeWorkspace
        canEdit={canEdit}
        suggestions={suggestions}
        campaigns={campaigns}
        initialCreativeAssets={creativeAssets}
        initialCampaignId={params.campagne}
        initialFreeMode={params.libre === "1"}
        initialFreeAssetTotal={freeAssetsPage.total}
        initialFreeAssetPage={freeAssetsPage.page}
        freeAssetPageSize={freeAssetsPage.pageSize}
      />
    </>
  );
}
