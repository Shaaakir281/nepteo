"use client";

import Link from "next/link";
import { icons } from "@/components/icons";
import { storyHeadline } from "@/lib/creative-image-rules";
import type { CampaignCreativeSource } from "@/lib/campaign-creative-rules";
import type { CreativeAsset } from "@/lib/creative-asset-rules";
import type { CreativeSuggestion } from "@/lib/creative-template";
import { StoryPreview } from "./story-preview";
import { CreativeAssetGallery } from "./creative-asset-gallery";
import { CreativeStorySettings } from "./creative-story-settings";
import { CreativeSecondaryOptions } from "./creative-secondary-options";
import { useCreativeWorkspace } from "./use-creative-workspace";

export interface CreativeWorkspaceProps {
  canEdit: boolean;
  suggestions: CreativeSuggestion[];
  campaigns: CampaignCreativeSource[];
  initialCreativeAssets: CreativeAsset[];
  initialCampaignId?: string;
  initialFreeMode?: boolean;
  initialFreeAssetTotal?: number;
  initialFreeAssetPage?: number;
  freeAssetPageSize?: number;
}

export function CreativeWorkspace(props: CreativeWorkspaceProps) {
  const workspace = useCreativeWorkspace(props);
  const title = workspace.freeMode
    ? "Création libre"
    : workspace.campaign
      ? `Le visuel de « ${workspace.campaign.title} »`
      : "Préparez une campagne pour créer son visuel";

  return (
    <section className="space-y-5 rounded-[12px] border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[.1em] text-violet">{icons.sparkle} Studio de visuels</p>
          <h2 className="mt-1 font-display text-[21px] font-medium text-ink">{title}</h2>
        </div>
        {!workspace.freeMode && props.campaigns.length > 1 && (
          <button type="button" onClick={() => document.getElementById("creative-campaign")?.focus()} className="rounded-[9px] border border-line px-3 py-2 text-[11.5px] font-semibold text-body">
            Changer de campagne
          </button>
        )}
      </div>

      <StoryPreview
        format={workspace.format}
        headline={storyHeadline(workspace.objective || "Votre message prendra vie ici")}
        image={workspace.image}
        loading={workspace.loading}
      />

      <div className="flex flex-wrap items-center gap-3">
        {workspace.campaign || workspace.freeMode ? (
          <button type="button" onClick={workspace.generate} disabled={!props.canEdit || workspace.campaignLocked || workspace.loading || workspace.objective.trim().length < 3 || (!workspace.freeMode && workspace.campaignAssets.length >= 5)} className="flex items-center gap-2 rounded-[9px] bg-[#8a232d] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#741d25] disabled:cursor-not-allowed disabled:opacity-45">
            {icons.sparkle}
            {workspace.campaignLocked ? "Visuel final" : workspace.loading ? "Création…" : workspace.image ? "Nouvelle version" : "Générer"}
          </button>
        ) : (
          <Link href="/campagnes" className="rounded-[9px] bg-violet px-4 py-2.5 text-[12px] font-semibold text-white">Préparer une campagne</Link>
        )}
        <span className="text-[10.5px] text-faint">
          {workspace.formatLabel}, déduit du canal · aucun visuel publié chez un fournisseur
        </span>
      </div>

      {workspace.error && <p className="rounded-[8px] bg-red-tint px-3 py-2 text-[12px] text-red" role="alert">{workspace.error}</p>}

      <CreativeAssetGallery
        freeMode={workspace.freeMode}
        assets={workspace.campaignAssets}
        total={workspace.freeAssetTotal}
        page={props.initialFreeAssetPage ?? 1}
        pageSize={props.freeAssetPageSize ?? 8}
        canEdit={props.canEdit}
        campaignLocked={workspace.campaignLocked}
        loading={workspace.loading}
        selectingId={workspace.selectingId}
        onSelect={workspace.selectAsset}
      />

      <CreativeStorySettings
        campaigns={props.campaigns}
        campaign={workspace.campaign}
        campaignId={workspace.campaignId}
        freeMode={workspace.freeMode}
        format={workspace.format}
        objective={workspace.objective}
        canEdit={props.canEdit}
        campaignLocked={workspace.campaignLocked}
        loading={workspace.loading}
        onChooseCampaign={workspace.chooseCampaign}
        onFormat={workspace.setFormat}
        onObjective={workspace.setObjective}
      />

      <CreativeSecondaryOptions
        suggestions={props.suggestions}
        campaigns={props.campaigns}
        freeMode={workspace.freeMode}
        loading={workspace.loading}
        onSuggestion={workspace.setObjective}
        onStartFree={workspace.startFree}
        onReturnToCampaign={() => props.campaigns[0] && workspace.chooseCampaign(props.campaigns[0].id)}
      />
    </section>
  );
}
