import type { CampaignObservedKpi } from "./campaign-decision-types";
import { toneTextClass } from "./campaign-evidence";

export function ObservedKpiCard({ kpi }: { kpi: CampaignObservedKpi }) {
  const observation = kpi.observation;
  const help = observation.state === "available"
    ? `Source : ${observation.source.label}`
    : observation.reason;
  return (
    <article className="rounded-[11px] border border-line-soft bg-tint-soft px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
          {kpi.label}
        </h4>
        <span tabIndex={0} title={help} aria-label={`${kpi.label} — ${help}`} className="text-[10px] font-semibold text-violet">?</span>
      </div>
      {observation.state === "available" ? (
        <>
          <p className="mt-1 font-display text-[19px] font-semibold tabular-nums text-ink">
            {observation.value}
          </p>
          {observation.comparison && (
            <p
              className={`mt-0.5 text-[11.5px] font-medium tabular-nums ${toneTextClass(
                observation.comparison.tone,
              )}`}
            >
              {observation.comparison.value}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-[12px] font-semibold text-body">
            {observation.state === "insufficient"
              ? "Données insuffisantes"
              : "Non disponible"}
          </p>
        </>
      )}
    </article>
  );
}
