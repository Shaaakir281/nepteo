"use client";

import { useEffect, useState } from "react";
import type { Draft } from "@/lib/draft-template";
import { draftForAction, saveDraftEdit } from "../actions";
import { ValidationSection } from "./validation-section";

/** « Message prêt à envoyer » — l'agent rédige à l'ouverture, rien n'est envoyé. */
export function ActionDraftEditor({
  id,
  canEdit,
}: {
  id: string;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  async function load(regenerate: boolean) {
    setLoading(true);
    setFailed(false);
    try {
      const res = await draftForAction(id, regenerate);
      if (res.ok) setDraft(res.draft);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // Génère (ou récupère) le brouillon dès l'ouverture, pour chaque action.
  useEffect(() => {
    let alive = true;
    draftForAction(id, false)
      .then((res) => {
        if (!alive) return;
        if (res.ok) setDraft(res.draft);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  function startEdit() {
    if (!draft) return;
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await saveDraftEdit(id, editSubject, editBody);
      if (res.ok) {
        setDraft(res.draft);
        setEditing(false);
      }
    } catch {
      /* échec silencieux : le brouillon reste éditable */
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        `Objet : ${draft.subject}\n\n${draft.body}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible : sans effet */
    }
  }

  return (
    <>
      <ValidationSection label="Message prêt à envoyer" />
      {loading && !draft ? (
        <p className="text-[12.5px] italic text-muted">
          L&apos;agent rédige le message…
        </p>
      ) : failed ? (
        <p className="text-[12.5px] text-muted">
          Brouillon indisponible pour l&apos;instant.
        </p>
      ) : draft && editing ? (
        <div className="rounded-[13px] border border-violet/30 bg-white p-4">
          <label className="mb-1 block text-[11px] font-semibold text-faint">
            Objet
          </label>
          <input
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            className="w-full rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] text-ink focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
          />
          <label className="mb-1 mt-3 block text-[11px] font-semibold text-faint">
            Message
          </label>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={9}
            className="w-full resize-y rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed text-body focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={
                saving || !editSubject.trim() || editBody.trim().length < 10
              }
              className="rounded-[9px] bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-[9px] bg-tint-soft px-3 py-1.5 text-[12px] font-semibold text-body transition hover:bg-tint"
            >
              Annuler
            </button>
          </div>
          <p className="mt-2.5 text-[11px] text-faint">
            Gardez le repère {"{prénom}"} — il sera remplacé par le prénom de
            chaque destinataire à l&apos;envoi.
          </p>
        </div>
      ) : draft ? (
        <div className="rounded-[13px] border border-line-soft bg-tint-soft/60 p-4">
          <p className="text-[12.5px] font-semibold text-ink">
            Objet : {draft.subject}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-body">
            {draft.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-[9px] bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
            >
              {copied ? "Copié ✓" : "Copier"}
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-[9px] bg-tint px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => load(true)}
                  disabled={loading}
                  className="rounded-[9px] bg-tint px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white disabled:opacity-50"
                >
                  {loading ? "…" : "Régénérer"}
                </button>
              </>
            )}
          </div>
          <p className="mt-2.5 text-[11px] text-faint">
            Préparé par l&apos;agent — rien n&apos;est envoyé. À vous de le
            relire, le modifier et l&apos;adresser.
          </p>
        </div>
      ) : null}
    </>
  );
}
