import type { CampaignOperationalSummary as CampaignOperationalSummaryData } from "./campaign-decision-types";

export function OperationalSummary({
  summary,
}: {
  summary: CampaignOperationalSummaryData;
}) {
  return (
    <section
      aria-labelledby="campaign-operational-summary-title"
      className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card sm:p-5"
    >
      <div>
        <h3
          id="campaign-operational-summary-title"
          className="font-display text-[15px] font-semibold text-ink"
        >
          Résumé opérationnel
        </h3>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          Contrôles persistés et inventaire relus pour cette organisation ;
          aucun état d&apos;activité n&apos;est simulé.
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[summary.agent, summary.connectors, summary.lastAnalysis].map((fact) => (
          <article
            key={fact.label}
            className="rounded-[12px] border border-line-soft bg-tint-soft/40 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-faint">
                {fact.label}
              </h4>
              <span
                className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.04em] ${
                  fact.state === "available"
                    ? "bg-green-tint text-green"
                    : "bg-amber-tint text-amber"
                }`}
              >
                {fact.state === "available" ? "Persisté" : "Indisponible"}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-ink">
              {fact.value}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {fact.detail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
