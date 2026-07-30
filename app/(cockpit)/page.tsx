import Link from "next/link";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  entryDetail,
  entryTitle,
  type JournalEntry,
} from "@/lib/journal";
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
import { CoachBubble } from "@/components/ui/coach-bubble";
import { isCommercialSafeActionKind } from "@/lib/auth/roles";
import { prioritizeTodayActions } from "@/lib/today-priority-rules";
import { DormantPlayLauncher } from "./_components/dormant-play-launcher";
import {
  buildValueScorecard,
  type ValueEventForScorecard,
} from "@/lib/value-scorecard-rules";
import { ValueScorecard } from "./_components/value-scorecard";

const VALUE_EVENT_PAGE_SIZE = 1000;
const MAX_VALUE_SCORECARD_EVENTS = 5000;

export default async function TodayPage() {
  const { supabase, membership } = await getCurrentAuthContext();
  const { data } = await supabase
    .from("journal")
    .select("id, event, actor, actor_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  const journal = (data ?? []) as JournalEntry[];

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
  const queue = prioritizeTodayActions(
    authorizedQueue,
    new Date().toISOString(),
  );

  const { data: decidedRows } = await supabase
    .from("actions")
    .select("id, kind, title, status, decided_at")
    .in("status", ["approved", "rejected", "postponed", "executed", "failed"])
    .order("decided_at", { ascending: false })
    .limit(50);
  const decided = ((decidedRows ?? []) as DecidedAction[]).filter(
    (action) => canViewFinancials || isCommercialSafeActionKind(action.kind),
  );

  const { data: org } = await supabase
    .from("organizations")
    .select("execution_paused")
    .maybeSingle();
  const executionPaused = Boolean(org?.execution_paused);

  const { data: briefingRow } = await supabase
    .from("briefings")
    .select("content, created_at")
    .maybeSingle();
  const briefing = briefingRow as { content: string; created_at: string } | null;

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
  const { count: prospectCount } = await supabase
    .from("prospects")
    .select("id", { count: "exact", head: true });

  // Base vide : quatre tirets ne disent rien. On rend plutôt le diagnostic de
  // départ — la première expertise de l'agent, avant tout connecteur (même
  // rendu que /plan). Dès qu'il y a des données, on retrouve les KPIs.
  const hasData =
    (prospectCount ?? 0) > 0 ||
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
    value: (prospectCount ?? 0) > 0 ? String(prospectCount) : "—",
    hint: "dans votre base",
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
      <CoachBubble id="today" />
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Bonjour</h1>
        {/* Cette phrase n'est vraie que tant qu'aucune donnée n'est branchée —
            elle disparaît dès que l'agent a de la matière. */}
        {diagnostic && (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Nepteo apprend votre entreprise. Complétez la{" "}
            <Link href="/entreprise" className="font-semibold text-violet hover:underline">
              mémoire de l&apos;agent
            </Link>{" "}
            — vos données réelles apparaîtront ici dès le premier connecteur.
          </p>
        )}
      </div>

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
            Mis à jour le {fmt.format(new Date(briefing.created_at))} · à partir
            de vos données réelles.
          </p>
        </div>
      )}

      {diagnostic ? (
        /* Rien de branché : le diagnostic de départ tient lieu de tableau de
           bord. Le chemin vers une entreprise fictive reste offert juste en
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
                Essayer avec une entreprise fictive →
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
          <PlanBanner />
        </div>
      )}

      {!diagnostic && canEdit && (
        <div className="mt-5">
          <DormantPlayLauncher />
        </div>
      )}

      {!diagnostic && canEdit && valueScorecard && (
        <div className="mt-5">
          <ValueScorecard scorecard={valueScorecard} />
        </div>
      )}

      {!diagnostic && canEdit && valueScorecardIncomplete && (
        <div className="mt-5 rounded-[18px] border border-line-soft bg-white p-5 text-[12.5px] text-muted shadow-card">
          La scorecard est suspendue au-delà de 5 000 événements : une
          agrégation complète est requise avant d&apos;afficher des taux ou de
          conclure sur les gates.
        </div>
      )}

      {!diagnostic && canEdit && valueScorecardReadFailed && (
        <div className="mt-5 rounded-[18px] border border-line-soft bg-white p-5 text-[12.5px] text-muted shadow-card">
          Scorecard indisponible : la lecture des événements terrain a échoué.
          Aucun taux ni gate n&apos;est affiché tant que la migration et les
          permissions ne sont pas vérifiées.
        </div>
      )}

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {/* File de validation */}
        <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">
              À valider
            </h3>
            <span className="text-[12px] text-muted">
              L&apos;agent propose, vous décidez
            </span>
          </div>
          <ValidationQueue actions={queue} canEdit={canEdit} />
        </div>

        {/* Journal */}
        <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">Journal</h3>
            <Link
              href="/journal"
              className="text-[12px] font-semibold text-violet hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {journal.length > 0 ? (
            <ul>
              {journal.map((j) => (
                <li
                  key={j.id}
                  className="flex items-start gap-3 border-t border-line-soft px-[22px] py-3 first:border-t-0"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                      j.actor === "agent" ? "bg-faint" : "bg-violet"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">
                      {entryTitle(j)}
                      {entryDetail(j) && (
                        <span className="text-muted"> · {entryDetail(j)}</span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-faint">
                      {fmt.format(new Date(j.created_at))} ·{" "}
                      {j.actor === "agent" ? "Agent" : "Vous"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-[22px] py-8 text-center text-[12.5px] text-muted">
              Aucun événement pour l&apos;instant.
            </div>
          )}
        </div>
      </div>

      {/* Décisions récentes — boucle de feedback visible */}
      <div className="mt-4 rounded-[18px] border border-line-soft bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
          <h3 className="font-display text-[15px] font-semibold">
            Décisions récentes
          </h3>
          {canEdit ? (
            <ExecutionSwitch paused={executionPaused} />
          ) : (
            <span className="text-[12px] text-muted">
              Reportées, validées, exécutées
            </span>
          )}
        </div>
        <DecisionsHistory actions={decided} canEdit={canEdit} />
      </div>
    </>
  );
}
