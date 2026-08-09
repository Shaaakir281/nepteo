import Link from "next/link";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  ValidationQueue,
  type QueueAction,
} from "./_components/validation-queue";
import {
  DecisionsHistory,
  type DecidedAction,
} from "./_components/decisions-history";
import { ExecutionSwitch } from "./_components/execution-switch";
import { StarterDiagnosticCard } from "./_components/starter-diagnostic";
import { PlanBanner } from "./_components/plan-banner";
import { revenueStats } from "@/lib/revenue/revenue-rules";
import { memoText } from "@/lib/draft-template";
import {
  buildStarterDiagnostic,
  diagnosticInputFromMemory,
  type DiagnosticMemory,
} from "@/lib/diagnostic";
import { readMemory } from "@/lib/memory-store";
import { isCommercialSafeActionKind } from "@/lib/auth/roles";
import { prioritizeTodayActions } from "@/lib/today-priority-rules";
import { DormantPlayLauncher } from "./_components/dormant-play-launcher";
import {
  buildValueScorecard,
  type ValueEventForScorecard,
} from "@/lib/value-scorecard-rules";
import { ValueScorecard } from "./_components/value-scorecard";
import { buildProspectKpi } from "@/lib/dedupe-prospects";
import {
  createSupabaseProspectReader,
  DEFAULT_PROSPECT_MAX_ROWS,
  loadProspectCohort,
} from "@/lib/prospect-cohort-loader";
import { readDemoPresentation } from "@/lib/demo/presentation";
import { briefingDataSourceLabel } from "@/lib/demo/presentation-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  creativesByCampaign,
  loadCampaignCreativeAssets,
} from "@/lib/creative-assets";

const VALUE_EVENT_PAGE_SIZE = 1000;
const MAX_VALUE_SCORECARD_EVENTS = 5000;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ decision_error?: string }>;
}) {
  const { decision_error: decisionError } = await searchParams;
  const { supabase, membership } = await getCurrentAuthContext();
  const canEdit = membership?.canEdit ?? false;
  const canViewFinancials = membership?.canViewFinancials ?? false;

  const { data: queueRows } = await supabase
    .from("actions")
    .select(
      "id, kind, title, finding, rationale, data_sources, expected_impact, confidence, risk, payload, created_at",
    )
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(50);
  const authorizedQueue = (
    (queueRows ?? []) as (QueueAction & { created_at: string })[]
  ).filter(
    (action) => canViewFinancials || isCommercialSafeActionKind(action.kind),
  );
  const prioritizedQueue = prioritizeTodayActions(
    authorizedQueue,
    new Date().toISOString(),
  );
  const campaignAssets = membership
    ? await loadCampaignCreativeAssets(
        createAdminClient(),
        membership.organizationId,
        prioritizedQueue
          .filter((action) => action.kind === "launch_campaign")
          .map((action) => action.id),
      )
    : [];
  const assetsByCampaign = creativesByCampaign(campaignAssets);
  const queue = prioritizedQueue.map((action) => ({
    ...action,
    creatives: assetsByCampaign[action.id] ?? [],
  }));

  const { data: decidedRows } = await supabase
    .from("actions")
    .select("id, kind, title, status, decided_at, decision_reason")
    .in("status", ["approved", "rejected", "postponed", "executed", "failed"])
    .order("decided_at", { ascending: false })
    .limit(50);
  const decided = ((decidedRows ?? []) as DecidedAction[]).filter(
    (action) => canViewFinancials || isCommercialSafeActionKind(action.kind),
  );

  const { data: org, error: organizationReadError } = await supabase
    .from("organizations")
    .select("execution_paused")
    .maybeSingle();
  const executionPaused = organizationReadError
    ? null
    : Boolean(org?.execution_paused);

  const { data: briefingRow } = await supabase
    .from("briefings")
    .select("content, created_at")
    .maybeSingle();
  const briefing = briefingRow as { content: string; created_at: string } | null;
  const briefingPresentation =
    briefing && membership
      ? (await readDemoPresentation(membership.organizationId)).presentation
      : "none";

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // KPIs vivants (30 derniers jours) : revenu, ventes, dépenses pub, prospects.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);
  const { data: revRows } = canViewFinancials
    ? await supabase
        .from("revenue_events")
        .select("amount, occurred_on")
        .gte("occurred_on", sinceISO)
    : { data: [] };
  const rev = revenueStats(
    (revRows ?? []).map((r) => ({ amount: Number(r.amount), occurred_on: r.occurred_on })),
  );
  // Même fenêtre que le revenu : sans le filtre de date, ce KPI additionnait
  // TOUT l'historique et l'étiquette « 30 jours » était fausse.
  const { data: adSpendRows } = canViewFinancials
    ? await supabase
        .from("ad_metrics")
        .select("spend")
        .eq("provider", "meta_ads")
        .gte("date", sinceISO)
    : { data: [] };
  const adSpend = (adSpendRows ?? []).reduce((s, r) => s + Number(r.spend), 0);
  const prospectCohort = await loadProspectCohort(
    createSupabaseProspectReader(supabase),
    { maxRows: DEFAULT_PROSPECT_MAX_ROWS },
  );
  const prospectRows =
    prospectCohort.status === "complete" ? prospectCohort.rawRows : [];
  const importedProspectCount =
    prospectCohort.status === "unavailable"
      ? null
      : prospectCohort.importedCount;
  const prospectSummary = buildProspectKpi(
    prospectRows,
    importedProspectCount,
    DEFAULT_PROSPECT_MAX_ROWS,
  );
  const today = new Date().toISOString().slice(0, 10);

  // Base vide : quatre tirets ne disent rien. On rend plutôt le diagnostic de
  // départ — la première expertise de l'agent, avant tout connecteur (même
  // rendu que /plan). Dès qu'il y a des données, on retrouve les KPIs.
  const hasData =
    prospectSummary.hasData ||
    (canViewFinancials && (adSpendRows ?? []).length > 0);
  const memCtx = hasData ? null : await readMemory(supabase);
  const diagnostic = memCtx
    ? buildStarterDiagnostic(
        diagnosticInputFromMemory(
          memCtx as DiagnosticMemory,
          memoText(memCtx, "offres") || memoText(memCtx, "activite"),
        ),
      )
    : null;

  const hasRevenue = rev.count > 0;
  const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
  const prospectKpi = {
    label: "Prospects",
    value: prospectSummary.value,
    hint: prospectSummary.hint,
  };
  const kpis = canViewFinancials
    ? [
        {
          label: "Dépenses",
          value: adSpend > 0 ? eur(adSpend) : "—",
          hint: "publicité (Meta)",
        },
        prospectKpi,
        {
          label: "Ventes",
          value: hasRevenue ? String(rev.count) : "—",
          hint: "30 derniers jours",
        },
        {
          label: "Revenu",
          value: hasRevenue ? eur(rev.total) : "—",
          hint: "30 derniers jours",
        },
      ]
    : [prospectKpi];

  // `value_events` est volontairement invisible aux rôles commerciaux/lecture.
  // En recette non migrée, ne pas transformer une erreur de table en scorecard
  // artificiellement vide : null signifie « preuve indisponible », pas zéro.
  let valueScorecard = null;
  let valueScorecardIncomplete = false;
  let valueScorecardReadFailed = false;
  if (canEdit) {
    const valueEventRows: ValueEventForScorecard[] = [];
    let valueEventsReadFailed = false;

    for (
      let offset = 0;
      offset <= MAX_VALUE_SCORECARD_EVENTS;
      offset += VALUE_EVENT_PAGE_SIZE
    ) {
      const end = Math.min(
        offset + VALUE_EVENT_PAGE_SIZE - 1,
        MAX_VALUE_SCORECARD_EVENTS,
      );
      const { data: page, error: valueEventsError } = await supabase
        .from("value_events")
        .select(
          "id, action_id, prospect_id, actor_id, event_type, source, is_demo, false_positive_reason, edit_level, occurred_at",
        )
        .eq("action_kind", "relaunch_dormant")
        .eq("is_demo", false)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, end);

      if (valueEventsError || !page) {
        valueEventsReadFailed = true;
        valueScorecardReadFailed = true;
        break;
      }
      if (offset === MAX_VALUE_SCORECARD_EVENTS) {
        valueScorecardIncomplete = page.length > 0;
        break;
      }

      valueEventRows.push(...(page as ValueEventForScorecard[]));
      if (page.length < VALUE_EVENT_PAGE_SIZE) break;
    }

    if (!valueEventsReadFailed && !valueScorecardIncomplete) {
      valueScorecard = buildValueScorecard(valueEventRows);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#8a232d]">
            Aujourd&apos;hui
          </p>
          <h1 className="font-display text-[28px] font-light tracking-[-.02em] text-ink">
            Bonjour, par quoi commence-t-on ?
          </h1>
        {/* Cette phrase n'est vraie que tant qu'aucune donnée n'est branchée —
            elle disparaît dès que l'agent a de la matière. */}
          {diagnostic && (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Nepteo apprend votre entreprise. Complétez la{" "}
            <Link href="/entreprise" className="font-semibold text-violet hover:underline">
              mémoire de l&apos;agent
            </Link>{" "}
            — les données de votre organisation apparaîtront ici dès le premier
            connecteur.
          </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ExecutionSwitch paused={executionPaused} />
            <Link
              href="/contenu"
              className="rounded-[9px] bg-[#8a232d] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_rgba(138,35,45,.14)] transition hover:bg-[#741d25]"
            >
              ✦ Créer une story
            </Link>
          </div>
        )}
      </div>

      {decisionError === "rejection_reason" && (
        <div role="alert" className="mb-5 rounded-[12px] bg-red-tint px-4 py-3 text-[12.5px] text-red">
          Le refus n&apos;a pas été enregistré : indiquez une raison de 3 à 500 caractères.
        </div>
      )}

      {/* Briefing de l'agent — résumé en langage naturel du funnel */}
      {briefing && (
        <div className="mb-5 rounded-[18px] border border-line-soft bg-gradient-to-br from-tint-soft to-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-violet text-[12px] font-bold text-white">
              N
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-violet-ink">
              Le point de l&apos;agent
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-ink">
            {briefing.content}
          </p>
          <p className="mt-2 text-[11.5px] text-faint">
            Mis à jour le {fmt.format(new Date(briefing.created_at))} ·{" "}
            {briefingDataSourceLabel(briefingPresentation)}
          </p>
        </div>
      )}

      {diagnostic ? (
        /* Rien de branché : le diagnostic de départ tient lieu de tableau de
           bord. Le chemin vers un scénario d'exemple reste offert juste en
           dessous, par l'état vide de la file de validation. */
        <StarterDiagnosticCard diagnostic={diagnostic} />
      ) : (
        <>
          {/* KPIs — données réelles (30 derniers jours) */}
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-[13px] border border-line-soft bg-white p-4 shadow-card"
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
                  {k.label}
                </p>
                <p
                  className={`mt-1.5 font-display text-[22px] font-semibold ${k.value === "—" ? "text-faint" : "text-ink"}`}
                >
                  {k.value}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">{k.hint}</p>
              </div>
            ))}
          </div>
          {canViewFinancials &&
            !hasRevenue &&
            (canEdit ? (
              <Link
                href="/entreprise?onglet=connecteurs"
                className="mt-2.5 inline-block text-[12px] font-semibold text-violet hover:underline"
              >
                Charger un scénario d&apos;exemple →
              </Link>
            ) : (
              <p className="mt-2.5 text-[12px] text-faint">
                Connectez vos paiements pour voir ventes et revenu réels.
              </p>
            ))}
        </>
      )}

      {/* Cap du mois — ce qui était « Plan du mois ». Des conseils avec CTA,
          en lecture seule : la file de validation juste en dessous reste le
          seul endroit où l'on décide. Sans données, le diagnostic de départ
          ci-dessus tient déjà ce rôle — un plan chiffré serait creux. */}
      {!diagnostic && (
        <div className="mt-5">
          <PlanBanner
            prospectCohort={
              prospectCohort.status === "complete"
                ? prospectCohort.canonicalRows
                : null
            }
            today={today}
          />
        </div>
      )}

      {!diagnostic && canEdit && (
        <div className="mt-5">
          <DormantPlayLauncher />
        </div>
      )}

      <div className="mt-7">
        <div className="rounded-[12px] border border-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">
              Vos prochaines décisions
            </h3>
            <span className="text-[12px] text-muted">
              {queue.length} à valider
            </span>
          </div>
          <ValidationQueue actions={queue} canEdit={canEdit} />
        </div>
      </div>

      <details className="group mt-4 rounded-[12px] border border-line bg-white">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-[12.5px] font-semibold text-ink">
          <span>Suivi et historique</span>
          <span className="text-muted transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-line-soft p-4">
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
          {!diagnostic && canEdit && (valueScorecardIncomplete || valueScorecardReadFailed) && (
            <p className="mt-4 rounded-[10px] bg-tint-soft px-4 py-3 text-[12px] text-muted">
              Scorecard indisponible : une agrégation complète et des permissions
              à jour sont requises avant d&apos;afficher les résultats.
            </p>
          )}
        </div>
      </details>
    </>
  );
}
