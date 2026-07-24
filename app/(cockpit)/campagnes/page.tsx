import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EDIT_ROLES } from "@/lib/memory";
import {
  aggregate,
  buildAdsFindings,
  deriveKpis,
  rollupByCampaign,
  type CampaignMetric,
} from "@/lib/ads/metrics-rules";
import { analyzeAdsForm, loadAdsDemo } from "./actions";
import { NewCampaignModal } from "./_components/new-campaign-modal";

const eur = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
const mult = (n: number) => `${n.toFixed(1)}×`;

const SEVERITY: Record<string, string> = {
  good: "border-green/30 bg-green-tint",
  warn: "border-amber/30 bg-amber-tint",
  bad: "border-red/30 bg-red-tint",
};

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<{ proposed?: string }>;
}) {
  const { proposed } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const canEdit = EDIT_ROLES.includes(membership.role);

  const { data: rows } = await supabase
    .from("ad_metrics")
    .select("campaign_id, campaign_name, impressions, clicks, spend, conversions, revenue")
    .eq("provider", "meta_ads");
  const metrics = (rows ?? []).map((r) => ({
    ...r,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
  })) as CampaignMetric[];

  const campaigns = rollupByCampaign(metrics)
    .map(deriveKpis)
    .sort((a, b) => b.spend - a.spend);
  const total = deriveKpis(aggregate(metrics));
  const findings = buildAdsFindings(campaigns);

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Campagnes</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Vos publicités payantes, lues côté revenu : ce que chaque campagne
            coûte et rapporte réellement.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-none items-center gap-2">
            <NewCampaignModal />
            {metrics.length > 0 && (
              <>
                <form action={analyzeAdsForm}>
                  <button
                    type="submit"
                    title="Proposer des actions à partir des campagnes (file de validation)"
                    className="rounded-[10px] bg-tint px-3.5 py-2 text-[12.5px] font-semibold text-violet transition hover:bg-violet hover:text-white"
                  >
                    Analyser
                  </button>
                </form>
                <form action={loadAdsDemo}>
                  <button
                    type="submit"
                    className="rounded-[10px] bg-tint px-3.5 py-2 text-[12.5px] font-semibold text-violet transition hover:bg-violet hover:text-white"
                  >
                    Recharger la démo
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      {proposed !== undefined && (
        proposed === "err" ? (
          <div className="mb-4 rounded-[12px] bg-red-tint px-4 py-3 text-[13px] font-medium text-red">
            L&apos;analyse n&apos;a pas abouti — réessayez.
          </div>
        ) : proposed === "0" ? (
          <div className="mb-4 rounded-[12px] bg-tint-soft px-4 py-3 text-[13px] text-body">
            Aucune nouvelle action à proposer (rien de nouveau à couper, ou
            déjà dans votre file de validation).
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-green-tint px-4 py-3">
            <span className="text-[13px] font-medium text-green">
              {proposed} action{Number(proposed) > 1 ? "s" : ""} proposée
              {Number(proposed) > 1 ? "s" : ""} à partir de vos campagnes.
            </span>
            <Link
              href="/"
              className="rounded-[9px] bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
            >
              Valider sur Aujourd&apos;hui →
            </Link>
          </div>
        )
      )}

      {metrics.length === 0 ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-8 text-center shadow-card">
          <p className="text-[14px] font-medium text-ink">
            Aucune donnée de campagne pour l&apos;instant
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
            Meta Ads sera bientôt connectable en direct. En attendant, chargez un
            jeu de données de démonstration pour voir l&apos;analyse à l&apos;œuvre
            (ROAS, coût d&apos;acquisition, campagne à couper).
          </p>
          {canEdit && (
            <form action={loadAdsDemo} className="mt-4">
              <button
                type="submit"
                className="rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
              >
                Charger des données de démo (Meta Ads)
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPIs globaux */}
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <Kpi label="Dépense" value={eur(total.spend)} hint="7 derniers jours" />
            <Kpi label="Revenu attribué" value={eur(total.revenue)} hint="conversions × panier" />
            <Kpi
              label="ROAS global"
              value={mult(total.roas)}
              hint={total.roas >= 1 ? "rentable" : "en perte"}
              accent={total.roas >= 1 ? "green" : "red"}
            />
            <Kpi label="Coût d'acquisition" value={eur(total.cac)} hint={`${total.conversions} conversions`} />
          </div>

          {/* Constats de l'agent */}
          {findings.length > 0 && (
            <div className="space-y-2">
              {findings.map((f, i) => (
                <div
                  key={i}
                  className={`rounded-[13px] border px-4 py-3 ${SEVERITY[f.severity] ?? "border-line-soft bg-white"}`}
                >
                  <p className="text-[13px] font-semibold text-ink">{f.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Détail par campagne */}
          <div className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card">
            <div className="border-b border-line-soft px-[22px] py-4">
              <h3 className="font-display text-[15px] font-semibold">
                Par campagne
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-[.06em] text-faint">
                    <th className="px-[22px] py-2.5 font-semibold">Campagne</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Dépense</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Revenu</th>
                    <th className="px-3 py-2.5 text-right font-semibold">ROAS</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Conv.</th>
                    <th className="px-3 py-2.5 text-right font-semibold">CAC</th>
                    <th className="px-[22px] py-2.5 text-right font-semibold">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.campaign_id} className="border-b border-line-soft last:border-b-0">
                      <td className="px-[22px] py-2.5 font-medium text-ink">
                        {c.campaign_name}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-body">{eur(c.spend)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-body">{eur(c.revenue)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${c.roas >= 1 ? "text-green" : "text-red"}`}>
                        {mult(c.roas)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-body">{c.conversions}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-body">{eur(c.cac)}</td>
                      <td className="px-[22px] py-2.5 text-right tabular-nums text-body">{pct(c.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11.5px] text-faint">
            Données de démonstration (fictives). Le connecteur Meta Ads réel
            alimentera ce tableau à l&apos;identique.
          </p>
        </div>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: "green" | "red";
}) {
  const color =
    accent === "green" ? "text-green" : accent === "red" ? "text-red" : "text-ink";
  return (
    <div className="rounded-[13px] border border-line-soft bg-white p-4 shadow-card">
      <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
        {label}
      </p>
      <p className={`mt-1.5 font-display text-[22px] font-semibold ${color}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-muted">{hint}</p>
    </div>
  );
}
