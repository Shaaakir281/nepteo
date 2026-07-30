"use client";

import { useEffect, useState } from "react";
import { prospectsForAction, type TargetProspect } from "../actions";
import { ActionValueFeedback } from "./action-value-feedback";

/**
 * Saisie des suites terrain après décision, prospect par prospect.
 *
 * Une action de relance peut viser plusieurs personnes : rattacher la preuve au
 * prospect évite qu'une seule déclaration soit interprétée comme le résultat
 * de tout le lot.
 */
export function ActionOutcomesDisclosure({ actionId }: { actionId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-[11px] bg-tint-soft px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="w-full text-left text-[12px] font-semibold text-violet"
      >
        Déclarer les suites terrain {open ? "−" : "+"}
      </button>
      {open && (
        <>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Indiquez, pour chaque prospect, une relance envoyée hors de Nepteo,
            une réponse, un rendez-vous ou une opportunité.
          </p>
          <ActionOutcomes actionId={actionId} />
        </>
      )}
    </div>
  );
}

function ActionOutcomes({ actionId }: { actionId: string }) {
  const [prospects, setProspects] = useState<TargetProspect[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    prospectsForAction(actionId)
      .then((result) => {
        if (alive) setProspects(result.ok ? result.prospects : []);
      })
      .catch(() => {
        if (alive) setProspects([]);
      });
    return () => {
      alive = false;
    };
  }, [actionId]);

  if (prospects === null) {
    return (
      <p className="mt-2 text-[12px] italic text-muted">
        Chargement des prospects concernés…
      </p>
    );
  }

  if (prospects.length === 0) {
    return (
      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        Aucune cible historisée n&apos;est disponible pour cette relance.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {prospects.map((prospect) => {
        const open = openId === prospect.id;
        return (
          <div
            key={prospect.id}
            className="rounded-[10px] border border-line-soft bg-white"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : prospect.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
            >
              <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
                {prospect.name ?? prospect.email ?? "Prospect"}
                {prospect.company && (
                  <span className="text-muted"> · {prospect.company}</span>
                )}
              </span>
              <span className="flex-none text-[12px] text-muted">
                {open ? "−" : "+"}
              </span>
            </button>
            {open && (
              <div className="border-t border-line-soft px-3 pb-3">
                <ActionValueFeedback
                  actionId={actionId}
                  prospectId={prospect.id}
                  mode="outcomes"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
