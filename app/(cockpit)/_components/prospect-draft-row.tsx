"use client";

import { useEffect, useState } from "react";
import type { Draft } from "@/lib/draft-template";
import {
  draftForProspect,
  saveProspectNote,
  type TargetProspect,
} from "../actions";

export function ProspectDraftRow({
  actionId,
  prospect,
  canEdit,
  open,
  onToggle,
}: {
  actionId: string;
  prospect: TargetProspect;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(prospect.note ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  async function load(regenerate: boolean) {
    setLoading(true);
    setFailed(false);
    try {
      const result = await draftForProspect(actionId, prospect.id, regenerate);
      if (result.ok) setDraft(result.draft);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || draft || loading) return;
    let alive = true;
    draftForProspect(actionId, prospect.id, false)
      .then((result) => {
        if (!alive) return;
        if (result.ok) setDraft(result.draft);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [actionId, draft, loading, open, prospect.id]);

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Objet : ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  async function saveNote() {
    setSavingNote(true);
    setNoteSaved(false);
    try {
      const result = await saveProspectNote(prospect.id, note);
      if (result.ok) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 1600);
      }
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-line-soft">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
          {prospect.name ?? prospect.email ?? "Prospect"}
          {prospect.company && <span className="text-muted"> · {prospect.company}</span>}
        </span>
        <span className="flex-none text-[12px] text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-line-soft px-3 py-2.5">
          {canEdit && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold text-faint">Ma note sur ce prospect</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Ex. Rencontré au salon, intéressé par l'offre premium…"
                className="w-full resize-y rounded-[8px] border border-line px-2.5 py-1.5 text-[12px] text-body focus:border-violet focus:outline-none"
              />
              <button
                type="button"
                onClick={saveNote}
                disabled={savingNote || note === (prospect.note ?? "")}
                className="mt-1.5 rounded-[8px] border border-line px-2.5 py-1 text-[11.5px] font-semibold text-violet disabled:opacity-40"
              >
                {savingNote ? "…" : noteSaved ? "Enregistré ✓" : "Enregistrer la note"}
              </button>
            </div>
          )}
          {!draft && !failed ? (
            <p className="text-[12px] italic text-muted">L&apos;agent personnalise le message…</p>
          ) : failed ? (
            <p className="text-[12px] text-muted">Brouillon indisponible.</p>
          ) : draft ? (
            <>
              <p className="text-[12px] font-semibold text-ink">Objet : {draft.subject}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-body">{draft.body}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={copy} className="rounded-[8px] border border-line px-2.5 py-1 text-[11.5px] font-semibold text-body">
                  {copied ? "Copié ✓" : "Copier"}
                </button>
                {canEdit && (
                  <button type="button" onClick={() => load(true)} disabled={loading} className="rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold text-violet disabled:opacity-50">
                    {loading ? "…" : "Régénérer"}
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
