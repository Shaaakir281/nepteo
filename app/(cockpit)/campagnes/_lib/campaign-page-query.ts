import type { getCurrentAuthContext } from "@/lib/auth/context";
import { DEMO_PROVIDER } from "@/lib/demo/isolation-rules";
import { readDemoPresentation } from "@/lib/demo/presentation";
import {
  ACTION_ROW_LIMIT,
  CONNECTOR_ROW_LIMIT,
  JOURNAL_ROW_LIMIT,
  METRIC_ROW_LIMIT,
  WEEKLY_WINDOW_DAYS,
  WINDOW_DAYS,
  type CampaignSearchParam,
} from "./campaign-page-constants";
import { isoDaysAgo } from "./campaign-formatters";
import { readProspectSearch } from "./campaign-prospect-search";
import { completeRead } from "./campaign-read-utils";
import { readBudgetResultsData } from "./budget-results-query";

type CampaignPageSupabase = Awaited<
  ReturnType<typeof getCurrentAuthContext>
>["supabase"];

export async function readCampaignPageSnapshot(
  supabase: CampaignPageSupabase,
  organizationId: string,
  requestedProspectValue: CampaignSearchParam,
) {
  const today = new Date();
  const window = {
    from: isoDaysAgo(today, WINDOW_DAYS - 1),
    to: isoDaysAgo(today, 0),
  };
  const comparison = {
    kind: "period" as const,
    from: isoDaysAgo(today, WINDOW_DAYS * 2 - 1),
    to: isoDaysAgo(today, WINDOW_DAYS),
  };
  const weeklyWindow = {
    from: isoDaysAgo(today, WEEKLY_WINDOW_DAYS - 1),
    to: isoDaysAgo(today, 0),
  };
  const weeklyComparison = {
    kind: "period" as const,
    from: isoDaysAgo(today, WEEKLY_WINDOW_DAYS * 2 - 1),
    to: isoDaysAgo(today, WEEKLY_WINDOW_DAYS),
  };

  const [
    metricsResult,
    actionsResult,
    statusJournalResult,
    demoSnapshot,
    connectorsResult,
    agentControlResult,
    analysisJournalResult,
    prospectSearch,
    budgetResultsData,
  ] = await Promise.all([
    supabase
      .from("ad_metrics")
      .select(
        "provider, campaign_id, campaign_name, date, impressions, clicks, spend, conversions, revenue, synced_at",
        { count: "exact" },
      )
      .eq("organization_id", organizationId)
      .in("outcome_provenance", ["demo", "verified_downstream"])
      .order("date", { ascending: false })
      .limit(METRIC_ROW_LIMIT),
    supabase
      .from("actions")
      .select(
        "id, kind, title, status, created_at, decided_at, decision_reason, confidence, data_sources, payload",
        { count: "exact" },
      )
      .eq("organization_id", organizationId)
      .or("kind.eq.launch_campaign,kind.like.ads\\_%")
      .order("created_at", { ascending: false })
      .limit(ACTION_ROW_LIMIT),
    supabase
      .from("journal")
      .select("id, action_id, event, created_at, payload", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("action_id", null)
      .in("event", ["campaign_blocked", "campaign_waiting", "campaign_status_cleared"])
      .order("created_at", { ascending: false })
      .limit(JOURNAL_ROW_LIMIT),
    readDemoPresentation(organizationId),
    supabase
      .from("connectors")
      .select("provider, status", { count: "exact" })
      .eq("organization_id", organizationId)
      .neq("provider", DEMO_PROVIDER)
      .order("provider", { ascending: true })
      .limit(CONNECTOR_ROW_LIMIT),
    supabase
      .from("organizations")
      .select("id, execution_paused, autonomy_level", { count: "exact" })
      .eq("id", organizationId)
      .order("id", { ascending: true })
      .limit(1),
    supabase
      .from("journal")
      .select("id, created_at, actor")
      .eq("organization_id", organizationId)
      .eq("event", "analysis_run")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
    readProspectSearch(supabase, organizationId, requestedProspectValue),
    readBudgetResultsData(supabase, organizationId, today),
  ]);

  const actionsComplete = completeRead(actionsResult, ACTION_ROW_LIMIT);
  const actionIds = actionsComplete ? actionsResult.data.map((action) => action.id) : [];
  const journalResult = actionsComplete && actionIds.length > 0
    ? await supabase
        .from("journal")
        .select("id, action_id, event, created_at, payload", { count: "exact" })
        .eq("organization_id", organizationId)
        .in("action_id", actionIds)
        .order("created_at", { ascending: false })
        .limit(JOURNAL_ROW_LIMIT)
    : actionsComplete
      ? { data: [], error: null, count: 0 }
      : { data: null, error: actionsResult.error, count: null };

  const metricsComplete = completeRead(metricsResult, METRIC_ROW_LIMIT);
  const linkedJournalComplete = completeRead(journalResult, JOURNAL_ROW_LIMIT);
  const statusJournalComplete = completeRead(statusJournalResult, JOURNAL_ROW_LIMIT);
  const journalRows = linkedJournalComplete && statusJournalComplete
    ? Array.from(
        new Map(
          [...journalResult.data, ...statusJournalResult.data].map((entry) => [entry.id, entry]),
        ).values(),
      )
    : null;

  return {
    organizationId,
    asOf: today.toISOString(),
    window,
    comparison,
    weeklyWindow,
    weeklyComparison,
    metricsResult,
    actionsResult,
    demoSnapshot,
    connectorsResult,
    agentControlResult,
    analysisJournalResult,
    prospectSearch,
    budgetResultsData,
    metricsComplete,
    actionsComplete,
    linkedJournalComplete,
    statusJournalComplete,
    snapshotInput: {
      rows: metricsComplete ? metricsResult.data : null,
      actions: actionsComplete ? actionsResult.data : null,
      journal: journalRows,
      providerStatuses: [],
      window,
      comparison,
    },
  };
}

export type CampaignPageSnapshot = Awaited<ReturnType<typeof readCampaignPageSnapshot>>;
