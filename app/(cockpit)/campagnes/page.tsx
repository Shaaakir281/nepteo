import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { readMemory } from "@/lib/memory-store";
import { campaignBriefDefaultsFromMemory } from "@/lib/campaign-brief-defaults";
import { AnalysisNotice } from "./_components/analysis-notice";
import { CampaignDecisionCockpit } from "./_components/campaign-decision-cockpit";
import { readCampaignPageSnapshot } from "./_lib/campaign-page-query";
import { buildCampaignPageView } from "./_lib/campaign-page-view";
import { scalarSearchParam } from "./_lib/campaign-read-utils";

interface CampaignPageSearchParams {
  proposed?: string | string[];
  channel?: string | string[];
  status?: string | string[];
  prospect?: string | string[];
}

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<CampaignPageSearchParams>;
}) {
  const requested = await searchParams;
  const proposed = scalarSearchParam(requested.proposed);
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canViewFinancials) redirect("/");

  const [snapshot, campaignMemory] = await Promise.all([
    readCampaignPageSnapshot(
      supabase,
      membership.organizationId,
      requested.prospect,
    ),
    readMemory(
      supabase,
      ["activite", "zone", "canaux", "objectifs", "offres", "ton", "philosophie"],
      membership.organizationId,
    ),
  ]);
  const campaignBriefDefaults = campaignBriefDefaultsFromMemory(campaignMemory);
  const model = buildCampaignPageView(
    snapshot,
    requested.channel,
    requested.status,
  );

  return (
    <>
      <h1 className="mb-5 text-[22px] font-semibold tracking-tight">Campagnes</h1>
      <AnalysisNotice proposed={proposed} />
      <CampaignDecisionCockpit
        {...model.view}
        canEdit={membership.canEdit}
        campaignBriefDefaults={campaignBriefDefaults}
        dataState={model.dataState}
        filters={model.filters}
        operationalSummary={model.operationalSummary}
        prospectSearch={model.prospectSearch}
        prospectPresentation={model.prospectPresentation}
        weeklyInsights={model.weeklyInsights}
      />
      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        {model.footerNotice} CAMP-2 ne lance, ne met en pause et ne dépense rien :
        toute recommandation rejoint uniquement la validation Aujourd&apos;hui.
      </p>
    </>
  );
}
