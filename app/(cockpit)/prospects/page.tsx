import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  prospectPriority,
  selectDormantProspects,
} from "@/lib/analysis-rules";
import {
  createSupabaseProspectReader,
  DEFAULT_PROSPECT_MAX_ROWS,
  loadProspectCohort,
} from "@/lib/prospect-cohort-loader";
import { ProspectCountSummary } from "./_components/prospect-count-summary";
import {
  ProspectFilters,
  type ProspectView,
} from "./_components/prospect-filters";
import {
  ProspectsBoard,
  type BoardProspect,
  type StageGroup,
} from "./_components/prospects-board";

const NO_STAGE = "Sans statut";

function selectedView(value: string | undefined): ProspectView {
  if (value === "relaunchable" || value === "dormant") return value;
  return "all";
}

function lastSyncLabel(prospects: BoardProspect[]): string {
  const latest = prospects[0]?.synced_at;
  if (!latest) return "synchronisation inconnue";
  return `dernière synchronisation ${new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(latest))}`;
}

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view = selectedView(rawView);
  const { supabase, user } = await getCurrentAuthContext();
  if (!user) redirect("/login");

  const prospectCohort = await loadProspectCohort(
    createSupabaseProspectReader(supabase),
    { maxRows: DEFAULT_PROSPECT_MAX_ROWS },
  );
  const prospects =
    prospectCohort.status === "complete"
      ? (prospectCohort.dedupedRows as BoardProspect[])
      : [];
  const today = new Date().toISOString().slice(0, 10);
  const visualMissingEmailCount = prospects.filter(
    (prospect) => !(prospect.email ?? "").trim(),
  ).length;
  const conservativeMissingEmailCount =
    prospectCohort.status === "complete"
      ? prospectCohort.canonicalRows.filter(
          (prospect) => !(prospect.email ?? "").trim(),
        ).length
      : 0;
  const visualPriorityCount = prospects.filter(
    (prospect) => prospectPriority(prospect, today).tier === "priority",
  ).length;
  const actionablePriorityCount =
    prospectCohort.status === "complete"
      ? prospectCohort.canonicalRows.filter(
          (prospect) => prospectPriority(prospect, today).tier === "priority",
        ).length
      : 0;
  const activeStageConflictCount =
    prospectCohort.status === "complete"
      ? prospectCohort.canonicalRows.filter(
          (prospect) => prospect.cohort_conflict === "active_stage_conflict",
        ).length
      : 0;
  const explainMissingEmailCohort =
    prospectCohort.status === "complete" &&
    (prospectCohort.canonicalCount !== prospectCohort.dedupedCount ||
      conservativeMissingEmailCount !== visualMissingEmailCount);
  const priorityCountsDiffer = visualPriorityCount !== actionablePriorityCount;
  const explainPriorityCohort = priorityCountsDiffer || activeStageConflictCount > 0;

  const actionableIds = new Set(
    prospectCohort.status === "complete"
      ? prospectCohort.canonicalRows
          .filter((prospect) => prospectPriority(prospect, today).tier === "priority")
          .map((prospect) => prospect.id)
      : [],
  );
  const dormantIds = new Set(
    prospectCohort.status === "complete"
      ? selectDormantProspects(prospectCohort.canonicalRows, today, 30).map(
          (prospect) => prospect.id,
        )
      : [],
  );
  const visibleProspects = prospects.filter((prospect) => {
    if (view === "relaunchable") return actionableIds.has(prospect.id);
    if (view === "dormant") return dormantIds.has(prospect.id);
    return true;
  });

  const byStage = new Map<string, BoardProspect[]>();
  for (const prospect of visibleProspects) {
    const stage = (prospect.stage ?? "").trim() || NO_STAGE;
    const list = byStage.get(stage) ?? [];
    list.push(prospect);
    byStage.set(stage, list);
  }
  const groups: StageGroup[] = [...byStage.entries()]
    .map(([stage, list]) => ({ stage, prospects: list }))
    .sort((left, right) => right.prospects.length - left.prospects.length);

  return (
    <>
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight">Prospects</h1>

      {prospectCohort.status !== "complete" ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-8 text-center shadow-card">
          <p className="text-[13.5px] font-medium text-ink">
            Vue prospects temporairement suspendue
          </p>
          <p className="mx-auto mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-muted">
            {prospectCohort.status === "partial"
              ? `${prospectCohort.importedCount.toLocaleString("fr-FR")} lignes importées dépassent la borne de ${prospectCohort.maxRows.toLocaleString("fr-FR")}.`
              : "La cohorte complète n’a pas pu être vérifiée."} Aucun board,
            total ou taux partiel n&apos;est affiché.
          </p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-8 text-center shadow-card">
          <p className="text-[13.5px] font-medium text-ink">
            Aucun prospect pour l&apos;instant
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] text-muted">
            Connectez un outil puis lancez une synchronisation.
          </p>
          <Link
            href="/entreprise?onglet=connecteurs"
            className="mt-4 inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white"
          >
            Ouvrir les connecteurs
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[13px] border border-line-soft bg-white px-4 py-3 shadow-card">
            <ProspectCountSummary
              total={prospectCohort.dedupedCount}
              relaunchable={actionablePriorityCount}
              explanation={
                <>
                  {explainMissingEmailCohort && (
                    <p>
                      Ce tableau regroupe {prospectCohort.dedupedCount.toLocaleString("fr-FR")} contacts pour la lecture, dont {visualMissingEmailCount.toLocaleString("fr-FR")} sans email. Pour sécuriser les relances, l&apos;agent conserve {prospectCohort.canonicalCount.toLocaleString("fr-FR")} identités dans sa cohorte métier prudente, dont {conservativeMissingEmailCount.toLocaleString("fr-FR")} fiches importées sans email. Sans email, il ne suppose pas que deux homonymes issus de sources différentes sont la même personne.
                    </p>
                  )}
                  {explainPriorityCohort && (
                    <p className={explainMissingEmailCohort ? "mt-2" : undefined}>
                      Priorités : {visualPriorityCount.toLocaleString("fr-FR")} visibles · {actionablePriorityCount.toLocaleString("fr-FR")} actionnables. Un statut terminal ou une opposition, un contact récent ou des statuts actifs contradictoires conduisent l&apos;agent à retenir la lecture la plus prudente avant toute relance. {activeStageConflictCount.toLocaleString("fr-FR")} contact{activeStageConflictCount > 1 ? "s" : ""} présente{activeStageConflictCount > 1 ? "nt" : ""} un conflit actif.
                    </p>
                  )}
                  {!explainMissingEmailCohort && !explainPriorityCohort && (
                    <p>Le total de lecture et la cohorte métier prudente concordent.</p>
                  )}
                </>
              }
            />
            <ProspectFilters active={view} />
          </div>

          {visibleProspects.length === 0 ? (
            <p className="rounded-[13px] border border-line-soft bg-white px-4 py-8 text-center text-[13px] text-muted">
              Aucun prospect dans cette cohorte.
            </p>
          ) : (
            <ProspectsBoard groups={groups} today={today} />
          )}

          <p className="mt-3 text-[11px] text-faint">
            Lecture seule depuis vos outils connectés · {lastSyncLabel(prospects)} · {prospectCohort.importedCount.toLocaleString("fr-FR")} lignes importées, {prospectCohort.dedupedCount.toLocaleString("fr-FR")} fiches dédoublonnées, {prospectCohort.maskedCount.toLocaleString("fr-FR")} doublons masqués.
          </p>
        </>
      )}
    </>
  );
}
