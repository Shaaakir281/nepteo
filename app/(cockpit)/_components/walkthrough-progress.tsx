"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  WALKTHROUGH_STAGES,
  WALKTHROUGH_STORAGE_KEY,
  WALKTHROUGH_UPDATED_EVENT,
  parseWalkthroughState,
  walkthroughCompletedStageCount,
} from "@/lib/onboarding/walkthrough";

export function WalkthroughProgress() {
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        setCompleted(
          walkthroughCompletedStageCount(
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

  return (
    <Link
      href="/prise-en-main"
      title={`Prise en main · ${completed} étape${completed > 1 ? "s" : ""} sur 5`}
      aria-label={`Prise en main : ${completed} sur 5`}
      className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-white px-3 py-1.5 shadow-card"
    >
      <span className="flex gap-1" aria-hidden="true">
        {WALKTHROUGH_STAGES.map((stage, index) => (
          <span
            key={stage.id}
            className={`h-1 w-4 rounded-full ${
              index < completed ? "bg-green" : "bg-line"
            }`}
          />
        ))}
      </span>
      <b className="ml-1 text-[11px] font-semibold text-muted">
        {completed}/5
      </b>
    </Link>
  );
}
