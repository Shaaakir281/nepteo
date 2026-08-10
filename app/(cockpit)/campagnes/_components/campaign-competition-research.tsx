"use client";

import { useState } from "react";
import type { CampaignBrief } from "@/lib/campaign-plan";
import { researchCampaignCompetitionAction } from "../actions";

export function CampaignCompetitionResearch({ brief, disabled, onBusyChange }: { brief: CampaignBrief; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof researchCampaignCompetitionAction>> | null>(null);

  async function run() {
    if (!confirmed || busy || disabled) return;
    setBusy(true);
    onBusyChange(true);
    try {
      setResult(await researchCampaignCompetitionAction({ brief, confirmed: true }));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="rounded-[10px] border border-line-soft p-3">
      <h5 className="text-[11px] font-semibold uppercase tracking-[.08em] text-faint">Veille concurrentielle séparée et sourcée</h5>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        Recherche potentiellement payante, confirmée séparément, avec journal avant appel, cache, timeout et aucun retry automatique. Elle ne modifie pas la proposition.
      </p>
      <label className="mt-2 flex items-start gap-2 text-[11.5px] text-body">
        <input type="checkbox" checked={confirmed} disabled={disabled} onChange={(event) => setConfirmed(event.target.checked)} />
        Je confirme vouloir lancer cette recherche maintenant.
      </label>
      <button type="button" disabled={!confirmed || busy || disabled} onClick={run} className="mt-2 rounded-[9px] border border-violet px-3 py-2 text-[12px] font-semibold text-violet disabled:opacity-40">
        {busy ? "Recherche en cours…" : "Lancer la veille sourcée"}
      </button>
      <div aria-live="polite">
        {result && !result.ok && <p className="mt-2 text-[11.5px] text-red">{researchErrorMessage(result.reason)}</p>}
        {result?.ok && (
          <div className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-body">
            <p>{result.text}</p>
            <p className="text-faint">{result.cached ? "Résultat issu du cache" : "Nouvel appel comptabilisé"} · usage du jour : {result.quota.used}.</p>
            <ul className="space-y-1">{result.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-violet underline">{source.title}</a></li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}

function researchErrorMessage(reason: string): string {
  if (reason === "forbidden") return "Votre rôle ne permet pas cette recherche.";
  if (reason === "demo_forbidden") return "La recherche payante est désactivée dans le scénario d'exemple.";
  if (reason === "busy") return "Une autre opération de données est en cours. Réessayez explicitement plus tard.";
  if (reason === "quota_unavailable") return "Le compteur d'usage est indisponible ; aucun appel n'a été lancé.";
  return "La recherche n'a pas abouti. Aucun retry automatique n'a été lancé.";
}
