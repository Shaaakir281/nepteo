import type { CurrentAuthContext } from "@/lib/auth/context";
import { isCommercialSafeActionKind } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { prioritizeTodayActions } from "@/lib/today-priority-rules";
import {
  creativesByCampaign,
  loadCampaignCreativeAssets,
} from "@/lib/creative-assets";
import { readDemoPresentation } from "@/lib/demo/presentation";
import type { QueueAction } from "../_components/validation-queue";
import type { DecidedAction } from "../_components/decisions-history";

export async function loadTodayQueueData(
  supabase: CurrentAuthContext["supabase"],
  membership: CurrentAuthContext["membership"],
) {
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

  return { queue, decided, executionPaused, briefing, briefingPresentation };
}
