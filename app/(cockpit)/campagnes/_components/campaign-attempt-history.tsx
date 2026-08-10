import type { CampaignPastAttempt } from "./campaign-decision-types";
import { EvidenceReference, InlineEmptyState } from "./campaign-evidence";

export function CampaignAttemptHistory({
  attempts,
  visibleAttempts,
}: {
  attempts: CampaignPastAttempt[];
  visibleAttempts: CampaignPastAttempt[];
}) {
  return (
    <section aria-labelledby="campaign-attempts-title" className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card">
      <h3 id="campaign-attempts-title" className="border-b border-line-soft px-4 py-4 font-display text-[15px] font-semibold text-ink sm:px-[22px]">
        Historique des décisions
      </h3>
      {visibleAttempts.length > 0 ? (
        <ul className="divide-y divide-line-soft">
          {visibleAttempts.map((attempt) => (
            <li key={attempt.id} className="px-4 py-3.5 sm:px-[22px]">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[13px] font-semibold text-ink">{attempt.name}</h4>
                    <span className="rounded-full bg-tint-soft px-2 py-0.5 text-[10.5px] font-semibold text-body">
                      {attempt.channel.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-body">{attempt.outcome}</p>
                  {attempt.learning && (
                    <p className="mt-1 text-[11.5px] text-muted">
                      <span className="font-semibold text-body">Motif enregistré :</span>{" "}
                      {attempt.learning}
                    </p>
                  )}
                </div>
                <div className="flex-none text-[10.5px] text-faint sm:text-right">
                  <p>{attempt.periodLabel}</p>
                  <EvidenceReference source={attempt.source} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-7 sm:px-[22px]">
          <InlineEmptyState>
            {attempts.length === 0
              ? "Aucune décision antérieure sourcée n’est disponible."
              : "Aucune décision antérieure ne correspond au canal sélectionné."}
          </InlineEmptyState>
        </div>
      )}
    </section>
  );
}
