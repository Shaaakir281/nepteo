"use client";

import { useId, useRef } from "react";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { isRelanceKind } from "@/lib/draft-template";
import { decideAction } from "../actions";
import { ActionDraftEditor } from "./action-draft-editor";
import { ActionValueFeedback } from "./action-value-feedback";
import { CampaignDetails } from "./campaign-details";
import { ProspectDrafts } from "./prospect-drafts";
import { ValidationSection } from "./validation-section";

export interface QueueAction {
  id: string;
  kind: string;
  title: string;
  finding: string;
  rationale: string;
  data_sources: string[];
  expected_impact: string | null;
  confidence: number | null;
  risk: string;
  payload?: Record<string, unknown> | null;
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

export function ValidationDrawer({
  action,
  canEdit,
  onClose,
}: {
  action: QueueAction | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useDialogFocus({
    open: action !== null,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  return (
    <>
      {/* Tiroir de raisonnement (maquette docs/maquettes/) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity ${
          action ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={action ? undefined : true}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(440px,94vw)] flex-col bg-white shadow-[-20px_0_60px_rgba(25,23,49,.18)] transition-transform duration-300 ${
          action ? "translate-x-0" : "translate-x-[105%]"
        }`}
      >
        {action && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-line-soft px-6 py-5">
              <h3
                id={titleId}
                className="text-[15.5px] font-semibold leading-snug text-ink"
              >
                {action.title}
              </h3>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="flex-none px-2 py-1 text-[15px] text-muted hover:text-ink"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-1">
              <ValidationSection label="Constat détaillé" />
              <p className="text-[13px] leading-relaxed text-body">
                {action.finding}
              </p>

              <ValidationSection label="Pourquoi cette action" />
              <p className="text-[13px] leading-relaxed text-body">
                {action.rationale}
              </p>

              <ValidationSection label="Données utilisées" />
              {action.data_sources.map((source) => (
                <div
                  key={source}
                  className="flex items-start gap-2.5 border-b border-line-soft py-2.5 text-[12.5px] leading-relaxed text-body last:border-b-0"
                >
                  <i className="mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-violet" />
                  {source}
                </div>
              ))}

              {action.expected_impact && (
                <>
                  <ValidationSection label="Impact estimé" />
                  <p className="text-[13px] leading-relaxed text-body">
                    {action.expected_impact}
                  </p>
                </>
              )}

              <div className="mt-4 flex items-center gap-3 rounded-[13px] border border-line-soft bg-tint-soft px-4 py-3.5">
                <span className="font-display text-[22px] font-semibold text-violet-ink">
                  {action.confidence != null
                    ? `${Math.round(action.confidence * 100)} %`
                    : "—"}
                </span>
                <p className="text-[12px] leading-snug text-body">
                  Confiance de l&apos;agent ·{" "}
                  {RISK_LABELS[action.risk] ?? action.risk}. Estimation calibrée
                  sur vos propres données.
                </p>
              </div>

              {canEdit && !isRelanceKind(action.kind) && (
                <ActionValueFeedback
                  key={`value-${action.id}`}
                  actionId={action.id}
                  mode="evaluation"
                />
              )}

              {action.kind === "launch_campaign" && (
                <CampaignDetails payload={action.payload} />
              )}

              {isRelanceKind(action.kind) && (
                <>
                  <ActionDraftEditor
                    key={action.id}
                    id={action.id}
                    canEdit={canEdit}
                  />
                  <ValidationSection label="Personnaliser par prospect" />
                  <p className="mb-1 text-[11.5px] leading-relaxed text-muted">
                    Un message individuel, appuyé sur les notes et les infos de
                    chaque contact.
                  </p>
                  <ProspectDrafts
                    key={action.id}
                    actionId={action.id}
                    canEdit={canEdit}
                  />
                  {canEdit && (
                    <ActionValueFeedback
                      key={`value-${action.id}`}
                      actionId={action.id}
                      mode="evaluation"
                      includeDraft
                    />
                  )}
                </>
              )}
            </div>

            {canEdit && (
              <div className="border-t border-line-soft px-6 py-4">
                <DecisionButtons id={action.id} />
                <p className="mt-2.5 text-[11px] text-faint">
                  Après validation, vous pourrez demander la préparation sous
                  garde-fous. Aucun envoi externe.
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
