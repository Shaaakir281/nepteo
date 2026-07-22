"use client";

import { useEffect, useState } from "react";
import {
  draftForProspect,
  prospectsForAction,
  type TargetProspect,
} from "../actions";

interface Draft {
  subject: string;
  body: string;
}

/**
 * Personnalisation par prospect (Phase 2) — liste les contacts ciblés par une
 * relance ; chacun peut recevoir un brouillon individuel, appuyé sur ses notes
 * et toutes ses colonnes. L'agent prépare, rien n'est envoyé.
 */
export function ProspectDrafts({
  actionId,
  canEdit,
}: {
  actionId: string;
  canEdit: boolean;
}) {
  const [list, setList] = useState<TargetProspect[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setList(null);
    setOpenId(null);
    prospectsForAction(actionId)
      .then((res) => alive && setList(res.ok ? res.prospects : []))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [actionId]);

  if (list === null) {
    return (
      <p className="mt-2 text-[12.5px] italic text-muted">
        Chargement des prospects concernés…
      </p>
    );
  }
  if (list.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {list.map((p) => (
        <ProspectRow
          key={p.id}
          actionId={actionId}
          prospect={p}
          canEdit={canEdit}
          open={openId === p.id}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
        />
      ))}
    </div>
  );
}

function ProspectRow({
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

  async function load(regenerate: boolean) {
    setLoading(true);
    setFailed(false);
    try {
      const res = await draftForProspect(actionId, prospect.id, regenerate);
      if (res.ok) setDraft(res.draft);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // Génère (ou récupère) le brouillon à la première ouverture.
  useEffect(() => {
    if (open && !draft && !loading) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(
        `Objet : ${draft.subject}\n\n${draft.body}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <div className="rounded-[10px] border border-line-soft">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
          {prospect.name ?? prospect.email ?? "Prospect"}
          {prospect.company && (
            <span className="text-muted"> · {prospect.company}</span>
          )}
        </span>
        <span className="flex flex-none items-center gap-1.5">
          {prospect.hasNotes && (
            <span className="rounded-full bg-tint px-2 py-[2px] text-[10px] font-semibold text-violet">
              Notes
            </span>
          )}
          <span className="text-[12px] text-muted">{open ? "−" : "+"}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-line-soft px-3 py-2.5">
          {loading && !draft ? (
            <p className="text-[12px] italic text-muted">
              L&apos;agent personnalise le message…
            </p>
          ) : failed ? (
            <p className="text-[12px] text-muted">Brouillon indisponible.</p>
          ) : draft ? (
            <>
              <p className="text-[12px] font-semibold text-ink">
                Objet : {draft.subject}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-body">
                {draft.body}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-[8px] bg-violet px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-violet-deep"
                >
                  {copied ? "Copié ✓" : "Copier"}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => load(true)}
                    disabled={loading}
                    className="rounded-[8px] bg-tint px-2.5 py-1 text-[11.5px] font-semibold text-violet transition hover:bg-violet hover:text-white disabled:opacity-50"
                  >
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
