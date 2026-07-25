"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearDemoAction, loadDemoScenarioAction } from "../actions";

/**
 * Mode démonstration : charge une entreprise fictive complète (identité,
 * prospects, campagnes, ventes) en un clic. Les trois scénarios sont
 * volontairement contrastés — l'agent doit s'adapter au métier, c'est ce
 * qu'on montre. Aucune donnée réelle n'est touchée.
 */

export interface ScenarioChoice {
  id: string;
  label: string;
  pitch: string;
}

const STEPS = [
  "Installation de l'identité…",
  "Import de la base de prospects…",
  "Chargement des campagnes et des ventes…",
];
const STEP_MS = 700;

export function DemoPanel({
  scenarios,
  canEdit,
}: {
  scenarios: ScenarioChoice[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, task: () => Promise<{ ok: boolean }>) {
    if (busy) return;
    setBusy(id);
    setMessage(null);
    setError(null);
    setStep(0);

    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + 1, STEPS.length - 1);
      setStep(current);
    }, STEP_MS);

    try {
      const [result] = await Promise.all([
        task(),
        new Promise((r) => setTimeout(r, STEPS.length * STEP_MS)),
      ]);
      if (result.ok) {
        setMessage(
          id === "clear"
            ? "Données de démonstration retirées."
            : "Scénario chargé. Ouvrez « Aujourd'hui » et lancez une analyse.",
        );
      } else {
        setError("Le chargement n'a pas abouti. Réessayez.");
      }
    } catch {
      setError("Le chargement n'a pas abouti. Réessayez.");
    } finally {
      clearInterval(timer);
      setBusy(null);
      router.refresh();
    }
  }

  if (!canEdit) {
    return (
      <p className="text-[13px] text-muted">
        Votre rôle ne permet pas de charger des données de démonstration.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className="flex flex-col rounded-[13px] border border-line-soft bg-tint-soft/40 p-4"
          >
            <h4 className="font-display text-[13.5px] font-semibold text-ink">
              {s.label}
            </h4>
            <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">
              {s.pitch}
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run(s.id, () => loadDemoScenarioAction(s.id))}
              className="mt-3 rounded-[10px] bg-violet px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === s.id ? "Chargement…" : "Charger ce scénario"}
            </button>
          </div>
        ))}
      </div>

      {busy && (
        <div className="mt-4 flex items-center gap-2.5 text-[13px] font-medium text-violet">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet border-t-transparent" />
          <span>{STEPS[step]}</span>
        </div>
      )}
      {message && (
        <p className="mt-4 rounded-[10px] bg-green-tint px-3.5 py-2.5 text-[13px] font-medium text-green">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        <p className="text-[11.5px] leading-relaxed text-faint">
          Entreprises fictives. Charger un scénario remplace le précédent et
          écrase l&apos;identité — vos données issues de vrais connecteurs ne
          sont pas touchées.
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("clear", clearDemoAction)}
          className="text-[12px] font-semibold text-muted hover:text-ink hover:underline disabled:opacity-40"
        >
          Retirer les données de démonstration
        </button>
      </div>
    </div>
  );
}
