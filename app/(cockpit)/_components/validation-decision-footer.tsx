"use client";

import { useState } from "react";
import { decideAction } from "../actions";
import type { QueueAction } from "./validation-drawer";

function DecisionForm({
  id,
  decision,
  label,
  primary = false,
}: {
  id: string;
  decision: "approve" | "postpone";
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={decideAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
          primary
            ? "bg-violet text-white hover:bg-violet-deep"
            : "border border-line bg-white text-body hover:border-violet hover:text-violet"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function decisionNote(action: QueueAction): string {
  if (action.kind === "launch_campaign") {
    return action.creatives?.some((creative) => creative.status === "selected")
      ? "Campagne et visuel validés — non lancés, non publiés."
      : "Validée — non lancée, non publiée.";
  }
  if (action.kind.startsWith("ads_pause_")) {
    return "Validée — non appliquée. CAMP-2 ne fournit aucun bouton d'exécution publicitaire.";
  }
  return "Validation sans envoi externe.";
}

export function ValidationDecisionFooter({ action }: { action: QueueAction }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <footer className="border-t border-line-soft px-6 py-4">
      {rejecting ? (
        <form action={decideAction}>
          <input type="hidden" name="id" value={action.id} />
          <input type="hidden" name="decision" value="reject" />
          <label
            htmlFor={`rejection-reason-${action.id}`}
            className="text-[11px] font-semibold text-red"
          >
            Raison du refus
          </label>
          <textarea
            id={`rejection-reason-${action.id}`}
            name="reason"
            required
            minLength={3}
            maxLength={500}
            rows={2}
            autoFocus
            placeholder="Expliquez ce qui doit être corrigé (3 à 500 caractères)."
            className="mt-1.5 block w-full resize-y rounded-[8px] border border-red/20 bg-white px-3 py-2 text-[12px] leading-relaxed text-body outline-none focus:border-red"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="rounded-[9px] bg-red px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
            >
              Refuser avec cette raison
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-[9px] border border-line px-3.5 py-1.5 text-[12.5px] font-semibold text-body"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <DecisionForm id={action.id} decision="approve" label="Valider" primary />
          <DecisionForm id={action.id} decision="postpone" label="Reporter" />
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="ml-auto rounded-[9px] px-2 py-1.5 text-[12.5px] font-semibold text-muted hover:text-red"
          >
            Refuser
          </button>
        </div>
      )}
      {!rejecting && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
          {decisionNote(action)}
        </p>
      )}
    </footer>
  );
}
