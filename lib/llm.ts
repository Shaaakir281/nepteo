import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { mistral } from "@ai-sdk/mistral";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Couche LLM — multi-fournisseurs via Vercel AI SDK, serveur uniquement.
 * Un modèle se désigne par « provider:model », ex. « anthropic:claude-sonnet-5 ».
 * Trois niveaux d'usage, chacun configurable par env sans toucher au code.
 */

const PROVIDERS = { anthropic, openai, google, mistral } as const;
export type LlmProvider = keyof typeof PROVIDERS;

export type LlmTier = "light" | "standard" | "premium";

/** Défauts : Anthropic — light = tâches simples/volume, standard = cœur produit, premium = analyses profondes. */
const DEFAULT_SPECS: Record<LlmTier, string> = {
  light: "anthropic:claude-haiku-4-5-20251001",
  standard: "anthropic:claude-sonnet-5",
  premium: "anthropic:claude-opus-4-8",
};

const ENV_KEYS: Record<LlmTier, string | undefined> = {
  get light() {
    return process.env.LLM_MODEL_LIGHT;
  },
  get standard() {
    return process.env.LLM_MODEL;
  },
  get premium() {
    return process.env.LLM_MODEL_PREMIUM;
  },
};

export function resolveSpec(tier: LlmTier = "standard"): string {
  return ENV_KEYS[tier] || DEFAULT_SPECS[tier];
}

export function parseSpec(spec: string): {
  provider: LlmProvider;
  model: string;
} {
  const i = spec.indexOf(":");
  const provider = i === -1 ? "" : spec.slice(0, i);
  const model = i === -1 ? "" : spec.slice(i + 1);
  if (!(provider in PROVIDERS) || !model) {
    throw new Error(
      `Spécification LLM invalide « ${spec} » — attendu provider:model avec provider ∈ ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return { provider: provider as LlmProvider, model };
}

/** Modèle prêt à passer à generateText / streamText / generateObject. */
export function getModel(tier: LlmTier = "standard"): LanguageModel {
  const { provider, model } = parseSpec(resolveSpec(tier));
  return PROVIDERS[provider](model);
}

/** Présence des clés API par fournisseur (jamais les valeurs). */
export function providerKeyStatus(): Record<LlmProvider, boolean> {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY),
  };
}
