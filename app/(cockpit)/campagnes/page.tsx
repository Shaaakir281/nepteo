import Link from "next/link";
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
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Campagnes</h1>
        {membership.canEdit && (
          <Link
            href="/contenu?libre=1"
            className="rounded-[9px] bg-[#8a232d] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#741d25]"
          >
            Créer une story
          </Link>
        )}
      </header>
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
