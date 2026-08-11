import type {
  CampaignDeliveryReading,
  CampaignOperationalSummary as CampaignOperationalSummaryData,
  CampaignProspectSearch,
} from "./campaign-decision-types";
import { DeliveryDiagnosticPanel } from "./campaign-delivery-panel";
import { OperationalSummary } from "./campaign-operational-summary";
import { ProspectSearchPanel } from "./campaign-prospect-search";

const summaryClass =
  "flex cursor-pointer items-center gap-2 py-3 text-[12.5px] font-semibold text-ink";

export function CampaignDecisionDetails({
  operationalSummary,
  prospectSearch,
  prospectPresentation,
  prospectSearchId,
  channel,
  status,
  deliveryDiagnostic,
  onClearProspectSearch,
}: {
  operationalSummary: CampaignOperationalSummaryData;
  prospectSearch: CampaignProspectSearch;
  prospectPresentation: string;
  prospectSearchId: string;
  channel: string | null;
  status: string | null;
  deliveryDiagnostic: CampaignDeliveryReading | null;
  onClearProspectSearch: () => void;
}) {
  return (
    <div className="mt-4 divide-y divide-line-soft border-y border-line-soft">
      <details>
        <summary className={summaryClass}>
          <span aria-hidden="true">›</span>
          Ce que Nepteo a vérifié
          <b className="ml-auto rounded-full bg-tint-soft px-2 py-0.5 text-[10px] text-muted">3</b>
        </summary>
        <div className="pb-4">
          <OperationalSummary summary={operationalSummary} />
          <p className="mt-2 text-[11px] text-faint">
            Un démarrage journalisé n&apos;est pas un succès fournisseur.
          </p>
        </div>
      </details>
      <details>
        <summary className={summaryClass}>
          <span aria-hidden="true">›</span>
          Prospects synchronisés
          <b className="ml-auto rounded-full bg-tint-soft px-2 py-0.5 text-[10px] text-muted">
            {prospectSearch.results.length}
          </b>
        </summary>
        <div className="pb-4">
          <ProspectSearchPanel
            search={prospectSearch}
            presentation={prospectPresentation}
            inputId={prospectSearchId}
            channel={channel}
            status={status}
            onClear={onClearProspectSearch}
          />
        </div>
      </details>
      <details>
        <summary className={summaryClass}>
          <span aria-hidden="true">›</span>
          Lecture descriptive CPM / CTR
        </summary>
        <div className="pb-4">
          {deliveryDiagnostic ? (
            <DeliveryDiagnosticPanel diagnostic={deliveryDiagnostic} />
          ) : (
            <p className="text-[11.5px] text-muted">Aucune comparaison disponible.</p>
          )}
        </div>
      </details>
    </div>
  );
}
