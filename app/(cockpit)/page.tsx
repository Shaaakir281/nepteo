import { getCurrentAuthContext } from "@/lib/auth/context";
import { ValidationQueue } from "./_components/validation-queue";
import { DecisionsHistory } from "./_components/decisions-history";
import { StarterDiagnosticCard } from "./_components/starter-diagnostic";
import { StarterDiagnosticDetails } from "./_components/starter-diagnostic-details";
import { PlanBanner } from "./_components/plan-banner";
import { DormantPlayLauncher } from "./_components/dormant-play-launcher";
import { ValueScorecard } from "./_components/value-scorecard";
import { briefingDataSourceLabel } from "@/lib/demo/presentation-rules";
import { WalkthroughProgress } from "./_components/walkthrough-progress";
import { TodayPriorityHero } from "./_components/today-priority-hero";
import { TodayDetails } from "./_components/today-details";
import { TodayFooter } from "./_components/today-footer";
import { AnalysisRunner } from "./_components/analysis-runner";
import { WalkthroughCompletion } from "./_components/walkthrough-completion";
import { loadTodayQueueData } from "./_lib/today-queue-data";
import { loadTodayDashboardData } from "./_lib/today-dashboard-data";
import { loadTodayScorecardData } from "./_lib/today-scorecard-data";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{
    decision_error?: string;
    walkthrough?: string;
  }>;
}) {
  const { decision_error: decisionError, walkthrough } = await searchParams;
  const { supabase, membership } = await getCurrentAuthContext();
  const canEdit = membership?.canEdit ?? false;
  const canViewFinancials = membership?.canViewFinancials ?? false;

  const {
    queue,
    decided,
    executionPaused,
    briefing,
    briefingPresentation,
  } = await loadTodayQueueData(supabase, membership);

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { diagnostic, kpis, prospectCohort, today } =
    await loadTodayDashboardData(supabase, canViewFinancials);

  const {
    valueScorecard,
    valueScorecardIncomplete,
    valueScorecardReadFailed,
  } = await loadTodayScorecardData(supabase, canEdit);

  return (
    <>
      {walkthrough === "decision" && (
        <WalkthroughCompletion
          missions={["summary", "priorities", "rationale", "customize", "decide"]}
        />
      )}
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-cherry">
          Aujourd&apos;hui
        </h1>
        <WalkthroughProgress />
      </header>

      {decisionError === "rejection_reason" && (
        <div role="alert" className="mb-5 rounded-[12px] bg-red-tint px-4 py-3 text-[12.5px] text-red">
          Le refus n&apos;a pas été enregistré : indiquez une raison de 3 à 500 caractères.
        </div>
      )}

      {diagnostic ? (
        <StarterDiagnosticCard diagnostic={diagnostic} />
      ) : queue[0] ? (
        <TodayPriorityHero action={queue[0]} canEdit={canEdit} />
      ) : (
        <section className="rounded-[20px] border border-line-soft bg-white px-6 py-7 shadow-card sm:px-9 sm:py-8">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet-ink">
            À faire maintenant
          </p>
          <h2 className="mt-4 font-display text-[24px] font-medium text-ink sm:text-[29px]">
            Analysez vos données.
          </h2>
          {canEdit && (
            <div className="mt-6">
              <AnalysisRunner variant="hero" />
            </div>
          )}
        </section>
      )}

      <div id="file-decisions" className="mt-3.5">
        <div className="rounded-[13px] border border-line-soft bg-white shadow-card">
          {queue.length > 0 && (
            <div className="flex items-center justify-between border-b border-line-soft px-[18px] py-3.5">
              <h3 className="font-display text-[14px] font-semibold">
                Vos prochaines décisions
              </h3>
              <span className="text-[11.5px] text-muted">
                {queue.length} à valider
              </span>
            </div>
          )}
          <ValidationQueue
            actions={!diagnostic && queue[0] ? queue.slice(1) : queue}
            canEdit={canEdit}
            showEmptyState={Boolean(diagnostic || !queue[0])}
          />
        </div>
      </div>

      <div className="mt-3">
        {diagnostic && <StarterDiagnosticDetails diagnostic={diagnostic} />}

        {briefing && (
          <TodayDetails title="Le point de l'agent">
            <p className="text-[12.5px] leading-relaxed text-ink">
              {briefing.content}
            </p>
            <p className="mt-2 text-[11px] text-faint">
              Mis à jour le {fmt.format(new Date(briefing.created_at))} ·{" "}
              {briefingDataSourceLabel(briefingPresentation)}
            </p>
          </TodayDetails>
        )}

        {!diagnostic && (
          <TodayDetails title="Indicateurs" count={kpis.length}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-[12px] bg-tint-soft p-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
                    {kpi.label}
                  </p>
                  <p className="mt-1 font-display text-[20px] font-semibold text-ink">
                    {kpi.value}
                  </p>
                  <p className="text-[11px] text-muted">{kpi.hint}</p>
                </div>
              ))}
            </div>
          </TodayDetails>
        )}

        {!diagnostic && (
          <TodayDetails title="Cap du mois">
            <PlanBanner
              prospectCohort={
                prospectCohort.status === "complete"
                  ? prospectCohort.canonicalRows
                  : null
              }
              today={today}
            />
          </TodayDetails>
        )}

        {!diagnostic && canEdit && (
          <TodayDetails title="Prospects dormants">
            <DormantPlayLauncher />
          </TodayDetails>
        )}

        <TodayDetails title="Suivi et historique">
          <div className="overflow-hidden rounded-[11px] border border-line-soft bg-white">
            <div className="border-b border-line-soft px-[18px] py-3">
              <h3 className="font-display text-[14px] font-semibold">
                Décisions récentes
              </h3>
            </div>
            <DecisionsHistory actions={decided} canEdit={canEdit} />
          </div>

          {!diagnostic && canEdit && valueScorecard && (
            <div className="mt-4">
              <ValueScorecard scorecard={valueScorecard} />
            </div>
          )}
          {!diagnostic && canEdit &&
            (valueScorecardIncomplete || valueScorecardReadFailed) && (
              <p className="mt-4 rounded-[10px] bg-tint-soft px-4 py-3 text-[12px] text-muted">
                Scorecard indisponible : une agrégation complète et des permissions
                à jour sont requises avant d&apos;afficher les résultats.
              </p>
            )}
        </TodayDetails>
      </div>

      <TodayFooter canEdit={canEdit} executionPaused={executionPaused} />
    </>
  );
}
