"use client";

import { useState } from "react";
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

const DECISIONS = [
  ["approve", "Valider", "bg-violet text-white hover:bg-violet-deep"],
  ["postpone", "Reporter", "bg-tint-soft text-body hover:bg-tint"],
  ["reject", "Refuser", "bg-red-tint text-red hover:opacity-80"],
] as const;

function DecisionButtons({ id }: { id: string }) {
  return (
    <div className="flex gap-2">
      {DECISIONS.map(([decision, label, cls]) => (
        <form key={decision} action={decideAction}>
          <input type="hidden" name="id" value={id} />
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
  );
}

export function ValidationQueue({
  actions,
  canEdit,
}: {
  actions: QueueAction[];
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = actions.find((a) => a.id === openId) ?? null;

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
        <button
          key={a.id}
          type="button"
          onClick={() => setOpenId(a.id)}
          className="block w-full border-t border-line-soft px-[22px] py-3.5 text-left transition hover:bg-tint-soft first:border-t-0"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink">
              {a.title}
            </span>
            <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet">
              Examiner
            </span>
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
            {a.finding}
          </span>
        </button>
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

      {/* Tiroir de raisonnement (maquette docs/maquettes/) */}
      <div
        onClick={() => setOpenId(null)}
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity ${
          active ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label="Raisonnement de l'agent"
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(440px,94vw)] flex-col bg-white shadow-[-20px_0_60px_rgba(25,23,49,.18)] transition-transform duration-300 ${
          active ? "translate-x-0" : "translate-x-[105%]"
        }`}
      >
        {active && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-line-soft px-6 py-5">
              <h3 className="text-[15.5px] font-semibold leading-snug text-ink">
                {active.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="flex-none px-2 py-1 text-[15px] text-muted hover:text-ink"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-1">
              <Section label="Constat détaillé" />
              <p className="text-[13px] leading-relaxed text-body">
                {active.finding}
              </p>

              <Section label="Pourquoi cette action" />
              <p className="text-[13px] leading-relaxed text-body">
                {active.rationale}
              </p>

              <Section label="Données utilisées" />
              {active.data_sources.map((s) => (
                <div
                  key={s}
                  className="flex items-start gap-2.5 border-b border-line-soft py-2.5 text-[12.5px] leading-relaxed text-body last:border-b-0"
                >
                  <i className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-violet" />
                  {s}
                </div>
              ))}

              {active.expected_impact && (
                <>
                  <Section label="Impact estimé" />
                  <p className="text-[13px] leading-relaxed text-body">
                    {active.expected_impact}
                  </p>
                </>
              )}

              <div className="mt-4 flex items-center gap-3 rounded-[13px] border border-line-soft bg-tint-soft px-4 py-3.5">
                <span className="font-display text-[22px] font-semibold text-violet-ink">
                  {active.confidence != null
                    ? `${Math.round(active.confidence * 100)} %`
                    : "—"}
                </span>
                <p className="text-[12px] leading-snug text-body">
                  Confiance de l&apos;agent · {RISK_LABELS[active.risk] ?? active.risk}.
                  Estimation calibrée sur vos propres données.
                </p>
              </div>
            </div>

            {canEdit && (
              <div className="border-t border-line-soft px-6 py-4">
                <DecisionButtons id={active.id} />
                <p className="mt-2.5 text-[11px] text-faint">
                  Phase 2 : valider n&apos;exécute rien — l&apos;exécution réelle
                  arrive en Phase 3, avec garde-fous.
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <p className="mb-2 mt-[18px] text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
      {label}
    </p>
  );
}
