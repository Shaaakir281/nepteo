"use client";

import { useEffect, useState } from "react";
import type { Draft } from "@/lib/draft-template";
import { draftForAction, saveDraftEdit } from "../actions";

export function ActionDraftEditor({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  function acceptDraft(next: Draft) {
    setDraft(next);
    setSubject(next.subject);
    setBody(next.body);
  }

  async function load(regenerate: boolean) {
    setLoading(true);
    setFailed(false);
    try {
      const result = await draftForAction(id, regenerate);
      if (result.ok) acceptDraft(result.draft);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    draftForAction(id, false)
      .then((result) => {
        if (!alive) return;
        if (result.ok) acceptDraft(result.draft);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const result = await saveDraftEdit(id, subject, body);
      if (result.ok) acceptDraft(result.draft);
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible : sans effet */
    }
  }

  const dirty = Boolean(draft && (subject !== draft.subject || body !== draft.body));

  return (
    <section aria-label="Le message">
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
        Le message
      </p>
      {loading && !draft ? (
        <p className="text-[12.5px] italic text-muted">L&apos;agent rédige le message…</p>
      ) : failed ? (
        <p className="text-[12.5px] text-muted">Brouillon indisponible pour l&apos;instant.</p>
      ) : draft && canEdit ? (
        <div className="rounded-[13px] border border-violet/25 bg-white p-3">
          <label className="mb-1 block text-[10.5px] font-semibold text-faint">Objet</label>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[12.5px] text-ink focus:border-violet focus:outline-none"
          />
          <label className="mb-1 mt-2 block text-[10.5px] font-semibold text-faint">Message</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={7}
            className="w-full resize-y rounded-[9px] border border-line px-3 py-2 text-[12.5px] leading-relaxed text-body focus:border-violet focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || !subject.trim() || body.trim().length < 10}
              className="rounded-[9px] border border-violet px-3 py-1.5 text-[11.5px] font-semibold text-violet disabled:opacity-40"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={copy} className="rounded-[9px] border border-line px-3 py-1.5 text-[11.5px] font-semibold text-body">
              {copied ? "Copié ✓" : "Copier"}
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="rounded-[9px] px-2 py-1.5 text-[11.5px] font-semibold text-muted disabled:opacity-40"
            >
              {loading ? "…" : "Régénérer"}
            </button>
          </div>
        </div>
      ) : draft ? (
        <div className="rounded-[13px] border border-line-soft bg-tint-soft/60 p-3">
          <p className="text-[12.5px] font-semibold text-ink">Objet : {draft.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-body">{draft.body}</p>
          <button type="button" onClick={copy} className="mt-2 rounded-[9px] border border-line px-3 py-1.5 text-[11.5px] font-semibold text-body">
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
      ) : null}
      <p className="mt-2 text-[10.5px] text-faint">
        Préparé par l&apos;agent — rien n&apos;est envoyé.
      </p>
    </section>
  );
}
