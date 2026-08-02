import {
  parseResearchResponse,
  type ResearchAnswer,
  type ResearchPreset,
} from "@/lib/research/research-rules";

/**
 * Client Perplexity — Agent API (`POST /v1/agent`, `{ preset, input }`).
 * Serveur uniquement, `fetch` natif : aucune dépendance npm.
 *
 * Ne lève JAMAIS : un échec de recherche ne doit pas casser un onboarding ni un
 * brouillon. Toute erreur ressort en `{ ok: false, reason }`, l'appelant décide.
 *
 * L'un des deux fournisseurs de recherche. Le choix se fait dans
 * lib/research/provider.ts (`researchConfigured` y vit désormais) — pas ici, pour
 * ne pas avoir deux chemins pour la même question.
 */

const ENDPOINT = "https://api.perplexity.ai/v1/agent";
const TIMEOUT_MS = 45_000;

export type PerplexityResult =
  | ({ ok: true } & ResearchAnswer)
  | { ok: false; reason: string };

/** Preset effectif : surcharge par env (`PERPLEXITY_PRESET`) sinon celui du type. */
export function resolvePreset(fallback: ResearchPreset): ResearchPreset {
  const override = process.env.PERPLEXITY_PRESET;
  const allowed: ResearchPreset[] = ["fast", "low", "medium", "high", "xhigh"];
  return allowed.includes(override as ResearchPreset)
    ? (override as ResearchPreset)
    : fallback;
}

/**
 * Une recherche facturée. L'appelant doit avoir passé les garde-fous, réservé
 * atomiquement le quota et écrit au journal AVANT — c'est un appel externe payant.
 */
export async function askPerplexity(args: {
  query: string;
  preset: ResearchPreset;
  maxAnswerChars?: number;
}): Promise<PerplexityResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  const query = args.query.trim();
  if (!query) return { ok: false, reason: "empty_query" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preset: resolvePreset(args.preset),
        input: query,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      // Statut seul : jamais le corps d'erreur (peut contenir la requête/la clé).
      return { ok: false, reason: `http_${response.status}` };
    }

    const payload: unknown = await response.json();
    const answer = parseResearchResponse(payload, args.maxAnswerChars);
    if (!answer.text) return { ok: false, reason: "empty_answer" };
    return { ok: true, ...answer };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "TimeoutError";
    return { ok: false, reason: aborted ? "timeout" : "network_error" };
  }
}
