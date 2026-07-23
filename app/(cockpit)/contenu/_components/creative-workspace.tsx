"use client";

import { useState } from "react";
import { generateBriefAction } from "../actions";
import { CHANNEL_LABELS, CREATIVE_CHANNELS } from "@/lib/creative-template";

/** Atelier de conseil créatif : objectif + canal → brief exploitable. */
export function CreativeWorkspace({ canEdit }: { canEdit: boolean }) {
  const [objectif, setObjectif] = useState("");
  const [canal, setCanal] = useState<string>("indifferent");
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (loading || !objectif.trim()) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await generateBriefAction(objectif, canal);
      if (res.ok) setBrief(res.brief);
      else setError(res.reason === "forbidden" ? "Rôle insuffisant." : "Précisez un objectif.");
    } catch {
      setError("Génération impossible — réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-line-soft bg-white p-[22px] shadow-card">
        <label className="mb-1 block text-[12.5px] font-semibold text-ink">
          Que voulez-vous mettre en avant ?
        </label>
        <input
          value={objectif}
          onChange={(e) => setObjectif(e.target.value)}
          disabled={!canEdit}
          placeholder="Ex. promouvoir notre nouvelle offre découverte auprès des nouveaux clients"
          className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
        />

        <label className="mb-1 mt-4 block text-[12.5px] font-semibold text-ink">
          Canal visé
        </label>
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          disabled={!canEdit}
          className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-[13px] text-ink focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
        >
          {CREATIVE_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>

        {canEdit && (
          <button
            type="button"
            onClick={generate}
            disabled={loading || !objectif.trim()}
            className="mt-4 rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50"
          >
            {loading ? "L'agent rédige le brief…" : "Générer le conseil créatif"}
          </button>
        )}
        {error && <p className="mt-2 text-[12.5px] text-red">{error}</p>}
      </div>

      {brief && (
        <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">
              Brief créatif
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copy}
                className="rounded-[9px] bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
              >
                {copied ? "Copié ✓" : "Copier"}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="rounded-[9px] bg-tint px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white disabled:opacity-50"
                >
                  {loading ? "…" : "Régénérer"}
                </button>
              )}
            </div>
          </div>
          <div className="p-[22px]">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-body">
              {brief}
            </p>
            <p className="mt-4 text-[11.5px] text-faint">
              À transmettre à un créateur (pub Meta, réseaux, newsletter) ou à une
              future IA de génération. « Ce qui marche dans le secteur » s&apos;appuie
              sur des bonnes pratiques générales, pas sur une veille temps réel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
