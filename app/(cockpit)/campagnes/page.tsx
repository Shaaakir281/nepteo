import Link from "next/link";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import {
  aggregate,
  ANALYSIS_WINDOW_DAYS,
  buildAdsFindings,
  buildHistoryFindings,
  buildTrendFinding,
  comparePeriods,
  deriveKpis,
  rollupWithStatus,
  splitByPeriod,
  windowBounds,
  type DatedMetric,
} from "@/lib/ads/metrics-rules";
import { analyzeAdsForm } from "./actions";
import { NewCampaignModal } from "./_components/new-campaign-modal";
import { CoachBubble } from "@/components/ui/coach-bubble";

const eur = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
const mult = (n: number) => `${n.toFixed(1)}×`;
/** Variation relative signée, ex. « +12 % » / « −30 % ». */
const signed = (n: number) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 100))} %`;

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
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canViewFinancials) redirect("/");
  const canEdit = membership.canEdit;

  const { data: rows } = await supabase
    .from("ad_metrics")
    .select("campaign_id, campaign_name, date, impressions, clicks, spend, conversions, revenue")
    .eq("provider", "meta_ads");
  const metrics = (rows ?? []).map((r) => ({
    ...r,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
  })) as DatedMetric[];

  // Les KPI portent sur les 30 derniers jours ; l'historique complet sert à
  // savoir ce qui tourne encore et ce qui a déjà été tenté.
  const bounds = windowBounds();
  const { current, previous } = splitByPeriod(metrics, bounds);
  const withStatus = rollupWithStatus(metrics, bounds);
  const campaigns = withStatus
    .filter((c) => c.status === "active")
    .sort((a, b) => b.spend - a.spend);
  const ended = withStatus
    .filter((c) => c.status === "ended" && c.spend > 0)
    .sort((a, b) => a.daysSinceLast - b.daysSinceLast);

  const total = deriveKpis(aggregate(current));
  const comparison = comparePeriods(current, previous);
  const findings = [
    ...buildAdsFindings(campaigns),
    ...(buildTrendFinding(comparison) ? [buildTrendFinding(comparison)!] : []),
    ...buildHistoryFindings(withStatus),
  ];
  const fmtDay = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

  return (
    <>
      <CoachBubble id="campagnes" />
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
            {/* « Contenu » n'est plus dans la navigation : l'atelier reste
                atteignable d'ici et depuis le cap du mois. */}
            <Link
              href="/contenu"
              className="rounded-[10px] border border-line px-3.5 py-2 text-[12.5px] font-semibold text-body transition hover:bg-tint-soft hover:text-ink"
            >
              Idées de contenu
            </Link>
            <NewCampaignModal />
            {metrics.length > 0 && (
              <form action={analyzeAdsForm}>
                <button
                  type="submit"
                  title="Proposer des actions à partir des campagnes (file de validation)"
                  className="rounded-[10px] bg-tint px-3.5 py-2 text-[12.5px] font-semibold text-violet transition hover:bg-violet hover:text-white"
                >
                  Analyser
                </button>
              </form>
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
            Meta Ads sera bientôt connectable en direct. En attendant, chargez
            une entreprise fictive pour voir l&apos;analyse à l&apos;œuvre (ROAS,
            coût d&apos;acquisition, campagne à couper).
          </p>
          {canEdit && (
            <Link
              href="/entreprise?onglet=connecteurs"
              className="mt-4 inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
            >
              Essayer avec une entreprise fictive →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPIs globaux */}
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <Kpi
              label="Dépense"
              value={eur(total.spend)}
              hint={
                comparison
                  ? `${ANALYSIS_WINDOW_DAYS} j · ${signed(comparison.spendChange)} vs période précédente`
                  : `${ANALYSIS_WINDOW_DAYS} derniers jours`
              }
            />
            <Kpi
              label="Revenu attribué"
              value={eur(total.revenue)}
              hint={
                comparison
                  ? `${signed(comparison.revenueChange)} vs période précédente`
                  : "conversions × panier"
              }
            />
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
                Campagnes en cours
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                Sur les {ANALYSIS_WINDOW_DAYS} derniers jours — la période sur
                laquelle vous pouvez encore agir.
              </p>
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
                    <th className="whitespace-nowrap px-[22px] py-2.5 text-right font-semibold">
                      Taux de clic
                    </th>
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

          {/* Campagnes terminées — ce qui a déjà été tenté */}
          {ended.length > 0 && (
            <div className="overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-card">
              <div className="border-b border-line-soft px-[22px] py-4">
                <h3 className="font-display text-[15px] font-semibold">
                  Déjà tenté
                </h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  Campagnes arrêtées, jugées sur toute leur durée. L&apos;agent
                  s&apos;en sert pour ne pas vous reproposer ce qui a échoué.
                </p>
              </div>
              <ul>
                {ended.map((c) => (
                  <li
                    key={c.campaign_id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft px-[22px] py-3 last:border-b-0"
                  >
                    <span className="flex-1 text-[13px] font-medium text-ink">
                      {c.campaign_name}
                    </span>
                    <span className="text-[12px] text-faint">
                      {fmtDay.format(new Date(c.firstDate))} →{" "}
                      {fmtDay.format(new Date(c.lastDate))}
                    </span>
                    <span className="text-[12px] tabular-nums text-body">
                      {eur(c.spend)} dépensés
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums ${
                        c.roas >= 1
                          ? "bg-green-tint text-green"
                          : "bg-red-tint text-red"
                      }`}
                    >
                      ROAS {mult(c.roas)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
