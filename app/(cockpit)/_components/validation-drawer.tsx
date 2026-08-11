"use client";

import { useId, useRef } from "react";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import type { CreativeAsset } from "@/lib/creative-asset-rules";
import { ValidationActionContent } from "./validation-action-content";
import { ValidationDecisionFooter } from "./validation-decision-footer";
import { ValidationDrawerHeader } from "./validation-drawer-header";
import { campaignProjectionAvailable } from "./validation-payload-utils";

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
  creatives?: CreativeAsset[];
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
  const confidenceAvailable = Boolean(
    action &&
      action.confidence != null &&
      !action.kind.startsWith("ads_pause_") &&
      !(
        action.kind === "launch_campaign" &&
        !campaignProjectionAvailable(action.payload)
      ),
  );

  useDialogFocus({
    open: action !== null,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  return (
    <>
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
            <ValidationDrawerHeader
              action={action}
              confidenceAvailable={confidenceAvailable}
              titleId={titleId}
              closeButtonRef={closeButtonRef}
              onClose={onClose}
            />
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <ValidationActionContent action={action} canEdit={canEdit} />
            </div>
            {canEdit && <ValidationDecisionFooter action={action} />}
          </>
        )}
      </aside>
    </>
  );
}
