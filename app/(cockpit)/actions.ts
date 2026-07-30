"use server";

import {
  analyzeNow as analyzeNowImpl,
  type AnalyzeNowResult,
} from "./_actions/analysis";
import {
  draftForAction as draftForActionImpl,
  draftForProspect as draftForProspectImpl,
  saveDraftEdit as saveDraftEditImpl,
} from "./_actions/action-drafts";
import {
  decideAction as decideActionImpl,
  resumeAction as resumeActionImpl,
} from "./_actions/decisions";
import {
  executeAction as executeActionImpl,
  executeActionForm as executeActionFormImpl,
  toggleExecutionPause as toggleExecutionPauseImpl,
} from "./_actions/execution";
import {
  prospectsForAction as prospectsForActionImpl,
  saveProspectNote as saveProspectNoteImpl,
} from "./_actions/prospects";
import {
  recordValueEvent as recordValueEventImpl,
  type RecordValueEventResult,
} from "./_actions/value-events";
import {
  proposeDormantPlay as proposeDormantPlayImpl,
  type DormantPlayResult,
} from "./_actions/dormant-play";
import type { Draft } from "@/lib/draft";
import type { ExecutionResult } from "@/lib/execution";
import type { ValueEventInput } from "@/lib/value-events-rules";

export type DraftResult =
  | { ok: true; draft: Draft }
  | { ok: false; reason: "forbidden" | "not_found" | "not_relance" };

export interface TargetProspect {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  note: string | null; // note interne Nepteo (éditable)
  hasNotes: boolean;
  hasDraft: boolean;
}

export async function decideAction(formData: FormData) {
  return decideActionImpl(formData);
}

export async function resumeAction(formData: FormData) {
  return resumeActionImpl(formData);
}

export async function draftForAction(
  id: string,
  regenerate = false,
): Promise<DraftResult> {
  return draftForActionImpl(id, regenerate);
}

export async function prospectsForAction(
  id: string,
): Promise<{ ok: boolean; prospects: TargetProspect[] }> {
  return prospectsForActionImpl(id);
}

export async function saveProspectNote(
  prospectId: string,
  note: string,
): Promise<{ ok: boolean }> {
  return saveProspectNoteImpl(prospectId, note);
}

export async function draftForProspect(
  actionId: string,
  prospectId: string,
  regenerate = false,
  enrich = false,
): Promise<DraftResult> {
  return draftForProspectImpl(actionId, prospectId, regenerate, enrich);
}

export async function saveDraftEdit(
  id: string,
  subject: string,
  body: string,
): Promise<DraftResult> {
  return saveDraftEditImpl(id, subject, body);
}

export async function executeAction(id: string): Promise<ExecutionResult> {
  return executeActionImpl(id);
}

export async function executeActionForm(formData: FormData) {
  return executeActionFormImpl(formData);
}

export async function toggleExecutionPause(paused: boolean): Promise<void> {
  return toggleExecutionPauseImpl(paused);
}

export async function analyzeNow(): Promise<AnalyzeNowResult> {
  return analyzeNowImpl();
}

export async function proposeDormantPlay(
  minSilenceDays: number,
): Promise<DormantPlayResult> {
  return proposeDormantPlayImpl(minSilenceDays);
}

export async function recordValueEvent(
  input: ValueEventInput,
): Promise<RecordValueEventResult> {
  return recordValueEventImpl(input);
}
