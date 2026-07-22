"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeNow } from "../actions";

/**
 * Autonomie visible (Phase 2) : rend le passage d'analyse tangible — l'agent
 * travaille par étapes, il ne fait pas qu'afficher une liste. L'analyse réelle
 * tourne côté serveur (`analyzeNow`) ; les étapes cadencent l'attente pour la
 * rendre lisible, puis la vue est rafraîchie.
 */

const STEPS = [
  "Lecture de vos données…",
  "Analyse des signaux du funnel…",
  "Rédaction des propositions…",
];

const STEP_MS = 800;

export function AnalysisRunner({
  variant = "primary",
}: {
  variant?: "primary" | "link";
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  async function run() {
    if (running) return;
    setRunning(true);
    setStep(0);

    // Cadence visible des étapes (min. lisible), en parallèle de l'analyse réelle.
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + 1, STEPS.length - 1);
      setStep(current);
    }, STEP_MS);

    const minDelay = new Promise((r) => setTimeout(r, STEPS.length * STEP_MS));
    try {
      await Promise.all([analyzeNow(), minDelay]);
    } finally {
      clearInterval(timer);
      setRunning(false);
      router.refresh(); // recharge propositions + briefing
    }
  }

  if (running) {
    return (
      <div className="flex items-center gap-2.5 text-[13px] font-medium text-violet">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet border-t-transparent" />
        <span>{STEPS[step]}</span>
      </div>
    );
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={run}
        className="text-[12px] font-semibold text-violet hover:underline"
      >
        Relancer l&apos;analyse
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      className="rounded-[10px] bg-tint px-4 py-2 text-[13px] font-semibold text-violet transition hover:bg-violet hover:text-white"
    >
      Analyser mes données maintenant
    </button>
  );
}
