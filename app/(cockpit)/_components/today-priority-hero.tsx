"use client";

import { useState } from "react";
import type { TodayPriority } from "@/lib/today-priority-rules";
import {
  ValidationDrawer,
  type QueueAction,
} from "./validation-drawer";

export function TodayPriorityHero({
  action,
  canEdit,
}: {
  action: TodayPriority<QueueAction>;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-[13px] border border-line-soft bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-line-soft px-[18px] py-3">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-violet text-[10px] font-bold text-white">
          N
        </span>
        <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet-ink">
          Priorité du jour
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full px-[18px] py-3 text-left transition hover:bg-tint-soft"
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
      <details className="group border-t border-line-soft px-[18px] py-2.5">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-violet-ink">
          Pourquoi maintenant ?
        </summary>
        <div className="mt-2 max-w-xl border-l-2 border-line pl-3 text-[12px] leading-relaxed text-muted">
          <p>{action.whyNow}</p>
          <p className="mt-1">{action.finding}</p>
        </div>
      </details>
      <ValidationDrawer
        action={open ? action : null}
        canEdit={canEdit}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
