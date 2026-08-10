"use client";

import { useEffect, useState } from "react";
import { prospectsForAction, type TargetProspect } from "../actions";
import { ProspectDraftRow } from "./prospect-draft-row";

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
    prospectsForAction(actionId)
      .then((result) => alive && setList(result.ok ? result.prospects : []))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [actionId]);

  if (!list?.length) return null;

  return (
    <details className="mt-3 rounded-[11px] border border-line-soft bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[12px] font-semibold text-ink">
        <span>Personnaliser par prospect</span>
        <span className="text-[10.5px] text-faint">{list.length}</span>
      </summary>
      <div className="space-y-1.5 border-t border-line-soft p-2.5">
        {list.map((prospect) => (
          <ProspectDraftRow
            key={prospect.id}
            actionId={actionId}
            prospect={prospect}
            canEdit={canEdit}
            open={openId === prospect.id}
            onToggle={() => setOpenId(openId === prospect.id ? null : prospect.id)}
          />
        ))}
      </div>
    </details>
  );
}
