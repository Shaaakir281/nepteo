import type { RefObject } from "react";
import { isRelanceKind } from "@/lib/draft-template";
import type { QueueAction } from "./validation-drawer";

const RISK_LABELS: Record<string, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
};

function actionFamilyLabel(kind: string): string {
  if (isRelanceKind(kind)) return "Relance";
  if (kind === "launch_campaign" || kind.startsWith("ads_pause_")) {
    return "Campagne";
  }
  if (/content|creative|draft/.test(kind)) return "Contenu";
  return "Action";
}

export function ValidationDrawerHeader({
  action,
  confidenceAvailable,
  titleId,
  closeButtonRef,
  onClose,
}: {
  action: QueueAction;
  confidenceAvailable: boolean;
  titleId: string;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const context = action.expected_impact || action.finding;

  return (
    <header className="border-b border-line-soft px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
            {actionFamilyLabel(action.kind)}
          </p>
          <h3
            id={titleId}
            className="mt-1 font-display text-[17px] font-semibold leading-snug text-ink"
          >
            {action.title}
          </h3>
        </div>
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
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-green-tint px-2.5 py-1 text-[10.5px] font-semibold text-green">
          {RISK_LABELS[action.risk] ?? action.risk}
        </span>
        <span className="rounded-full bg-tint px-2.5 py-1 text-[10.5px] font-semibold text-violet">
          {confidenceAvailable
            ? `Confiance ${Math.round(action.confidence! * 100)} %`
            : "Confiance non calculée"}
        </span>
      </div>
      {context && (
        <p className="mt-2 line-clamp-1 text-[11.5px] leading-relaxed text-muted">
          {context}
        </p>
      )}
    </header>
  );
}
