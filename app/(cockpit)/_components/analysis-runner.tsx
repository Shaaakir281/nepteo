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

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

export function AnalysisRunner({
  variant = "primary",
}: {
  variant?: "primary" | "link" | "hero";
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setStep(0);
    setFeedback(null);

    // Cadence visible des étapes (min. lisible), en parallèle de l'analyse réelle.
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + 1, STEPS.length - 1);
      setStep(current);
    }, STEP_MS);

    const minDelay = new Promise((r) => setTimeout(r, STEPS.length * STEP_MS));
    try {
      const [result] = await Promise.all([analyzeNow(), minDelay]);
      if (result.ok) {
        if (result.warning === "ads_failed") {
          setFeedback({
            tone: "warning",
            message:
              result.created > 0
                ? `${result.created} nouvelle${result.created > 1 ? "s" : ""} proposition${result.created > 1 ? "s" : ""} préparée${result.created > 1 ? "s" : ""} côté prospects. Analyse publicitaire indisponible.`
                : "Analyse prospects terminée sans nouvelle proposition. Analyse publicitaire indisponible.",
          });
        } else {
          setFeedback({
            tone: "success",
            message:
              result.created > 0
                ? `${result.created} nouvelle${result.created > 1 ? "s" : ""} proposition${result.created > 1 ? "s" : ""} préparée${result.created > 1 ? "s" : ""}.`
                : "Analyse terminée : aucune nouvelle proposition.",
          });
        }
      } else {
        const message =
          result.reason === "busy"
            ? "Une analyse est déjà en cours. Réessayez dans un instant."
            : result.reason === "forbidden"
              ? "Analyse non lancée : vos droits ne permettent pas cette action."
              : "Analyse interrompue : aucune nouvelle proposition confirmée. Réessayez.";
        setFeedback({ tone: "error", message });
      }
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Analyse indisponible : aucune nouvelle proposition confirmée. Réessayez.",
      });
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

  const button =
    variant === "link" ? (
      <button
        type="button"
        onClick={run}
        className="text-[12px] font-semibold text-violet hover:underline"
      >
        Relancer l&apos;analyse
      </button>
    ) : variant === "hero" ? (
      <button
        type="button"
        onClick={run}
        className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(45,91,167,.18)] transition hover:bg-violet-deep"
      >
        Analyser
      </button>
    ) : (
      <button
        type="button"
        onClick={run}
        className="rounded-[10px] border border-line bg-white px-4 py-2 text-[13px] font-semibold text-body transition hover:border-violet/30 hover:text-violet"
      >
        Analyser
      </button>
    );

  return (
    <div className="space-y-1.5">
      {button}
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={`max-w-sm text-[11.5px] leading-relaxed ${
            feedback.tone === "success"
              ? "text-green"
              : feedback.tone === "warning"
                ? "text-amber"
                : "text-red-600"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
