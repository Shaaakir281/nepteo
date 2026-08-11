import type { CurrentAuthContext } from "@/lib/auth/context";
import { revenueStats } from "@/lib/revenue/revenue-rules";
import { buildProspectKpi } from "@/lib/dedupe-prospects";
import {
  createSupabaseProspectReader,
  DEFAULT_PROSPECT_MAX_ROWS,
  loadProspectCohort,
} from "@/lib/prospect-cohort-loader";
import { memoText } from "@/lib/draft-template";
import {
  buildStarterDiagnostic,
  diagnosticInputFromMemory,
  type DiagnosticMemory,
} from "@/lib/diagnostic";
import { readMemory } from "@/lib/memory-store";

export async function loadTodayDashboardData(
  supabase: CurrentAuthContext["supabase"],
  canViewFinancials: boolean,
) {
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
    (revRows ?? []).map((row) => ({
      amount: Number(row.amount),
      occurred_on: row.occurred_on,
    })),
  );
  const { data: adSpendRows } = canViewFinancials
    ? await supabase
        .from("ad_metrics")
        .select("spend")
        .eq("provider", "meta_ads")
        .gte("date", sinceISO)
    : { data: [] };
  const adSpend = (adSpendRows ?? []).reduce(
    (sum, row) => sum + Number(row.spend),
    0,
  );
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
  const eur = (value: number) =>
    `${Math.round(value).toLocaleString("fr-FR")} €`;
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

  return {
    diagnostic,
    kpis,
    prospectCohort,
    today: new Date().toISOString().slice(0, 10),
  };
}
