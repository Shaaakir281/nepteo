import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/lib/memory";
import {
  countWebSearchCalls,
  openaiSearchContext,
  parseOpenAiSearchResponse,
  researchAnswerLimit,
  type ResearchAnswer,
  type ResearchKind,
} from "@/lib/research/research-rules";

/**
 * Client OpenAI — outil `web_search` de la Responses API
 * (`POST /v1/responses`, `tools: [{ type: "web_search" }]`).
 * Serveur uniquement, `fetch` natif : aucune dépendance npm.
 *
 * Calqué sur lib/research/perplexity.ts : ne lève JAMAIS, ne renvoie jamais le
 * corps d'erreur, même vocabulaire de `reason`. Chercher n'est pas rédiger :
 * cet appel ne passe pas par `lib/llm.ts` (décision du 2026-07-25).
 *
 * Doc vérifiée le 2026-07-26 (<https://developers.openai.com/api/docs/guides/tools-web-search>) :
 * - `web_search` sur la Responses API — `web_search_preview` est legacy (ni
 *   `filters`, ni `return_token_budget`) et `gpt-4o*-search-preview` sont
 *   arrêtés depuis le 2026-07-23 ;
 * - sources exhaustives via `include: ["web_search_call.action.sources"]` ;
 * - `search_context_size` borne le contexte web injecté ;
 * - `return_token_budget` : on garde le défaut (l'`unlimited` est pour la deep
 *   research).
 */

const ENDPOINT = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 45_000;

/**
 * Modèle par défaut : celui que la doc désigne pour « new web search
 * integration » (Responses API + `web_search`). Surchargeable par env pour
 * suivre les sorties de modèles sans redéployer.
 */
const DEFAULT_MODEL = "gpt-5.5";

/**
 * Effort de raisonnement volontairement BAS.
 *
 * C'est le garde-fou de coût le plus important de ce fichier : un effort élevé
 * transforme la requête en recherche agentique, capable d'enchaîner plusieurs
 * dizaines de `web_search_call` facturés dans un seul appel. Le compteur des
 * appels `runResearch` ne suffit pas à révéler cette multiplication.
 * Ne pas monter cette valeur sans revoir la supervision des coûts.
 * (`minimal` n'est pas supporté avec `web_search`.)
 */
const REASONING_EFFORT = "low";

/**
 * Le laboratoire affiche des sections distinctes : sa réponse doit donc être
 * un objet exploitable, pas seulement un texte auquel le prompt demande du JSON.
 */
export function websitePreviewTextFormat() {
  return {
    type: "json_schema",
    name: "website_preview",
    strict: true,
    schema: {
      type: "object",
      properties: {
        activity_type: { type: "string", enum: ["", ...ACTIVITY_OPTIONS] },
        audience: { type: "string", enum: ["", ...AUDIENCE_OPTIONS] },
        description: { type: "string", maxLength: 1000 },
        zone: { type: "string", maxLength: 200 },
        ton: { type: "string", maxLength: 500 },
        canaux: {
          type: "array",
          items: { type: "string", enum: [...CHANNEL_OPTIONS] },
          maxItems: CHANNEL_OPTIONS.length,
        },
        offres: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              name: { type: "string", maxLength: 80 },
              price: { type: "string", maxLength: 200 },
              target: { type: "string", maxLength: 200 },
              promise: { type: "string", maxLength: 200 },
            },
            required: ["name", "price", "target", "promise"],
            additionalProperties: false,
          },
        },
        presence: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          maxItems: 6,
        },
        gaps: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          maxItems: 5,
        },
      },
      required: [
        "activity_type",
        "audience",
        "description",
        "zone",
        "ton",
        "canaux",
        "offres",
        "presence",
        "gaps",
      ],
      additionalProperties: false,
    },
  };
}

export type OpenAiSearchResult =
  | ({ ok: true; searches: number } & ResearchAnswer)
  | { ok: false; reason: string };

/** La recherche OpenAI est-elle configurée ? (présence de la clé, jamais sa valeur) */
export function openAiSearchConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Modèle effectif : `RESEARCH_OPENAI_MODEL` si fourni, sinon le défaut en dur. */
export function resolveSearchModel(): string {
  const override = (process.env.RESEARCH_OPENAI_MODEL ?? "").trim();
  return override || DEFAULT_MODEL;
}

/**
 * Une recherche facturée. L'appelant doit avoir passé les garde-fous, réservé
 * atomiquement le quota et écrit au journal AVANT — c'est un appel externe payant.
 */
export async function askOpenAiSearch(args: {
  kind: ResearchKind;
  query: string;
}): Promise<OpenAiSearchResult> {
  const key = process.env.OPENAI_API_KEY;
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
        model: resolveSearchModel(),
        input: query,
        tools: [
          {
            type: "web_search",
            search_context_size: openaiSearchContext(args.kind),
          },
        ],
        // Sans cet `include`, la réponse reste plausible mais perd ses sources
        // cliquables — régression silencieuse (le diagnostic doit rester
        // contestable).
        include: ["web_search_call.action.sources"],
        reasoning: { effort: REASONING_EFFORT },
        ...(args.kind === "website_preview"
          ? { text: { format: websitePreviewTextFormat() } }
          : {}),
        // Rien à conserver chez le fournisseur : les résultats vivent dans
        // `research_runs` (hébergement EU).
        store: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      // Statut seul : jamais le corps d'erreur (peut contenir la requête/la clé).
      return { ok: false, reason: `http_${response.status}` };
    }

    const payload: unknown = await response.json();
    const answer = parseOpenAiSearchResponse(
      payload,
      researchAnswerLimit(args.kind),
    );
    // Contrat partagé avec Perplexity : un texte vide est un ÉCHEC, sinon on
    // mettrait une recherche vide en cache pendant 30 jours.
    if (!answer.text) return { ok: false, reason: "empty_answer" };
    return { ok: true, searches: countWebSearchCalls(payload), ...answer };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "TimeoutError";
    return { ok: false, reason: aborted ? "timeout" : "network_error" };
  }
}
