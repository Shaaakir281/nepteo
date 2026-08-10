import type { CurrentAuthContext } from "@/lib/auth/context";
import {
  buildValueScorecard,
  type ValueEventForScorecard,
} from "@/lib/value-scorecard-rules";

const VALUE_EVENT_PAGE_SIZE = 1000;
const MAX_VALUE_SCORECARD_EVENTS = 5000;

export async function loadTodayScorecardData(
  supabase: CurrentAuthContext["supabase"],
  canEdit: boolean,
) {
  let valueScorecard: ReturnType<typeof buildValueScorecard> | null = null;
  let valueScorecardIncomplete = false;
  let valueScorecardReadFailed = false;
  if (!canEdit) {
    return { valueScorecard, valueScorecardIncomplete, valueScorecardReadFailed };
  }

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
    const { data: page, error } = await supabase
      .from("value_events")
      .select(
        "id, action_id, prospect_id, actor_id, event_type, source, is_demo, false_positive_reason, edit_level, occurred_at",
      )
      .eq("action_kind", "relaunch_dormant")
      .eq("is_demo", false)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, end);

    if (error || !page) {
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
  return { valueScorecard, valueScorecardIncomplete, valueScorecardReadFailed };
}
