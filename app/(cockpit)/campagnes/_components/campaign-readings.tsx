import type { CampaignDecisionRow } from "./campaign-decision-types";
import { ReadingEvidence } from "./campaign-evidence";

export function CampaignReadings({ campaign }: { campaign: CampaignDecisionRow }) {
  const deliveryAvailable = campaign.deliveryDiagnostic.state === "available";
  return (
    <div
      role="group"
      aria-label={`Lectures descriptives pour ${campaign.name}`}
      className="space-y-3"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-faint">
          Performance observée
        </p>
        {campaign.agentReading ? (
          <>
            <p className="mt-1 text-[11.5px] leading-relaxed text-body">
              {campaign.agentReading.summary}
            </p>
            <ReadingEvidence reading={campaign.agentReading} />
          </>
        ) : (
          <p className="mt-1 text-[11px] text-muted">
            Aucune lecture de performance étayée.
          </p>
        )}
      </div>

      <div className="border-t border-line-soft pt-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-faint">
            Livraison CPM / CTR
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
              deliveryAvailable
                ? "bg-white text-body"
                : "bg-amber-tint text-amber"
            }`}
          >
            {deliveryAvailable ? "Disponible" : "Indisponible"}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-body">
          {campaign.deliveryDiagnostic.summary}
        </p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
          {campaign.deliveryDiagnostic.disclaimer}
        </p>
        <ReadingEvidence reading={campaign.deliveryDiagnostic} />
      </div>
    </div>
  );
}
