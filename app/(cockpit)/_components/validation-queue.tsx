import { decideAction, runAnalysisNow } from "../actions";

export interface QueueAction {
  id: string;
  title: string;
  finding: string;
  rationale: string;
  data_sources: string[];
  expected_impact: string | null;
  confidence: number | null;
  risk: string;
}

const RISK_LABELS: Record<string, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
};

export function ValidationQueue({
  actions,
  canEdit,
}: {
  actions: QueueAction[];
  canEdit: boolean;
}) {
  if (actions.length === 0) {
    return (
      <div className="px-[22px] py-8 text-center">
        <p className="text-[13.5px] font-medium text-ink">
          Rien à valider pour l&apos;instant
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-muted">
          Synchronisez un connecteur puis lancez l&apos;analyse — l&apos;agent
          proposera ses premières actions ici.
        </p>
        {canEdit && (
          <form action={runAnalysisNow} className="mt-4">
            <button
              type="submit"
              className="rounded-[10px] bg-tint px-4 py-2 text-[13px] font-semibold text-violet transition hover:bg-violet hover:text-white"
            >
              Analyser mes données maintenant
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      {actions.map((a) => (
        <details key={a.id} className="group border-t border-line-soft first:border-t-0">
          <summary className="cursor-pointer px-[22px] py-3.5">
            <span className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-semibold text-ink">{a.title}</span>
              <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet group-open:hidden">
                Examiner
              </span>
            </span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
              {a.finding}
            </span>
          </summary>
          <div className="px-[22px] pb-4">
            <p className="text-[13px] leading-relaxed text-body">
              <b className="text-ink">Pourquoi :</b> {a.rationale}
            </p>
            {a.expected_impact && (
              <p className="mt-1 text-[13px] text-body">
                <b className="text-ink">Impact estimé :</b> {a.expected_impact}
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
              {a.confidence != null && (
                <span className="rounded-full bg-tint px-2.5 py-1 font-semibold text-violet-ink">
                  Confiance {Math.round(a.confidence * 100)} %
                </span>
              )}
              <span className="rounded-full bg-tint-soft px-2.5 py-1 font-semibold text-body">
                {RISK_LABELS[a.risk] ?? a.risk}
              </span>
              {a.data_sources.map((s) => (
                <span key={s} className="rounded-full bg-tint-soft px-2.5 py-1 text-muted">
                  {s}
                </span>
              ))}
            </p>
            {canEdit && (
              <div className="mt-3 flex gap-2">
                {(
                  [
                    ["approve", "Valider", "bg-violet text-white hover:bg-violet-deep"],
                    ["postpone", "Reporter", "bg-tint-soft text-body hover:bg-tint"],
                    ["reject", "Refuser", "bg-red-tint text-red hover:opacity-80"],
                  ] as const
                ).map(([decision, label, cls]) => (
                  <form key={decision} action={decideAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value={decision} />
                    <button
                      type="submit"
                      className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold transition ${cls}`}
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-faint">
              Phase 2 : valider n&apos;exécute rien — l&apos;exécution réelle
              arrive en Phase 3, avec garde-fous.
            </p>
          </div>
        </details>
      ))}
      {canEdit && (
        <div className="border-t border-line-soft px-[22px] py-3">
          <form action={runAnalysisNow}>
            <button
              type="submit"
              className="text-[12px] font-semibold text-violet hover:underline"
            >
              Relancer l&apos;analyse
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
