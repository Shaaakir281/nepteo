"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  WALKTHROUGH_MISSIONS,
  WALKTHROUGH_STORAGE_KEY,
  WALKTHROUGH_UPDATED_EVENT,
  parseWalkthroughState,
  walkthroughCompletedCount,
} from "@/lib/onboarding/walkthrough";

export function WalkthroughSidebarLink() {
  const pathname = usePathname();
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        setCompleted(
          walkthroughCompletedCount(
            parseWalkthroughState(
              window.localStorage.getItem(WALKTHROUGH_STORAGE_KEY),
            ),
          ),
        );
      } catch {
        setCompleted(0);
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(WALKTHROUGH_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(WALKTHROUGH_UPDATED_EVENT, refresh);
    };
  }, []);

  const current = pathname.startsWith("/prise-en-main");
  const percent = Math.round(
    (completed / WALKTHROUGH_MISSIONS.length) * 100,
  );

  return (
    <Link
      href="/prise-en-main"
      aria-current={current ? "page" : undefined}
      className={`mx-3.5 mb-3 flex items-center gap-3 rounded-[12px] border px-3 py-2.5 transition ${
        current
          ? "border-violet/30 bg-tint text-violet-ink"
          : "border-line bg-white text-body hover:border-violet/30 hover:bg-tint-soft"
      }`}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-none place-items-center rounded-full text-[11px] font-bold text-violet-ink"
        style={{
          background: `radial-gradient(circle, white 57%, transparent 59%), conic-gradient(var(--violet) ${percent}%, var(--tint) 0)`,
        }}
      >
        {completed}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-ink">
          Prise en main
        </span>
        <span className="block text-[10.5px] text-muted">
          {completed} / {WALKTHROUGH_MISSIONS.length} missions
        </span>
      </span>
      <span aria-hidden="true" className="text-faint">
        →
      </span>
    </Link>
  );
}
