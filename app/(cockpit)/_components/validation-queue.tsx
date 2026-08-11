"use client";

import { useState } from "react";
import { AnalysisRunner } from "./analysis-runner";
import {
  ValidationDrawer,
  type QueueAction,
} from "./validation-drawer";
import type { TodayPriority } from "@/lib/today-priority-rules";

export type { QueueAction } from "./validation-drawer";

export function ValidationQueue({
  actions,
  canEdit,
  showEmptyState = true,
}: {
  actions: TodayPriority<QueueAction>[];
  canEdit: boolean;
  showEmptyState?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = actions.find((action) => action.id === openId) ?? null;

  if (actions.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5">
        <p className="text-[12.5px] text-muted">0 décision à valider</p>
        {canEdit && (
          <AnalysisRunner variant="primary" />
        )}
      </div>
    );
  }

  return (
    <div>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => setOpenId(action.id)}
          className="block w-full border-t border-line-soft px-[18px] py-3 text-left transition hover:bg-tint-soft first:border-t-0"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink">
              {action.title}
            </span>
            <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet">
              Examiner
            </span>
          </span>
        </button>
      ))}

      {canEdit && (
        <div className="border-t border-line-soft px-[22px] py-3">
          <AnalysisRunner variant="link" />
        </div>
      )}

      <ValidationDrawer
        action={active}
        canEdit={canEdit}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
