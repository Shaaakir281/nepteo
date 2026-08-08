"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/auth/context";
import { readMemory } from "@/lib/memory-store";
import { runAdsAnalysis } from "@/lib/ads/analysis";
import {
  buildCampaignPlan,
  campaignTypeLabel,
  objectiveLabel,
  channelLabel,
  metricLabel,
  metricUnit,
  validateCampaignBrief,
  type CampaignBrief,
  type CampaignValidationErrors,
  type CampaignPlan,
} from "@/lib/campaign-plan";
import {
  generateCampaignHooks,
  type CampaignGenerationTrace,
} from "@/lib/campaign";
import {
  buildCampaignEvidence,
  buildCampaignProjection,
  campaignEvidenceProviderForChannel,
  CAMPAIGN_EVIDENCE_WINDOW_DAYS,
  type CampaignEvidence,
  type CampaignProjectionResult,
} from "@/lib/campaign-evidence";
import {
  createInitialCampaignStudioDraft,
  deriveCampaignStudioProposal,
  deriveExpectedCampaignFormats,
  validateCampaignStudioIntent,
  type CampaignExpectedFormat,
  type CampaignStudioDraft,
  type CampaignStudioValidationIssue,
} from "@/lib/campaign-studio";
import { buildCampaignCompetitionResearchRequest } from "@/lib/campaign-research";
import { readResearchQuota, runResearch } from "@/lib/research/research";
import { isDemoModeActive } from "@/lib/demo/isolation";
import { DEMO_CAMPAIGN_PREFIX } from "@/lib/demo/isolation-rules";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withDemoMutationLock,
  withRealDataMutationLock,
} from "@/lib/demo/lock";

export type CampaignBuild = {
  brief: CampaignBrief;
  plan: CampaignPlan;
  evidence: CampaignEvidence;
  projection: CampaignProjectionResult;
  studio: CampaignStudioDraft;
  expectedFormats: CampaignExpectedFormat[];
  generation: CampaignGenerationTrace;
  demo: boolean;
};

export type CampaignBuildResult =
  | { ok: true; build: CampaignBuild }
  | {
      ok: false;
      reason: "forbidden" | "invalid_brief" | "build_failed";
      errors?: CampaignValidationErrors;
    };

export type CampaignSubmitResult =
  | { ok: true; duplicate: boolean; actionId: string }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "invalid_brief"
        | "invalid_studio"
        | "invalid_request_key"
        | "busy"
        | "submission_failed";
      errors?: CampaignValidationErrors;
      issues?: CampaignStudioValidationIssue[];
      message?: string;
    };

export type CampaignCompetitionResearchResult =
  | {
      ok: true;
      cached: boolean;
      text: string;
      sources: { title: string; url: string; date?: string }[];
      quota: { used: number; limit: number | null; remaining: number | null };
    }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "invalid_brief"
        | "confirmation_required"
        | "force_confirmation_required"
        | "demo_forbidden"
        | "busy"
        | "quota_unavailable"
        | "research_failed";
      message?: string;
    };

const REQUEST_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Preuve datée et fail-closed : une erreur de lecture n'est jamais « zéro donnée ». */
async function loadCampaignEvidence(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  channel: string,
): Promise<CampaignEvidence> {
  const provider = campaignEvidenceProviderForChannel(channel);
  const windowEnd = isoDaysAgo(0);
  if (!provider) {
    return buildCampaignEvidence({ channel, rows: null, windowEnd });
  }
  const { data: rows, error } = await admin
    .from("ad_metrics")
    .select("provider, campaign_id, campaign_name, date, spend, conversions, revenue, synced_at")
    .eq("organization_id", orgId)
    .eq("provider", provider.provider)
    .gte("date", isoDaysAgo(CAMPAIGN_EVIDENCE_WINDOW_DAYS - 1))
    .lte("date", windowEnd);
  return buildCampaignEvidence({
    channel,
    rows: error ? null : rows,
    windowEnd,
  });
}

function deriveCampaignPlanWithProjection(
  brief: CampaignBrief,
  evidence: CampaignEvidence,
): { plan: CampaignPlan; projection: CampaignProjectionResult } {
  const basePlan = buildCampaignPlan(brief);
  const projection = buildCampaignProjection(evidence, basePlan.totalBudget);
  if (projection.status !== "available") {
    return { plan: basePlan, projection };
  }
  const derived = buildCampaignPlan(brief, {
    avgCostPerContact: projection.projection.costPerContact.estimate,
    confidence: projection.projection.confidence,
  });
  return {
    plan: {
      ...derived,
      contactsMin: projection.projection.volume.low,
      contactsMax: projection.projection.volume.high,
    },
    projection,
  };
}

/** Étape « Construction » : calcule le plan + rédige les variantes. Ne lance rien. */
export async function buildCampaignAction(
  input: unknown,
): Promise<CampaignBuildResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canManageCampaigns) {
    return { ok: false, reason: "forbidden" };
  }
  const validation = validateCampaignBrief(input);
  if (!validation.ok) {
    return { ok: false, reason: "invalid_brief", errors: validation.errors };
  }

  try {
    const admin = createAdminClient();
    const brief = validation.value;
    const evidence = await loadCampaignEvidence(admin, ctx.orgId, brief.channel);
    const { plan, projection } = deriveCampaignPlanWithProjection(brief, evidence);

    const memCtx = await readMemory(admin, ["activite", "ton"], ctx.orgId);
    const generated = await generateCampaignHooks({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      ctx: memCtx,
      brief,
    });
    const studio = createInitialCampaignStudioDraft(brief, generated.hooks);
    const demo = await isDemoModeActive(admin, ctx.orgId);

    return {
      ok: true,
      build: {
        brief,
        plan,
        evidence,
        projection,
        studio,
        expectedFormats: deriveExpectedCampaignFormats(brief.channel),
        generation: generated.generation,
        demo,
      },
    };
  } catch {
    return { ok: false, reason: "build_failed" };
  }
}

/** Étape finale : la campagne rejoint la file de validation (rien n'est lancé). */
export async function submitCampaignAction(
  input: unknown,
  studioInput: unknown,
  requestKey: string,
): Promise<CampaignSubmitResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canManageCampaigns) {
    return { ok: false, reason: "forbidden" };
  }
  const validation = validateCampaignBrief(input);
  if (!validation.ok) {
    return { ok: false, reason: "invalid_brief", errors: validation.errors };
  }
  const studioValidation = validateCampaignStudioIntent(studioInput);
  if (!studioValidation.ok) {
    return {
      ok: false,
      reason: "invalid_studio",
      issues: studioValidation.issues,
      message: studioValidation.issues[0]?.message,
    };
  }
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    return { ok: false, reason: "invalid_request_key" };
  }

  const admin = createAdminClient();
  try {
    return await withDemoMutationLock(admin, ctx.orgId, "campaign", async () => {
      // CAMP-1 recharge la preuve puis redérive plan, budgets et formats.
      // Aucun snapshot, budget d'adset ou format du navigateur n'est accepté.
      const brief = validation.value;
      const evidence = await loadCampaignEvidence(admin, ctx.orgId, brief.channel);
      const { plan, projection } = deriveCampaignPlanWithProjection(brief, evidence);
      const studio = deriveCampaignStudioProposal(studioValidation.value, {
        totalBudget: plan.totalBudget,
        channel: brief.channel,
      });
      if (!studio.ok) {
        return {
          ok: false,
          reason: "invalid_studio",
          issues: studio.issues,
          message: studio.issues[0]?.message,
        };
      }
      const demo = await isDemoModeActive(admin, ctx.orgId);
      const title = `Préparer la campagne « ${objectiveLabel(brief.objective)} » sur ${channelLabel(brief.channel)}`;
      const finding =
        `${campaignTypeLabel(brief.campaignType)} · ${plan.totalBudget} € sur ` +
        `${plan.durationDays} jours · hypothèse : ${brief.hypothesis}`;
      const rationale =
        "Cette proposition reprend le brief, la structure arbitrée et un snapshot recalculé côté serveur. " +
        "La validation la conserve comme prête à examiner ; elle ne lance aucune campagne.";
      const expectedImpact = projection.status === "available"
        ? `${metricLabel(brief.primaryMetric)} : seuil ${brief.successThreshold} ` +
          `${metricUnit(brief.primaryMetric)} · estimation ${projection.projection.volume.low}–` +
          `${projection.projection.volume.high} conversions, CAC ${projection.projection.costPerContact.low}–` +
          `${projection.projection.costPerContact.high} € sur données observées`
        : `${metricLabel(brief.primaryMetric)} : seuil ${brief.successThreshold} ` +
          `${metricUnit(brief.primaryMetric)} · projection chiffrée indisponible faute de données suffisantes`;
      const selectedHooks = studio.value.selectedHookIndices.map(
        (index) => studio.value.hooks[index],
      );
      const intent = {
        proposalVersion: studio.value.proposalVersion,
        brief,
        studio: studioValidation.value,
      };
      const payload = {
        proposalVersion: studio.value.proposalVersion,
        intent,
        brief,
        plan,
        variants: selectedHooks,
        studio: studio.value,
        evidence,
        projection,
        execution: "not_available_camp_1",
        ...(demo ? { demo: true } : {}),
      };
      const { data, error } = await admin.rpc("propose_campaign_studio_action", {
        p_organization_id: ctx.orgId,
        p_actor_id: ctx.userId,
        p_request_key: requestKey,
        p_title: title,
        p_finding: finding,
        p_rationale: rationale,
        p_data_sources:
          evidence.status === "available"
            ? [
                "Brief explicite",
                `${evidence.source.label} observé du ${evidence.source.from} au ${evidence.source.to}`,
              ]
            : [
                "Brief explicite",
                `${evidence.source.label || "Historique publicitaire"} — données insuffisantes`,
              ],
        p_expected_impact: expectedImpact,
        p_confidence: plan.confidence ?? 0,
        p_payload: payload,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, reason: "submission_failed" };
      }
      const result = data as Record<string, unknown>;
      if (typeof result.action_id !== "string") {
        return { ok: false, reason: "submission_failed" };
      }
      revalidatePath("/");
      return {
        ok: true,
        duplicate: result.created === false,
        actionId: result.action_id,
      };
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof DemoBusyError ? "busy" : "submission_failed",
    };
  }
}

/** Veille CAMP-1 séparée : confirmation obligatoire, jamais appelée par build/submit. */
export async function researchCampaignCompetitionAction(input: {
  brief: unknown;
  confirmed: boolean;
  force?: boolean;
  forceConfirmed?: boolean;
}): Promise<CampaignCompetitionResearchResult> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canManageCampaigns) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.confirmed !== true) {
    return { ok: false, reason: "confirmation_required" };
  }
  if (input.force && input.forceConfirmed !== true) {
    return { ok: false, reason: "force_confirmation_required" };
  }
  const validation = validateCampaignBrief(input.brief);
  if (!validation.ok) return { ok: false, reason: "invalid_brief" };

  const admin = createAdminClient();
  try {
    return await withRealDataMutationLock(admin, ctx.orgId, async () => {
      const quotaBefore = await readResearchQuota(admin, ctx.orgId);
      if (!quotaBefore) return { ok: false, reason: "quota_unavailable" };

      const request = buildCampaignCompetitionResearchRequest(validation.value);
      const result = await runResearch(admin, {
        orgId: ctx.orgId,
        actorId: ctx.userId,
        kind: "campaign_competition",
        subject: request.subject,
        query: request.query,
        force: Boolean(input.force),
      });
      if (!result.ok) {
        return { ok: false, reason: "research_failed", message: result.reason };
      }
      const quotaAfter = (await readResearchQuota(admin, ctx.orgId)) ?? quotaBefore;
      return {
        ok: true,
        cached: result.cached,
        text: result.text,
        sources: result.sources,
        quota: quotaAfter,
      };
    });
  } catch (error) {
    if (error instanceof DemoDataMutationBlockedError) {
      return { ok: false, reason: "demo_forbidden" };
    }
    return {
      ok: false,
      reason: error instanceof DemoBusyError ? "busy" : "research_failed",
    };
  }
}

/** Variante form (bouton « Analyser mes campagnes ») — redirige avec le compte. */
export async function analyzeAdsForm() {
  const res = await analyzeAdsNow();
  redirect(`/campagnes?proposed=${res.ok ? res.created : "err"}`);
}

/** Analyse les campagnes et propose des actions (couper les campagnes en perte). */
export async function analyzeAdsNow(): Promise<{ ok: boolean; created: number }> {
  const ctx = await getEditorContext();
  if (!ctx || !ctx.canManageCampaigns) return { ok: false, created: 0 };
  const admin = createAdminClient();
  try {
    return await withDemoMutationLock(admin, ctx.orgId, "analysis", async () => {
      const demo = await isDemoModeActive(admin, ctx.orgId);
      const created = await runAdsAnalysis(admin, ctx.orgId, ctx.userId, {
        ...(demo
          ? {
              campaignIdPrefix: DEMO_CAMPAIGN_PREFIX,
              demo: true,
            }
          : {}),
      });
      revalidatePath("/campagnes");
      revalidatePath("/");
      return { ok: true, created };
    });
  } catch {
    return { ok: false, created: 0 };
  }
}
