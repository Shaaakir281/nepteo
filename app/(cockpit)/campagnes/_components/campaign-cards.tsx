import type { CampaignDecisionRow } from "./campaign-decision-types";
import { EvidenceReference, StatusBadge, StatusEvidence } from "./campaign-evidence";
import { MetricDefinition } from "./campaign-metric-definition";
import { CampaignReadings } from "./campaign-readings";

export function CampaignCards({ campaigns }: { campaigns: CampaignDecisionRow[] }) {
  return (
    <ul className="divide-y divide-line-soft xl:hidden">
      {campaigns.map((campaign) => (
        <li key={campaign.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-[13.5px] font-semibold text-ink">
                {campaign.name}
              </h4>
              <p className="mt-0.5 text-[11px] text-muted">
                {campaign.channel.label}
              </p>
            </div>
            <StatusBadge status={campaign.status} />
          </div>
          <StatusEvidence evidence={campaign.status.evidence} />

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {[
              campaign.spend,
              campaign.acquisitionCost,
              campaign.results,
              campaign.revenue,
              campaign.roas,
              campaign.cpm,
              campaign.ctr,
            ].map((metric) => (
              <MetricDefinition key={metric.label} metric={metric} />
            ))}
          </dl>

          <div className="mt-3 rounded-[10px] bg-tint-soft px-3 py-2.5">
            <CampaignReadings campaign={campaign} />
          </div>

          {campaign.source ? (
            <EvidenceReference source={campaign.source} className="mt-2" />
          ) : (
            <p className="mt-2 text-[10px] text-red">
              Source de mesure non disponible
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
