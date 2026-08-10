import type {
  FalsePositiveReason,
  ValueEventEditLevel,
  ValueEventType,
} from "@/lib/value-events-rules";
import {
  EDIT_LEVELS,
  FALSE_POSITIVE_OPTIONS,
  OUTCOMES,
} from "./action-value-feedback-options";

type SubmitFeedback = (
  eventType: ValueEventType,
  details?: {
    falsePositiveReason?: FalsePositiveReason;
    editLevel?: ValueEventEditLevel;
  },
) => void;

const buttonClass =
  "rounded-[9px] border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-body transition hover:border-violet hover:text-violet disabled:cursor-not-allowed disabled:opacity-50";

export function ActionValueFeedbackFields({
  showEvaluation,
  showDraft,
  showOutcomes,
  busy,
  falsePositiveReason,
  setFalsePositiveReason,
  recordedOutcomes,
  submit,
}: {
  showEvaluation: boolean;
  showDraft: boolean;
  showOutcomes: boolean;
  busy: boolean;
  falsePositiveReason: FalsePositiveReason;
  setFalsePositiveReason: (reason: FalsePositiveReason) => void;
  recordedOutcomes: ReadonlySet<ValueEventType>;
  submit: SubmitFeedback;
}) {
  return (
    <>
      {showEvaluation && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12.5px] font-medium text-ink">C&apos;était utile ?</span>
          <button type="button" disabled={busy} onClick={() => submit("suggestion_useful")} className={buttonClass}>Oui</button>
          <button type="button" disabled={busy} onClick={() => submit("suggestion_not_useful")} className={buttonClass}>Non</button>
          <span className="ml-auto text-[10.5px] text-faint">Reste dans votre organisation</span>
        </div>
      )}

      {(showEvaluation || showDraft || showOutcomes) && (
        <details className="mt-2 rounded-[10px] border border-line-soft bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] font-semibold text-muted">
            Préciser
          </summary>
          <div className="space-y-3 border-t border-line-soft px-3 py-3">
            {showEvaluation && (
              <fieldset>
                <legend className="text-[10.5px] font-semibold text-faint">Faux positif</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <select
                    aria-label="Motif du faux positif"
                    value={falsePositiveReason}
                    disabled={busy}
                    onChange={(event) => setFalsePositiveReason(event.target.value as FalsePositiveReason)}
                    className="min-w-0 rounded-[9px] border border-line px-2.5 py-1.5 text-[11.5px] text-body"
                  >
                    {FALSE_POSITIVE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="button" disabled={busy} onClick={() => submit("false_positive", { falsePositiveReason })} className={buttonClass}>Enregistrer</button>
                </div>
              </fieldset>
            )}
            {showDraft && (
              <fieldset>
                <legend className="text-[10.5px] font-semibold text-faint">Retouche du brouillon</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {EDIT_LEVELS.map((level) => (
                    <button key={level.value} type="button" disabled={busy} onClick={() => submit("draft_reviewed", { editLevel: level.value })} className={buttonClass}>{level.label}</button>
                  ))}
                </div>
              </fieldset>
            )}
            {showOutcomes && (
              <fieldset>
                <legend className="text-[10.5px] font-semibold text-faint">Résultat déclaré</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {OUTCOMES.map((outcome) => (
                    <button
                      key={outcome.value}
                      type="button"
                      disabled={busy || recordedOutcomes.has(outcome.value)}
                      onClick={() => submit(outcome.value)}
                      className={buttonClass}
                    >
                      {recordedOutcomes.has(outcome.value) ? `${outcome.label} ✓` : outcome.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <p className="text-[10.5px] leading-relaxed text-faint">
              Les déclarations n&apos;envoient aucun message et ne changent jamais le statut de l&apos;outbox.
            </p>
          </div>
        </details>
      )}
    </>
  );
}
