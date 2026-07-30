"use client";

import { useState } from "react";
import Link from "next/link";
import { AnalysisRunner } from "./analysis-runner";
import {
  ValidationDrawer,
  type QueueAction,
} from "./validation-drawer";
import type { TodayPriority } from "@/lib/today-priority-rules";

export type { QueueAction } from "./validation-drawer";

export function ValidationQueue({
  actions,
  canEdit,
}: {
  actions: TodayPriority<QueueAction>[];
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = actions.find((action) => action.id === openId) ?? null;

  if (actions.length === 0) {
    return (
      <div className="px-[22px] py-8 text-center">
        <p className="text-[13.5px] font-medium text-ink">
          Rien à valider pour l&apos;instant
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
          Synchronisez un connecteur puis lancez l&apos;analyse — l&apos;agent
          proposera ses premières actions ici.
        </p>
        {canEdit && (
          <>
            <div className="mt-4 flex justify-center">
              <AnalysisRunner variant="primary" />
            </div>
            <p className="mx-auto mt-3 max-w-sm text-[12px] leading-relaxed text-faint">
              Pas encore d&apos;outil à brancher ?{" "}
              <Link
                href="/entreprise?onglet=connecteurs"
                className="font-semibold text-violet hover:underline"
              >
                Chargez une entreprise de démonstration
              </Link>{" "}
              — identité, prospects, campagnes et ventes en un clic. Attention :
              cela remplace l&apos;identité que vous venez de saisir.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => setOpenId(action.id)}
          className="block w-full border-t border-line-soft px-[22px] py-3.5 text-left transition hover:bg-tint-soft first:border-t-0"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink">
              {action.title}
            </span>
            <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet">
              Examiner
            </span>
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
            {action.finding}
          </span>
          <span className="mt-2 block border-l-2 border-violet/30 pl-2.5">
            <span className="block text-[10px] font-semibold uppercase tracking-[.07em] text-faint">
              Pourquoi maintenant
            </span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-body">
              {action.whyNow}
            </span>
          </span>
        </button>
      ))}

      {canEdit && (
        <div className="border-t border-line-soft px-[22px] py-3">
          <AnalysisRunner variant="link" />
        </div>
      )}

      <ValidationDrawer
        action={active}
        canEdit={canEdit}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
