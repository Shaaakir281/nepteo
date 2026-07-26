"use client";

import { useState } from "react";
import { setAutonomyLevel } from "../actions";

const OPTIONS = [
  {
    value: "suggest",
    label: "Propose seulement",
    desc: "L'agent détecte et propose. Aucune exécution, même sur une action validée.",
  },
  {
    value: "prepare",
    label: "Prépare",
    desc: "Les actions que vous validez sont préparées en mode sûr (aucun envoi externe).",
  },
] as const;

/**
 * Troisième cran, purement visuel — l'info reprend l'ancienne carte
 * « Mode d'exécution » (retirée, C5). La base reste `suggest|prepare`
 * (`lib/execution-rules.ts`, non modifié par ce chantier) : ce cran ne
 * déclenche jamais `setAutonomyLevel`.
 */
const COMING_SOON = {
  label: "Envoie",
  desc: "Enverra réellement les messages préparés, derrière ces mêmes garde-fous et une configuration SMTP explicite.",
};

/** Curseur à trois crans (Phase 3, garde-fous) : les deux premiers sont actifs, le troisième est désactivé (« Bientôt »). */
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

      <div
        aria-disabled="true"
        className="block w-full cursor-not-allowed rounded-[12px] border border-line bg-tint-soft/30 px-4 py-3 text-left opacity-70"
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-4 w-4 flex-none place-items-center rounded-full border-2 border-line" />
          <span className="text-[13.5px] font-semibold text-muted">
            {COMING_SOON.label}
          </span>
          <span className="ml-auto rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-faint">
            Bientôt
          </span>
        </span>
        <span className="mt-1 block pl-[26px] text-[12.5px] leading-relaxed text-faint">
          {COMING_SOON.desc}
        </span>
      </div>
    </div>
  );
}
