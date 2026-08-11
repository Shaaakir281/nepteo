"use client";

import { useRef, useState } from "react";
import type {
  FalsePositiveReason,
  ValueEventEditLevel,
  ValueEventType,
} from "@/lib/value-events-rules";
import { recordValueEvent } from "../actions";
import { ActionValueFeedbackFields } from "./action-value-feedback-fields";
import { isOutcomeEvent } from "./action-value-feedback-options";

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
  const pendingSubmission = useRef<{ fingerprint: string; submissionId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [falsePositiveReason, setFalsePositiveReason] =
    useState<FalsePositiveReason>("recent_contact");
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [recordedOutcomes, setRecordedOutcomes] = useState<ReadonlySet<ValueEventType>>(new Set());

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
      !window.confirm("Confirmer ce résultat déclaré ? Il ne constitue pas une preuve fournisseur.")
    ) return;

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
          setRecordedOutcomes((current) => new Set(current).add(eventType));
        }
        setMessage({
          kind: "success",
          text: result.status === "duplicate" ? "Déjà enregistrée." : "Déclaration enregistrée.",
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
      setMessage({ kind: "error", text: "Enregistrement momentanément indisponible." });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const showEvaluation = mode === "evaluation" || mode === "all";
  const showDraft = mode === "all" || includeDraft;
  const showOutcomes = mode === "outcomes" || mode === "all";

  return (
    <section aria-label="Mesure de la valeur" className="mt-3 rounded-[13px] bg-tint-soft/50 p-3">
      <ActionValueFeedbackFields
        showEvaluation={showEvaluation}
        showDraft={showDraft}
        showOutcomes={showOutcomes}
        busy={busy}
        falsePositiveReason={falsePositiveReason}
        setFalsePositiveReason={setFalsePositiveReason}
        recordedOutcomes={recordedOutcomes}
        submit={submit}
      />
      {busy && <p role="status" aria-live="polite" className="mt-2 text-[11px] text-muted">Enregistrement…</p>}
      {message && !busy && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`mt-2 text-[11px] ${message.kind === "error" ? "text-red" : "text-green"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
