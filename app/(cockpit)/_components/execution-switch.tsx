"use client";

import { useState } from "react";
import { toggleExecutionPause } from "../actions";

/**
 * Bouton d'arrêt (Phase 3) : bascule la pause d'exécution de l'organisation.
 * En pause, aucune action ne peut s'exécuter (garde-fou côté serveur aussi).
 */
export function ExecutionSwitch({ paused }: { paused: boolean }) {
  const [on, setOn] = useState(!paused); // on = exécution active
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !on;
    try {
      await toggleExecutionPause(!next); // paused = !active
      setOn(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title="Bloque ou autorise l'exécution des actions validées"
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
        on
          ? "bg-green-tint text-green"
          : "bg-red-tint text-red"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-green" : "bg-red"}`}
      />
      {on ? "Exécution active" : "Exécution en pause"}
    </button>
  );
}
