import { resumeAction } from "../actions";

export interface DecidedAction {
  id: string;
  title: string;
  status: string;
  decided_at: string | null;
}

const DECISION_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "Validée", cls: "bg-green-tint text-green" },
  rejected: { label: "Refusée", cls: "bg-red-tint text-red" },
  postponed: { label: "Reportée", cls: "bg-amber-tint text-amber" },
};

const fmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function DecisionsHistory({
  actions,
  canEdit,
}: {
  actions: DecidedAction[];
  canEdit: boolean;
}) {
  if (actions.length === 0) {
    return (
      <div className="px-[22px] py-8 text-center text-[12.5px] text-muted">
        Aucune décision pour l&apos;instant — vos validations, reports et refus
        apparaîtront ici.
      </div>
    );
  }

  return (
    <ul>
      {actions.map((a) => {
        const badge = DECISION_BADGE[a.status] ?? {
          label: a.status,
          cls: "bg-tint-soft text-body",
        };
        return (
          <li
            key={a.id}
            className="flex items-center gap-3 border-t border-line-soft px-[22px] py-3 first:border-t-0"
          >
            <span
              className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">
                {a.title}
              </span>
              {a.decided_at && (
                <span className="block text-[11.5px] text-faint">
                  {fmt.format(new Date(a.decided_at))} · Vous
                </span>
              )}
            </span>
            {canEdit && a.status === "postponed" && (
              <form action={resumeAction} className="flex-none">
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="rounded-[9px] bg-tint px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
                >
                  Reprendre
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
