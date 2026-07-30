"use client";

import { useRef, useState } from "react";
import type {
  FalsePositiveReason,
  ValueEventEditLevel,
  ValueEventType,
} from "@/lib/value-events-rules";
import { recordValueEvent } from "../actions";

const FALSE_POSITIVE_OPTIONS: ReadonlyArray<{
  value: FalsePositiveReason;
  label: string;
}> = [
  { value: "recent_contact", label: "Contact trop récent" },
  { value: "already_replied", label: "A déjà répondu" },
  { value: "opted_out", label: "Opposition / désinscription" },
  { value: "wrong_person", label: "Mauvaise personne" },
  { value: "terminal_stage", label: "Statut déjà terminal" },
  { value: "missing_context", label: "Contexte manquant" },
  { value: "other", label: "Autre motif normalisé" },
];

const EDIT_LEVELS: ReadonlyArray<{
  value: ValueEventEditLevel;
  label: string;
}> = [
  { value: "none", label: "Aucune" },
  { value: "light", label: "Légère" },
  { value: "significant", label: "Importante" },
];

const OUTCOMES: ReadonlyArray<{ value: ValueEventType; label: string }> = [
  { value: "manual_followup_sent", label: "Relance envoyée manuellement" },
  { value: "reply_received", label: "Réponse reçue" },
  { value: "meeting_booked", label: "Rendez-vous obtenu" },
  { value: "opportunity_created", label: "Opportunité créée" },
];

const isOutcomeEvent = (eventType: ValueEventType) =>
  OUTCOMES.some((outcome) => outcome.value === eventType);

type FeedbackMode = "evaluation" | "outcomes" | "all";

interface FeedbackMessage {
  kind: "success" | "error";
  text: string;
}

export function ActionValueFeedback({
  actionId,
  prospectId,
  mode = "all",
  includeDraft = false,
}: {
  actionId: string;
  prospectId?: string | null;
  mode?: FeedbackMode;
  includeDraft?: boolean;
}) {
  const inFlight = useRef(false);
  const pendingSubmission = useRef<{
    fingerprint: string;
    submissionId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [falsePositiveReason, setFalsePositiveReason] =
    useState<FalsePositiveReason>("recent_contact");
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [recordedOutcomes, setRecordedOutcomes] = useState<
    ReadonlySet<ValueEventType>
  >(new Set());

  async function submit(
    eventType: ValueEventType,
    details: {
      falsePositiveReason?: FalsePositiveReason;
      editLevel?: ValueEventEditLevel;
    } = {},
  ) {
    if (inFlight.current) return;
    if (
      isOutcomeEvent(eventType) &&
      !window.confirm(
        "Confirmer ce résultat déclaré ? Il restera dans l'historique terrain et ne constitue pas une preuve fournisseur.",
      )
    ) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage(null);

    const fingerprint = JSON.stringify({
      actionId,
      prospectId: prospectId ?? null,
      eventType,
      falsePositiveReason: details.falsePositiveReason ?? null,
      editLevel: details.editLevel ?? null,
    });
    const submissionId =
      pendingSubmission.current?.fingerprint === fingerprint
        ? pendingSubmission.current.submissionId
        : crypto.randomUUID();
    pendingSubmission.current = { fingerprint, submissionId };

    try {
      const result = await recordValueEvent({
        actionId,
        submissionId,
        prospectId,
        eventType,
        falsePositiveReason: details.falsePositiveReason,
        editLevel: details.editLevel,
      });

      if (result.ok) {
        pendingSubmission.current = null;
        if (isOutcomeEvent(eventType)) {
          setRecordedOutcomes((current) => {
            const next = new Set(current);
            next.add(eventType);
            return next;
          });
        }
        setMessage({
          kind: "success",
          text:
            result.status === "duplicate"
              ? "Cette déclaration est déjà enregistrée."
              : "Déclaration enregistrée.",
        });
      } else {
        setMessage({
          kind: "error",
          text:
            result.reason === "forbidden"
              ? "Vous n'avez pas le droit d'enregistrer cette déclaration."
              : result.reason === "not_found"
                ? "Cette action ou ce prospect n'est plus disponible."
                : result.reason === "invalid"
                  ? "La déclaration est incomplète ou invalide."
                  : "Enregistrement momentanément indisponible.",
        });
      }
    } catch {
      setMessage({
        kind: "error",
        text: "Enregistrement momentanément indisponible.",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const showEvaluation = mode === "evaluation" || mode === "all";
  const showDraft = mode === "all" || includeDraft;
  const showOutcomes = mode === "outcomes" || mode === "all";
  const buttonClass =
    "rounded-[9px] border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-body transition hover:border-violet hover:text-violet disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      aria-label="Mesure de la valeur"
      className="mt-5 rounded-[13px] border border-line-soft bg-tint-soft/50 p-4"
    >
      <h4 className="text-[12.5px] font-semibold text-ink">
        Votre retour terrain
      </h4>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        Ces éléments sont déclarés par vous pour mesurer la valeur. Ils
        n&apos;envoient aucun message et ne changent jamais le statut de
        l&apos;outbox.
      </p>

      {showEvaluation && (
        <fieldset className="mt-3">
          <legend className="text-[11px] font-semibold text-faint">
            La suggestion
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("suggestion_useful")}
              className={buttonClass}
            >
              Utile
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("suggestion_not_useful")}
              className={buttonClass}
            >
              Pas utile
            </button>
            <select
              aria-label="Motif du faux positif"
              value={falsePositiveReason}
              disabled={busy}
              onChange={(event) =>
                setFalsePositiveReason(
                  event.target.value as FalsePositiveReason,
                )
              }
              className="min-w-0 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-[11.5px] text-body focus:border-violet focus:outline-none disabled:opacity-50"
            >
              {FALSE_POSITIVE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                submit("false_positive", { falsePositiveReason })
              }
              className={buttonClass}
            >
              Faux positif
            </button>
          </div>
        </fieldset>
      )}

      {showDraft && (
        <fieldset className="mt-3">
          <legend className="text-[11px] font-semibold text-faint">
            Retouche du brouillon
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {EDIT_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                disabled={busy}
                onClick={() =>
                  submit("draft_reviewed", { editLevel: level.value })
                }
                className={buttonClass}
              >
                {level.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {showOutcomes && (
        <fieldset className="mt-3">
          <legend className="text-[11px] font-semibold text-faint">
            Résultat déclaré
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome.value}
                type="button"
                disabled={busy || recordedOutcomes.has(outcome.value)}
                onClick={() => submit(outcome.value)}
                className={buttonClass}
              >
                {recordedOutcomes.has(outcome.value)
                  ? `${outcome.label} ✓`
                  : outcome.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="mt-2.5 text-[10.5px] leading-relaxed text-faint">
        Pour les verdicts et retouches, une correction crée un nouvel événement
        et le plus récent prévaut, sans réécrire l&apos;historique. Les faits
        aval déclarés sont immuables et ne sont pas corrigibles dans ce lot. Une
        réponse ou un rendez-vous reste déclaré jusqu&apos;à sa confirmation
        éventuelle par un connecteur.
      </p>

      {busy && (
        <p role="status" aria-live="polite" className="mt-2 text-[11px] text-muted">
          Enregistrement…
        </p>
      )}
      {message && !busy && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`mt-2 text-[11px] ${
            message.kind === "error" ? "text-red" : "text-green"
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
