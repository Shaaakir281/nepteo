import type { CampaignDecisionRow } from "./campaign-decision-types";
import { CampaignCards } from "./campaign-cards";
import { InlineEmptyState } from "./campaign-evidence";
import { CampaignTable } from "./campaign-table";

export function CampaignMeasuredList({
  campaigns,
  visibleCampaigns,
}: {
  campaigns: CampaignDecisionRow[];
  visibleCampaigns: CampaignDecisionRow[];
}) {
  return (
    <section aria-labelledby="campaigns-measured-title" className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card">
      <div className="flex items-end justify-between gap-2 border-b border-line-soft px-4 py-4 sm:px-[22px]">
        <h3 id="campaigns-measured-title" className="font-display text-[15px] font-semibold text-ink">
          Campagnes mesurées
        </h3>
        <p className="text-[11px] tabular-nums text-faint" aria-live="polite">
          {visibleCampaigns.length} résultat{visibleCampaigns.length > 1 ? "s" : ""}
        </p>
      </div>
      {visibleCampaigns.length === 0 ? (
        <div className="px-4 py-7 sm:px-[22px]">
          <InlineEmptyState>
            {campaigns.length === 0
              ? "Aucune campagne observée n’est disponible pour cette période."
              : "Aucune campagne ne correspond à ces filtres."}
          </InlineEmptyState>
        </div>
      ) : (
        <>
          <CampaignTable campaigns={visibleCampaigns} />
          <CampaignCards campaigns={visibleCampaigns} />
        </>
      )}
    </section>
  );
}
