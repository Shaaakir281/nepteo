import { askOpenAiSearch, openAiSearchConfigured } from "@/lib/research/openai-search";
import { askPerplexity } from "@/lib/research/perplexity";
import {
  RESEARCH_PRESETS,
  type ResearchAnswer,
  type ResearchKind,
} from "@/lib/research/research-rules";

/**
 * Choix du fournisseur de recherche web — le point qui rend la décision
 * réversible : OpenAI et Perplexity coexistent derrière la même interface, et
 * `RESEARCH_PROVIDER` tranche sans toucher au code.
 *
 * Serveur uniquement (lit `process.env`). Ne lève jamais.
 */

export type ResearchProvider = "openai" | "perplexity";

/** Ordre par défaut quand aucune préférence n'est exprimée : la clé qui existe. */
const PROVIDERS: ResearchProvider[] = ["openai", "perplexity"];

function hasKey(provider: ResearchProvider): boolean {
  return provider === "openai"
    ? openAiSearchConfigured()
    : Boolean(process.env.PERPLEXITY_API_KEY);
}

/**
 * Fournisseur effectif : `RESEARCH_PROVIDER` s'il est valide ET que sa clé est
 * présente, sinon le premier fournisseur configuré, sinon `null`.
 *
 * Un `RESEARCH_PROVIDER` explicite mais sans clé ne tombe PAS en repli
 * silencieux sur l'autre : ce serait dépenser chez un fournisseur que
 * l'exploitant n'a pas choisi. On renvoie `null` → `no_key`, dégradation propre.
 */
export function researchProvider(): ResearchProvider | null {
  const wanted = (process.env.RESEARCH_PROVIDER ?? "").trim().toLowerCase();
  if (wanted === "openai" || wanted === "perplexity") {
    return hasKey(wanted) ? wanted : null;
  }
  return PROVIDERS.find(hasKey) ?? null;
}

/** La recherche est-elle configurée ? (présence d'une clé, jamais sa valeur) */
export function researchConfigured(): boolean {
  return researchProvider() !== null;
}

export type ResearchProviderResult =
  | ({ ok: true; searches?: number } & ResearchAnswer)
  | { ok: false; reason: string };

/**
 * Une recherche facturée, chez le fournisseur retenu. L'appelant doit avoir
 * passé les garde-fous, réservé atomiquement le quota et écrit au journal AVANT.
 * Passer par `runResearch`, jamais directement.
 */
export async function askResearch(args: {
  kind: ResearchKind;
  query: string;
}): Promise<ResearchProviderResult> {
  const provider = researchProvider();
  if (!provider) return { ok: false, reason: "no_key" };
  if (provider === "openai") {
    return askOpenAiSearch({ kind: args.kind, query: args.query });
  }
  return askPerplexity({ query: args.query, preset: RESEARCH_PRESETS[args.kind] });
}
