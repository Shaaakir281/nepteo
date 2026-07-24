import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memoText } from "@/lib/draft-template";
import {
  computeFunnelStats,
  type BriefingProspect,
} from "@/lib/analysis-rules";
import {
  deriveKpis,
  rollupByCampaign,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";
import { buildMarketingPlan, type PlanMove } from "@/lib/plan";

const CHANNEL_CLS: Record<string, string> = {
  Publicité: "bg-violet/15 text-violet-ink",
  Email: "bg-green-tint text-green",
  Contenu: "bg-amber-tint text-amber",
  Données: "bg-tint text-violet",
};

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mem } = await supabase
    .from("company_memory")
    .select("section, content")
    .in("section", ["offres", "activite"]);
  const memCtx = Object.fromEntries((mem ?? []).map((m) => [m.section, m.content]));
  const offre = memoText(memCtx, "offres") || memoText(memCtx, "activite");

  const { data: prospectRows } = await supabase
    .from("prospects")
    .select("email, stage, company");
  const stats = computeFunnelStats((prospectRows ?? []) as BriefingProspect[]);

  const { data: adRows } = await supabase
    .from("ad_metrics")
    .select("campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue")
    .eq("provider", "meta_ads");
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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Plan du mois
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Ce que l&apos;agent ferait à votre place ce mois-ci — priorisé, cohérent,
          chaque mouvement pointe vers l&apos;écran où agir. Rien n&apos;est lancé
          sans vous.
        </p>
      </div>

      {/* Cap stratégique */}
      <div className="mb-4 rounded-[18px] border border-line-soft bg-gradient-to-br from-tint-soft to-white p-5 shadow-card">
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
      </div>

      {/* Mouvements */}
      <div className="space-y-3">
        {plan.moves.map((m, i) => (
          <Move key={i} n={i + 1} move={m} />
        ))}
      </div>

      <p className="mt-4 text-[11.5px] text-faint">
        Plan construit à partir de votre funnel, de vos campagnes et de votre
        mémoire d&apos;entreprise. Il s&apos;actualise à mesure que vos données
        évoluent.
      </p>
    </>
  );
}

function Move({ n, move }: { n: number; move: PlanMove }) {
  return (
    <div className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card">
      <div className="flex items-start gap-3.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-tint font-display text-[13px] font-bold text-violet-ink">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold text-ink">{move.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${CHANNEL_CLS[move.channel] ?? "bg-tint text-violet"}`}
            >
              {move.channel}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {move.why}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-body">
              Impact : <b className="text-ink">{move.impact}</b>
            </span>
            <Link
              href={move.ctaHref}
              className="rounded-[9px] bg-violet px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
            >
              {move.ctaLabel} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
