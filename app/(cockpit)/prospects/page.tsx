import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  ProspectsBoard,
  type BoardProspect,
  type StageGroup,
} from "./_components/prospects-board";
import { CoachBubble } from "@/components/ui/coach-bubble";
import {
  createSupabaseProspectReader,
  DEFAULT_PROSPECT_MAX_ROWS,
  loadProspectCohort,
} from "@/lib/prospect-cohort-loader";
import { prospectPriority } from "@/lib/analysis-rules";

const NO_STAGE = "Sans statut";

export default async function ProspectsPage() {
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
          (prospect) =>
            prospect.cohort_conflict === "active_stage_conflict",
        ).length
      : 0;
  const explainMissingEmailCohort =
    prospectCohort.status === "complete" &&
    (prospectCohort.canonicalCount !== prospectCohort.dedupedCount ||
      conservativeMissingEmailCount !== visualMissingEmailCount);
  const priorityCountsDiffer =
    visualPriorityCount !== actionablePriorityCount;
  const explainPriorityCohort =
    priorityCountsDiffer || activeStageConflictCount > 0;
  const explainConservativeCohort =
    explainMissingEmailCohort || explainPriorityCohort;

  // Regroupement uniquement sur une cohorte complète : aucun total partiel ne
  // doit alimenter le funnel ou le board.
  const byStage = new Map<string, BoardProspect[]>();
  for (const p of prospects) {
    const s = (p.stage ?? "").trim() || NO_STAGE;
    let list = byStage.get(s);
    if (!list) {
      list = [];
      byStage.set(s, list);
    }
    list.push(p);
  }
  const groups: StageGroup[] = [...byStage.entries()]
    .map(([stage, list]) => ({ stage, prospects: list }))
    .sort((a, b) => b.prospects.length - a.prospects.length);

  return (
    <>
      <CoachBubble id="prospects" />
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Prospects</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Vos contacts regroupés par statut, en lecture seule depuis vos outils
          connectés.
        </p>
      </div>

      {prospectCohort.status !== "complete" ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-8 text-center shadow-card">
          <p className="text-[13.5px] font-medium text-ink">
            Vue prospects temporairement suspendue
          </p>
          <p className="mx-auto mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-muted">
            {prospectCohort.status === "partial"
              ? `${prospectCohort.importedCount.toLocaleString("fr-FR")} lignes importées dépassent la borne de ${prospectCohort.maxRows.toLocaleString("fr-FR")}.`
              : "La cohorte complète n’a pas pu être vérifiée."}{" "}
            Aucun board, total ou taux partiel n&apos;est affiché.
          </p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-8 text-center shadow-card">
          <p className="text-[13.5px] font-medium text-ink">
            Aucun prospect pour l&apos;instant
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            Connectez Google Sheets ou Notion puis lancez une synchronisation —
            vos contacts apparaîtront ici.
          </p>
          <Link
            href="/entreprise?onglet=connecteurs"
            className="mt-4 inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
          >
            Ouvrir les connecteurs
          </Link>
        </div>
      ) : (
        <>
          {explainConservativeCohort && (
            <div
              role="note"
              className="mb-4 rounded-[13px] border border-line bg-tint-soft px-4 py-3 text-[12.5px] leading-relaxed text-body"
            >
              <p className="font-semibold text-ink">
                Deux comptages, deux usages
              </p>
              {explainMissingEmailCohort && (
                <p className="mt-1">
                  Ce tableau regroupe{" "}
                  {prospectCohort.dedupedCount.toLocaleString("fr-FR")} contacts
                  pour la lecture, dont{" "}
                  {visualMissingEmailCount.toLocaleString("fr-FR")}{" "}
                  sans email. Pour sécuriser les relances, l&apos;agent conserve{" "}
                  {prospectCohort.canonicalCount.toLocaleString("fr-FR")} identités
                  dans sa cohorte métier prudente, dont{" "}
                  {conservativeMissingEmailCount.toLocaleString("fr-FR")} fiches
                  importées sans email. Sans email, il ne suppose pas que deux
                  homonymes issus de sources différentes sont la même personne :
                  les propositions peuvent donc afficher un total supérieur.
                </p>
              )}
              {explainPriorityCohort && (
                <p className="mt-1">
                  <strong>
                    Priorités :{" "}
                    {visualPriorityCount.toLocaleString("fr-FR")} visible
                    {visualPriorityCount > 1 ? "s" : ""}
                    {" · "}
                    {actionablePriorityCount.toLocaleString("fr-FR")} actionnable
                    {actionablePriorityCount > 1 ? "s" : ""}
                    .
                  </strong>{" "}
                  {priorityCountsDiffer && (
                    <>
                      Ces nombres diffèrent lorsque plusieurs lignes d&apos;un
                      même email ne racontent pas la même situation. Un statut
                      terminal ou une opposition, un contact récent ou des
                      statuts actifs contradictoires conduisent l&apos;agent à
                      retenir la lecture la plus prudente avant toute relance.
                    </>
                  )}
                  {activeStageConflictCount > 0 && (
                    <>
                      {priorityCountsDiffer && " "}
                      {activeStageConflictCount.toLocaleString("fr-FR")} contact
                      {activeStageConflictCount > 1 ? "s" : ""} suspendu
                      {activeStageConflictCount > 1 ? "s" : ""} ici parce que
                      plusieurs statuts actifs se contredisent.
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          <ProspectsBoard
            groups={groups}
            total={prospects.length}
            today={today}
          />
          <p className="mt-3 text-[12px] text-faint">
            {prospectCohort.dedupedCount.toLocaleString("fr-FR")} fiche
            {prospectCohort.dedupedCount > 1 ? "s" : ""} dédoublonnée
            {prospectCohort.dedupedCount > 1 ? "s" : ""}
            {" · "}
            {prospectCohort.maskedCount.toLocaleString("fr-FR")} doublon
            {prospectCohort.maskedCount > 1 ? "s" : ""} masqué
            {prospectCohort.maskedCount > 1 ? "s" : ""}
            {" · "}
            {prospectCohort.importedCount.toLocaleString("fr-FR")} ligne
            {prospectCohort.importedCount > 1 ? "s" : ""} importée
            {prospectCohort.importedCount > 1 ? "s" : ""}.
          </p>
        </>
      )}
    </>
  );
}
