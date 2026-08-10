import type { CampaignActivityEvent } from "./campaign-decision-types";
import { EvidenceReference } from "./campaign-evidence";

export function CampaignActivityList({ activity }: { activity: CampaignActivityEvent[] }) {
  if (activity.length === 0) return null;
  return (
    <details className="rounded-[14px] border border-line-soft bg-white px-4 shadow-card sm:px-[22px]">
      <summary className="cursor-pointer py-4 font-display text-[14px] font-semibold text-ink">
        Activité vérifiable · {activity.length}
      </summary>
      <ol className="divide-y divide-line-soft border-t border-line-soft pb-2">
        <li className="py-2 text-[11px] text-muted">
          Uniquement les événements enregistrés dans le journal CAMP-2.
        </li>
        {activity.map((event) => (
          <li key={event.id} className="py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <div>
                <p className="text-[12.5px] font-semibold text-ink">{event.title}</p>
                <p className="mt-0.5 text-[11.5px] text-body">{event.detail}</p>
              </div>
              <p className="flex-none text-[10.5px] tabular-nums text-faint">{event.atLabel}</p>
            </div>
            <EvidenceReference source={event.source} className="mt-1" />
          </li>
        ))}
      </ol>
    </details>
  );
}
