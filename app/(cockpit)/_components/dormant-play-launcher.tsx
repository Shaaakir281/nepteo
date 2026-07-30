"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { proposeDormantPlay } from "../actions";
import type { DormantPlayResult } from "../_actions/dormant-play";

function resultMessage(result: DormantPlayResult): string {
  if (result.ok) {
    if (result.status === "created") {
      return `${result.count} prospect${result.count > 1 ? "s" : ""} ajouté${result.count > 1 ? "s" : ""} à la file « À valider ».`;
    }
    if (result.status === "exists") {
      return "Une relance dormante est déjà en cours : examinez-la dans la file de validation.";
    }
    return "Aucun prospect ne remplit encore ces critères.";
  }

  if (result.reason === "busy") {
    return "Une autre analyse est en cours. Réessayez dans un instant.";
  }
  if (result.reason === "base_too_large") {
    return "La base dépasse la limite de ce pilote. Aucun groupe partiel n'a été créé.";
  }
  if (result.reason === "history_too_large") {
    return "L'historique doit être vérifié avant de préparer une nouvelle vague.";
  }
  if (result.reason === "forbidden") {
    return "Votre rôle ne permet pas de préparer cette proposition.";
  }
  return "La proposition n'a pas pu être préparée. Réessayez sans risque d'envoi.";
}

export function DormantPlayLauncher() {
  const router = useRouter();
  const [threshold, setThreshold] = useState<"" | "30" | "45">("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DormantPlayResult | null>(null);

  async function prepare() {
    if (running || threshold === "") return;
    setRunning(true);
    setResult(null);
    try {
      const next = await proposeDormantPlay(Number(threshold));
      setResult(next);
      if (next.ok && next.status !== "empty") router.refresh();
    } catch {
      setResult({ ok: false, reason: "read_failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section
      className="rounded-[18px] border border-line-soft bg-white p-5 shadow-card"
      aria-labelledby="dormant-play-title"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
            Pilote terrain supervisé
          </p>
          <h2
            id="dormant-play-title"
            className="mt-1 font-display text-[16px] font-semibold text-ink"
          >
            Réactiver les prospects dormants
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Choisissez vous-même le seuil de silence. Nepteo préparera une
            proposition et une cohorte à examiner ; aucun message n&apos;est
            envoyé à cette étape.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-52 flex-col gap-1.5 text-[11.5px] font-medium text-muted">
            Seuil de silence
            <select
              value={threshold}
              onChange={(event) => {
                const value = event.target.value;
                setThreshold(value === "30" || value === "45" ? value : "");
                setResult(null);
              }}
              disabled={running}
              className="h-10 rounded-[10px] border border-line bg-white px-3 text-[13px] text-ink outline-none focus:border-violet"
              aria-describedby="dormant-play-help"
            >
              <option value="">Choisir un seuil…</option>
              <option value="30">30 jours · cohorte plus large</option>
              <option value="45">45 jours · approche plus prudente</option>
            </select>
          </label>
          <button
            type="button"
            onClick={prepare}
            disabled={running || threshold === ""}
            className="h-10 rounded-[10px] bg-violet px-4 text-[12.5px] font-semibold text-white transition hover:bg-violet-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            {running ? "Préparation…" : "Préparer la proposition"}
          </button>
        </div>
      </div>

      <p id="dormant-play-help" className="mt-3 text-[11.5px] text-faint">
        Sont exclus : date absente ou invalide, contact récent, email manquant,
        statut terminé ou opposition visible dans le statut, et toute cohorte
        dormante déjà validée.
      </p>
      {result && (
        <p
          role="status"
          className={`mt-3 text-[12px] font-medium ${
            result.ok ? "text-violet-ink" : "text-red-700"
          }`}
        >
          {resultMessage(result)}
        </p>
      )}
    </section>
  );
}
