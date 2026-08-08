import { generateText } from "ai";
import {
  getModelForTask,
  resolveTaskSpec,
  telemetryForTask,
} from "@/lib/llm";
import { withLlmTrace } from "@/lib/observability";
import { memoText } from "@/lib/draft-template";
import {
  channelLabel,
  cleanCampaignText,
  objectiveLabel,
  validateCampaignVariants,
  type CampaignBrief,
} from "@/lib/campaign-plan";
import { CAMPAIGN_STUDIO_LIMITS } from "@/lib/campaign-studio";

/** Un seul appel borné, sans retry, uniquement après le geste « Construire ». */
export const CAMPAIGN_AI_TIMEOUT_MS = 20_000;

export interface CampaignGenerationTrace {
  mode: "ai" | "fallback";
  task: "draft_post";
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  reason?: "timeout" | "provider_error" | "invalid_response";
}

export interface CampaignVariantsResult {
  variants: [string, string];
  generation: CampaignGenerationTrace;
}

export interface CampaignHooksResult {
  hooks: string[];
  generation: CampaignGenerationTrace;
}

function templateVariants(offer: string): [string, string] {
  const namedOffer = offer || "notre offre";
  return [
    `Une PME a gagné du temps grâce à ${namedOffer}. Voici comment — et ce que cela peut changer pour vous.`,
    `Vous savez que ${namedOffer} peut vous aider. La vraie question : par où commencer ? On s'en occupe.`,
  ];
}

function templateHooks(offer: string): string[] {
  const [first, second] = templateVariants(offer);
  return [
    first,
    second,
    `Avant d'investir davantage dans ${offer || "votre acquisition"}, testez une hypothèse claire et mesurez ce qui change réellement.`,
  ].map((hook) =>
    cleanCampaignText(hook).slice(0, CAMPAIGN_STUDIO_LIMITS.hookText.max),
  );
}

function validatedHooks(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const hooks = input.map(cleanCampaignText).filter(Boolean);
  if (
    hooks.length < CAMPAIGN_STUDIO_LIMITS.hooks.min ||
    hooks.length > CAMPAIGN_STUDIO_LIMITS.hooks.max ||
    hooks.some(
      (hook) =>
        hook.length < CAMPAIGN_STUDIO_LIMITS.hookText.min ||
        hook.length > CAMPAIGN_STUDIO_LIMITS.hookText.max,
    ) ||
    new Set(hooks.map((hook) => hook.normalize("NFKC").toLowerCase())).size !==
      hooks.length
  ) {
    return null;
  }
  return hooks;
}

function tokenCount(usage: unknown, key: string): number | null {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const value = (usage as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fallbackResult(
  fallback: [string, string],
  model: string,
  reason: CampaignGenerationTrace["reason"],
): CampaignVariantsResult {
  return {
    variants: fallback,
    generation: {
      mode: "fallback",
      task: "draft_post",
      model,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reason,
    },
  };
}

function fallbackHooksResult(
  hooks: string[],
  model: string,
  reason: CampaignGenerationTrace["reason"],
): CampaignHooksResult {
  return {
    hooks,
    generation: {
      mode: "fallback",
      task: "draft_post",
      model,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reason,
    },
  };
}

/**
 * CAMP-1 : propose trois hooks A/B/C après le geste explicite de construction.
 * Aucun appel supplémentaire n'est déclenché si le fournisseur échoue.
 */
export async function generateCampaignHooks(args: {
  orgId: string;
  actorId: string | null;
  ctx: Record<string, unknown>;
  brief: CampaignBrief;
}): Promise<CampaignHooksResult> {
  const activity = memoText(args.ctx, "activite");
  const tone = memoText(args.ctx, "ton");
  const fallback = templateHooks(args.brief.offer || activity);
  const model = resolveTaskSpec("draft_post");

  try {
    const result = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "draft_post" },
      () =>
        generateText({
          model: getModelForTask("draft_post"),
          maxOutputTokens: 600,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(CAMPAIGN_AI_TIMEOUT_MS),
          telemetry: telemetryForTask("draft_post"),
          prompt:
            `Rédige exactement 3 hooks de campagne distincts à arbitrer en A/B/C.\n` +
            `Objectif : ${objectiveLabel(args.brief.objective)}.\n` +
            `Canal : ${channelLabel(args.brief.channel)}.\n` +
            `Audience : ${args.brief.audience}.\n` +
            `Offre : ${args.brief.offer}.\n` +
            `Hypothèse : ${args.brief.hypothesis}.\n` +
            `Ton : ${tone || "concret, sans jargon"}.\n` +
            `Contexte : ${args.brief.context || "aucun"}.\n\n` +
            `Chaque hook contient 1 à 2 phrases en français et reste orienté bénéfice. ` +
            `Réponds STRICTEMENT trois lignes, préfixées « A: », « B: » et « C: ».`,
        }),
    );
    const hooks = validatedHooks(
      result.text
        .split("\n")
        .map((line) => line.replace(/^\s*[A-C]\s*[:.\-]\s*/i, "").trim())
        .filter(Boolean)
        .slice(0, CAMPAIGN_STUDIO_LIMITS.hooks.max),
    );
    if (!hooks) return fallbackHooksResult(fallback, model, "invalid_response");

    return {
      hooks,
      generation: {
        mode: "ai",
        task: "draft_post",
        model,
        inputTokens: tokenCount(result.usage, "inputTokens"),
        outputTokens: tokenCount(result.usage, "outputTokens"),
        totalTokens: tokenCount(result.usage, "totalTokens"),
      },
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return fallbackHooksResult(
      fallback,
      model,
      name === "TimeoutError" || name === "AbortError"
        ? "timeout"
        : "provider_error",
    );
  }
}

/**
 * Rédige deux variantes. La télémétrie technique expose le modèle, les tokens
 * et le coût dans Langfuse sans recopier le prompt ni la réponse métier.
 */
export async function generateCampaignVariants(args: {
  orgId: string;
  actorId: string | null;
  ctx: Record<string, unknown>;
  brief: CampaignBrief;
}): Promise<CampaignVariantsResult> {
  const activity = memoText(args.ctx, "activite");
  const tone = memoText(args.ctx, "ton");
  const fallback = templateVariants(args.brief.offer || activity);
  const model = resolveTaskSpec("draft_post");

  try {
    const result = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "draft_post" },
      () =>
        generateText({
          model: getModelForTask("draft_post"),
          maxOutputTokens: 400,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(CAMPAIGN_AI_TIMEOUT_MS),
          telemetry: telemetryForTask("draft_post"),
          prompt:
            `Rédige exactement 2 accroches de campagne, à tester l'une contre l'autre.\n` +
            `Objectif : ${objectiveLabel(args.brief.objective)}.\n` +
            `Canal : ${channelLabel(args.brief.channel)}.\n` +
            `Audience : ${args.brief.audience}.\n` +
            `Offre : ${args.brief.offer}.\n` +
            `Hypothèse : ${args.brief.hypothesis}.\n` +
            `Ton : ${tone || "concret, sans jargon"}.\n` +
            `Contexte : ${args.brief.context || "aucun"}.\n\n` +
            `Chaque accroche : 1 à 2 phrases, en français, orientée bénéfice. ` +
            `Réponds STRICTEMENT deux lignes, préfixées « A: » et « B: ».`,
        }),
    );
    const lines = result.text
      .split("\n")
      .map((line) => line.replace(/^\s*[AB]\s*[:.\-]\s*/i, "").trim())
      .filter(Boolean)
      .slice(0, 2);
    const validated = validateCampaignVariants(lines);
    if (!validated.ok) return fallbackResult(fallback, model, "invalid_response");

    return {
      variants: validated.value,
      generation: {
        mode: "ai",
        task: "draft_post",
        model,
        inputTokens: tokenCount(result.usage, "inputTokens"),
        outputTokens: tokenCount(result.usage, "outputTokens"),
        totalTokens: tokenCount(result.usage, "totalTokens"),
      },
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return fallbackResult(
      fallback,
      model,
      name === "TimeoutError" || name === "AbortError"
        ? "timeout"
        : "provider_error",
    );
  }
}
