import type { CampaignDeliveryReading } from "./campaign-decision-types";
import { ReadingEvidence } from "./campaign-evidence";

export function DeliveryDiagnosticPanel({
  diagnostic,
}: {
  diagnostic: CampaignDeliveryReading;
}) {
  const available = diagnostic.state === "available";
  return (
    <section
      aria-labelledby="campaign-delivery-diagnostic-title"
      className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
            Comparaison CPM / CTR
          </p>
          <h3
            id="campaign-delivery-diagnostic-title"
            className="mt-1 font-display text-[15px] font-semibold text-ink"
          >
            Lecture descriptive de la livraison
          </h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            available
              ? "bg-tint-soft text-body"
              : "bg-amber-tint text-amber"
          }`}
        >
          {available ? "Comparaison disponible" : "Comparaison indisponible"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <p className="text-[12.5px] leading-relaxed text-body">
            {diagnostic.summary}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            {diagnostic.disclaimer}
          </p>
        </div>
        <ReadingEvidence reading={diagnostic} prominent />
      </div>
    </section>
  );
}
