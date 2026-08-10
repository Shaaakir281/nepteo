import type { ValueScorecard as ValueScorecardData } from "@/lib/value-scorecard-rules";
import { ValueScorecardDetails } from "./value-scorecard-details";
import { formatRate, Metric } from "./value-scorecard-metrics";

export function ValueScorecard({
  scorecard,
}: {
  scorecard: ValueScorecardData;
}) {
  return (
    <section aria-labelledby="value-scorecard-title" className="rounded-[18px] border border-line-soft bg-tint-soft/40 p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">Pilote prospects dormants</p>
          <h2 id="value-scorecard-title" className="mt-1 font-display text-[16px] font-semibold text-ink">Preuve terrain déclarée</h2>
        </div>
        <span className="text-[11px] text-faint">30 derniers jours</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Examinées" value={scorecard.recommendations.examined} />
        <Metric label="Jugées utiles" value={formatRate(scorecard.recommendations.usefulRate)} />
        <Metric label="Réponses" value={scorecard.outcomes.replies.total} />
      </div>

      <details className="mt-3 rounded-[11px] border border-line-soft bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-[12px] font-semibold text-ink">
          Toutes les métriques <span className="float-right text-[10.5px] text-faint">9 détails</span>
        </summary>
        <ValueScorecardDetails scorecard={scorecard} />
      </details>
    </section>
  );
}
