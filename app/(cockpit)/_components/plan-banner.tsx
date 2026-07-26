import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { memoText } from "@/lib/draft-template";
import {
  computeFunnelStats,
  type BriefingProspect,
} from "@/lib/analysis-rules";
import {
  deriveKpis,
  rollupByCampaign,
  windowBounds,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";
import { buildMarketingPlan, type PlanMove } from "@/lib/plan";
import { readMemory } from "@/lib/memory-store";

/**
 * Le cap du mois, en bandeau sur Aujourd'hui — ce qui était « Plan du mois ».
 *
 * Ce sont des CONSEILS en lecture seule, pas des actions à valider : le
 * bandeau est visuellement distinct de la file de validation (fond teinté,
 * mouvements condensés, CTA sobres qui renvoient vers l'écran où agir). Rien
 * ne s'exécute d'ici.
 *
 * Composant serveur asynchrone : il fait ses propres lectures pour que
 * `page.tsx` reste court. Le moteur `lib/plan.ts` n'est pas modifié.
 */

/** On condense : le bandeau donne le cap, pas la liste exhaustive. */
const MAX_MOVES = 3;

const CHANNEL_CLS: Record<string, string> = {
  Publicité: "bg-violet/15 text-violet-ink",
  Email: "bg-green-tint text-green",
  Contenu: "bg-amber-tint text-amber",
  Données: "bg-tint text-violet",
};

export async function PlanBanner() {
  const supabase = await createClient();

  const memCtx = await readMemory(supabase);
  const offre = memoText(memCtx, "offres") || memoText(memCtx, "activite");

  const { data: prospectRows } = await supabase
    .from("prospects")
    .select("email, stage, company");
  const stats = computeFunnelStats((prospectRows ?? []) as BriefingProspect[]);

  const { data: adRows } = await supabase
    .from("ad_metrics")
    .select(
      "campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue",
    )
    .eq("provider", "meta_ads")
    .gte("date", windowBounds().currentFrom);
  const campaigns = rollupByCampaign(
    (adRows ?? []).map((r) => ({
      ...r,
      spend: Number(r.spend),
      revenue: Number(r.revenue),
    })) as CampaignMetric[],
  ).map(deriveKpis);
  const losingCampaigns = campaigns
    .filter((c) => c.spend >= 50 && c.roas < 1)
    .map((c) => c.campaign_name);
  const best = campaigns
    .filter((c) => c.roas >= 1)
    .sort((a, b) => b.roas - a.roas)[0];

  const plan = buildMarketingPlan({
    offre,
    priorityCount: stats.priority,
    noEmailCount: stats.noEmail,
    losingCampaigns,
    bestCampaign: best ? { name: best.campaign_name, roas: best.roas } : null,
  });

  const month = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const moves = plan.moves.slice(0, MAX_MOVES);

  return (
    <div className="mb-5 rounded-[18px] border border-line-soft bg-gradient-to-br from-tint-soft to-white p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-violet text-[12px] font-bold text-white">
          N
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-violet-ink">
          Cap du mois · {month}
        </span>
      </div>
      <p className="text-[14px] leading-relaxed text-ink">{plan.intro}</p>
      {plan.budgetIndicatif > 0 && (
        <p className="mt-1.5 text-[12.5px] text-muted">
          Budget publicitaire indicatif : {plan.budgetIndicatif} € · rien
          n&apos;est engagé sans votre validation.
        </p>
      )}

      {moves.length > 0 && (
        <ol className="mt-3.5 space-y-2">
          {moves.map((m, i) => (
            <CondensedMove key={m.title} n={i + 1} move={m} />
          ))}
        </ol>
      )}

      <p className="mt-3 text-[11.5px] text-faint">
        Des conseils, pas des actions à valider : rien ne s&apos;exécute
        d&apos;ici. Construit à partir de votre funnel, de vos campagnes et de
        votre mémoire d&apos;entreprise.
      </p>
    </div>
  );
}

function CondensedMove({ n, move }: { n: number; move: PlanMove }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border border-line-soft bg-white px-3.5 py-2.5">
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-tint font-display text-[12px] font-bold text-violet-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13.5px] font-semibold text-ink">{move.title}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${CHANNEL_CLS[move.channel] ?? "bg-tint text-violet"}`}
          >
            {move.channel}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
          {move.why}
        </p>
      </div>
      <Link
        href={move.ctaHref}
        className="flex-none rounded-[9px] bg-tint px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
      >
        {move.ctaLabel} →
      </Link>
    </li>
  );
}
