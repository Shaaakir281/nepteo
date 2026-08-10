import type { CampaignDecisionRow } from "./campaign-decision-types";
import { EvidenceReference, StatusBadge, StatusEvidence } from "./campaign-evidence";
import { MetricTableCell } from "./campaign-metric-table-cell";
import { CampaignReadings } from "./campaign-readings";

export function CampaignTable({ campaigns }: { campaigns: CampaignDecisionRow[] }) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[1480px] text-[12px]">
        <caption className="sr-only">
          Campagnes filtrées, performance observée, CPM, CTR et lectures
          descriptives
        </caption>
        <thead>
          <tr className="border-b border-line-soft text-left text-[10.5px] uppercase tracking-[.06em] text-faint">
            <th scope="col" className="px-[22px] py-2.5 font-semibold">
              Campagne
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              État
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Dépense
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Coût / conversion
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Résultats
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Revenu
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              ROAS
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              CPM
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              CTR
            </th>
            <th scope="col" className="px-[22px] py-2.5 font-semibold">
              Lectures descriptives
            </th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.id}
              className="border-b border-line-soft align-top last:border-b-0"
            >
              <th
                scope="row"
                className="px-[22px] py-3 text-left font-normal"
              >
                <p className="font-semibold text-ink">{campaign.name}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {campaign.channel.label}
                </p>
                {campaign.source ? (
                  <EvidenceReference source={campaign.source} className="mt-1" />
                ) : (
                  <p className="mt-1 text-[10px] text-red">
                    Source de mesure non disponible
                  </p>
                )}
              </th>
              <td className="px-3 py-3">
                <StatusBadge status={campaign.status} />
                <StatusEvidence evidence={campaign.status.evidence} />
              </td>
              <MetricTableCell metric={campaign.spend} />
              <MetricTableCell metric={campaign.acquisitionCost} />
              <MetricTableCell metric={campaign.results} />
              <MetricTableCell metric={campaign.revenue} />
              <MetricTableCell metric={campaign.roas} emphasize />
              <MetricTableCell metric={campaign.cpm} />
              <MetricTableCell metric={campaign.ctr} />
              <td className="max-w-[360px] px-[22px] py-3">
                <CampaignReadings campaign={campaign} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
