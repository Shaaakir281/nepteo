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
    <section className="rounded-[20px] border border-line-soft bg-white px-6 py-7 shadow-card sm:px-9 sm:py-8">
      <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet-ink">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-violet text-[10px] font-bold text-white">
          N
        </span>
        À faire maintenant
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-[24px] font-medium leading-tight tracking-[-.02em] text-ink sm:text-[29px]">
        {action.title}
      </h2>
      <div className="mt-6 flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(45,91,167,.18)] transition hover:bg-violet-deep"
        >
          Examiner
        </button>
        <details className="group pt-2">
          <summary className="cursor-pointer text-[11.5px] font-semibold text-violet-ink">
            Pourquoi ?
          </summary>
          <div className="mt-2 max-w-xl border-l-2 border-line pl-3 text-[12px] leading-relaxed text-muted">
            <p>{action.whyNow}</p>
            <p className="mt-1">{action.finding}</p>
          </div>
        </details>
      </div>
      <ValidationDrawer
        action={open ? action : null}
        canEdit={canEdit}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
