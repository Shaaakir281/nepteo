import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { readMemory } from "@/lib/memory-store";
import { campaignBriefDefaultsFromMemory } from "@/lib/campaign-brief-defaults";
import { AnalysisNotice } from "./_components/analysis-notice";
import { CampaignDecisionCockpit } from "./_components/campaign-decision-cockpit";
import { NewCampaignModal } from "./_components/new-campaign-modal";
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
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Campagnes</h1>
        {membership.canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <NewCampaignModal initialDraft={campaignBriefDefaults} />
            <Link
              href="/contenu?libre=1"
              className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[12px] font-semibold text-body transition hover:bg-tint-soft hover:text-ink"
            >
              Créer un visuel
            </Link>
          </div>
        )}
      </header>
      <AnalysisNotice proposed={proposed} />
      <CampaignDecisionCockpit
        {...model.view}
        canEdit={membership.canEdit}
        dataState={model.dataState}
        filters={model.filters}
        operationalSummary={model.operationalSummary}
        prospectSearch={model.prospectSearch}
        prospectPresentation={model.prospectPresentation}
        weeklyInsights={model.weeklyInsights}
        budgetResults={model.budgetResults}
      />
      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        {model.footerNotice} CAMP-2 ne lance, ne met en pause et ne dépense rien :
        toute recommandation rejoint uniquement la validation Aujourd&apos;hui.
      </p>
    </>
  );
}
