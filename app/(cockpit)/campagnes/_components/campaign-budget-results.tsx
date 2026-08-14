import type { BudgetResultsSnapshot } from "@/lib/budget-results";
import { SnapshotMetadata, StateBanner } from "./campaign-budget-results-format";
import { CampaignBudgets, WindowCard } from "./campaign-budget-results-windows";

export function CampaignBudgetResults({ snapshot }: { snapshot: BudgetResultsSnapshot }) {
  const currency = snapshot.account?.currency ?? null;
  return (
    <section
      aria-labelledby="campaign-budget-results-title"
      className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card"
    >
      <div className="border-b border-line-soft px-4 py-4 sm:px-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
          Observations Meta en lecture seule
        </p>
        <h2 id="campaign-budget-results-title" className="mt-1 font-display text-[17px] font-semibold text-ink">
          Budget et résultats
        </h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">
          Les montants prévus ne sont comparés qu’après un rapprochement explicite. Toute valeur non observée reste indisponible.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <StateBanner snapshot={snapshot} />
        <SnapshotMetadata snapshot={snapshot} />

        <details className="rounded-[10px] border border-line-soft px-3 py-2.5 text-[10px] text-muted">
          <summary className="cursor-pointer font-semibold text-violet">Traçabilité du snapshot</summary>
          <dl className="mt-2 grid gap-1.5 sm:grid-cols-3">
            <div><dt className="inline">Campagnes : </dt><dd className="inline tabular-nums text-body">{snapshot.provenance.campaignRows}</dd></div>
            <div><dt className="inline">Mesures : </dt><dd className="inline tabular-nums text-body">{snapshot.provenance.metricRows}</dd></div>
            <div><dt className="inline">Résultats : </dt><dd className="inline tabular-nums text-body">{snapshot.provenance.resultRows}</dd></div>
            <div><dt className="inline">Collectes : </dt><dd className="inline tabular-nums text-body">{snapshot.provenance.syncRunRows}</dd></div>
            <div><dt className="inline">Plans lus : </dt><dd className="inline tabular-nums text-body">{snapshot.provenance.plannedActionRows}</dd></div>
            <div><dt className="inline">Liens explicites : </dt><dd className="inline tabular-nums text-body">{snapshot.provenance.budgetLinkRows}</dd></div>
          </dl>
        </details>

        {snapshot.windows.length > 0 && (
          <section aria-labelledby="budget-results-account-window-title">
            <h3 id="budget-results-account-window-title" className="text-[13px] font-semibold text-ink">
              Vue du compte
            </h3>
            <div className="mt-2 grid gap-3 xl:grid-cols-2">
              {snapshot.windows.map((window) => (
                <WindowCard key={window.days} window={window} currency={currency} />
              ))}
            </div>
          </section>
        )}

        {snapshot.campaigns.length > 0 ? (
          <section aria-labelledby="budget-results-campaigns-title">
            <h3 id="budget-results-campaigns-title" className="text-[13px] font-semibold text-ink">
              Campagnes déclarées par Meta
            </h3>
            <div className="mt-2 space-y-3">
              {snapshot.campaigns.map((campaign) => (
                <details key={campaign.campaignId} className="rounded-[12px] border border-line-soft bg-white px-3.5 py-3" open={snapshot.campaigns.length === 1}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-[12px] font-semibold text-ink">{campaign.campaignName}</h4>
                        <p className="mt-0.5 break-all text-[9.5px] text-faint">{campaign.campaignId}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[9px] font-semibold">
                        <span className="rounded-full bg-tint px-2 py-0.5 text-violet">{campaign.effectiveStatus}</span>
                        {campaign.objective && <span className="rounded-full bg-tint-soft px-2 py-0.5 text-body">{campaign.objective}</span>}
                      </div>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
                    <CampaignBudgets campaign={campaign} timezone={snapshot.account?.timezone ?? null} />
                    <div className="grid gap-3 xl:grid-cols-2">
                      {campaign.windows.map((window) => (
                        <WindowCard key={window.days} window={window} currency={currency} />
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : (
          <p className="rounded-[10px] border border-line-soft bg-tint-soft/35 px-3 py-3 text-[11px] text-muted">
            Aucune campagne présentable dans ce snapshot.
          </p>
        )}
      </div>
    </section>
  );
}
