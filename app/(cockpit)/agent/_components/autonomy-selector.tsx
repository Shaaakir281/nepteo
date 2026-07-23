"use client";

import { useState } from "react";
import { setAutonomyLevel } from "../actions";

const OPTIONS = [
  {
    value: "suggest",
    label: "Proposer seulement",
    desc: "L'agent détecte et propose. Aucune exécution, même sur une action validée.",
  },
  {
    value: "prepare",
    label: "Préparer sous validation",
    desc: "Les actions que vous validez sont préparées en mode sûr (aucun envoi externe).",
  },
] as const;

/** Sélecteur du niveau d'autonomie de l'agent (Phase 3, garde-fous). */
export function AutonomySelector({
  level,
  canEdit,
}: {
  level: string;
  canEdit: boolean;
}) {
  const [current, setCurrent] = useState(level);
  const [busy, setBusy] = useState(false);

  async function choose(value: string) {
    if (busy || value === current || !canEdit) return;
    setBusy(true);
    const prev = current;
    setCurrent(value);
    try {
      await setAutonomyLevel(value);
    } catch {
      setCurrent(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {OPTIONS.map((o) => {
        const on = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            disabled={!canEdit || busy}
            className={`block w-full rounded-[12px] border px-4 py-3 text-left transition disabled:opacity-60 ${
              on
                ? "border-violet bg-tint-soft"
                : "border-line hover:border-violet/40 hover:bg-tint-soft/50"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span
                className={`grid h-4 w-4 flex-none place-items-center rounded-full border-2 ${
                  on ? "border-violet" : "border-line"
                }`}
              >
                {on && <span className="h-2 w-2 rounded-full bg-violet" />}
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                {o.label}
              </span>
            </span>
            <span className="mt-1 block pl-[26px] text-[12.5px] leading-relaxed text-muted">
              {o.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
