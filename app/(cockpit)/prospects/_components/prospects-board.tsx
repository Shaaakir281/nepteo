import { prospectPriority } from "@/lib/analysis-rules";

export interface BoardProspect {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  last_contact_at: string | null;
  synced_at: string;
}

export interface StageGroup {
  stage: string;
  prospects: BoardProspect[];
}

const CARDS_PER_COLUMN = 12;

function contactDelay(prospect: BoardProspect, today: string): string {
  const days = prospectPriority(prospect, today).daysSinceContact;
  if (days === undefined) return "—";
  if (days === 0) return "auj.";
  return `${days} j`;
}

export function ProspectsBoard({
  groups,
  today,
}: {
  groups: StageGroup[];
  today: string;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {groups.map((group) => (
        <section
          key={group.stage}
          className="w-[250px] flex-none rounded-[13px] border border-line-soft bg-tint-soft p-2.5"
        >
          <h2 className="flex items-center justify-between px-2 pb-2.5 pt-1 text-[12px] font-semibold text-body">
            <span>{group.stage}</span>
            <span className="tabular-nums text-muted">
              {group.prospects.length.toLocaleString("fr-FR")}
            </span>
          </h2>
          <div className="space-y-1.5">
            {group.prospects.slice(0, CARDS_PER_COLUMN).map((prospect) => (
              <details
                key={prospect.id}
                className="group rounded-[10px] border border-line bg-white px-3 py-2 shadow-[0_1px_2px_rgba(25,23,49,.04)]"
              >
                <summary
                  title={prospect.company ?? undefined}
                  className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12.5px] marker:content-none"
                >
                  <b className="min-w-0 truncate font-semibold text-ink">
                    {prospect.name ?? prospect.email ?? "Sans nom"}
                  </b>
                  <span className="flex-none tabular-nums text-faint">
                    {contactDelay(prospect, today)}
                  </span>
                </summary>
                <div className="mt-2 border-t border-line-soft pt-2 text-[11.5px] leading-relaxed text-muted">
                  <p>{prospect.company ?? "Entreprise non renseignée"}</p>
                  <p className="truncate">{prospect.email ?? "Email manquant"}</p>
                </div>
              </details>
            ))}
            {group.prospects.length > CARDS_PER_COLUMN && (
              <p className="px-1 pt-1 text-[11.5px] text-muted">
                + {group.prospects.length - CARDS_PER_COLUMN} autre
                {group.prospects.length - CARDS_PER_COLUMN > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
