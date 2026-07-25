/**
 * Recherche web (Perplexity) — parties pures (aucun import, testable node:test).
 * Construction des requêtes, clé de cache, garde-fous et lecture de la réponse.
 * L'appel HTTP vit dans lib/research/perplexity.ts, l'orchestration (cache,
 * journal, plafonds en base) dans lib/research/research.ts.
 *
 * Principe : Perplexity COLLECTE des faits sourcés ; la couche LLM existante
 * les met en forme. Deux rôles distincts, deux modules.
 */

/** Types de recherche du produit. Un type = une requête et un cache dédiés. */
export type ResearchKind = "company_profile" | "prospect_company";

/**
 * Presets de l'Agent API Perplexity, du moins cher au plus profond.
 * (fast ≈ ex-Sonar, low ≈ ex-Sonar Pro, medium ≈ ex-Sonar Reasoning Pro,
 *  high ≈ ex-Sonar Deep Research.)
 */
export type ResearchPreset = "fast" | "low" | "medium" | "high" | "xhigh";

/** Profondeur par type de recherche — l'identité mérite plus qu'une fiche société. */
export const RESEARCH_PRESETS: Record<ResearchKind, ResearchPreset> = {
  company_profile: "low",
  prospect_company: "fast",
};

/** Garde-fou serveur : plafond de recherches facturées par organisation et par jour. */
export const MAX_RESEARCH_PER_DAY = 30;

/** Une réponse ne retient qu'une poignée de sources — au-delà c'est illisible. */
export const MAX_SOURCES = 6;

/** Durée de validité du cache : au-delà, une entreprise a pu changer. */
export const CACHE_DAYS = 30;

/** Bornes de sortie — protège la base et les prompts en aval. */
export const MAX_ANSWER_CHARS = 4000;

export interface ResearchSource {
  title: string;
  url: string;
  date?: string;
}

export interface ResearchAnswer {
  text: string;
  sources: ResearchSource[];
}

/** Minuscules, sans accents — base commune des clés de cache. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Clé de cache stable pour un sujet (nom d'entreprise ou URL).
 * « https://www.Acme-Corp.fr/ » et « acme corp » convergent : on ne paie pas
 * deux fois la même recherche. Chaîne vide si le sujet n'a rien d'exploitable.
 */
export function subjectKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return fold(raw)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** URL de site exploitable (http/https uniquement) — sinon chaîne vide. */
export function cleanWebsite(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname.includes(".")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Requête « profil d'entreprise » (onboarding). On demande explicitement de ne
 * rien inventer : une identité fausse contaminerait toutes les décisions en aval.
 */
export function buildCompanyQuery(input: {
  name: string;
  website?: string | null;
  activity?: string | null;
}): string {
  const name = (input.name ?? "").trim();
  const site = cleanWebsite(input.website);
  const activity = (input.activity ?? "").trim();
  return (
    `Fiche d'identité de l'entreprise « ${name} »` +
    (site ? ` (site officiel : ${site})` : "") +
    (activity ? `, activité déclarée par son dirigeant : ${activity}` : "") +
    `. En français, à partir de son site et de sources publiques, indique : ` +
    `ce qu'elle vend exactement, à quels clients, sa zone géographique, le ton ` +
    `de sa communication, ses offres ou gammes identifiables, et ses preuves de ` +
    `sérieux (avis, références, certifications). ` +
    `N'invente rien : si une information est introuvable, écris-le explicitement.`
  );
}

/**
 * Requête « fiche société » d'un prospect. Périmètre volontairement limité à
 * l'ENTREPRISE : aucune recherche sur la personne (décision RGPD, cf. DECISIONS.md).
 */
export function buildProspectCompanyQuery(input: {
  company: string;
  website?: string | null;
}): string {
  const company = (input.company ?? "").trim();
  const site = cleanWebsite(input.website);
  return (
    `Fiche de la société « ${company} »` +
    (site ? ` (site : ${site})` : "") +
    `. En français : secteur, taille approximative, ce qu'elle vend et à qui, ` +
    `zone d'implantation, et toute actualité récente utile pour engager une ` +
    `conversation commerciale (levée de fonds, recrutement, ouverture, nouveau produit). ` +
    `Uniquement des informations publiques sur l'entreprise — aucune information ` +
    `sur des personnes physiques. N'invente rien : signale ce que tu ne trouves pas.`
  );
}

export type ResearchGuard =
  | { ok: true }
  | { ok: false; reason: "no_key" | "paused" | "daily_cap" | "no_subject" };

/**
 * Garde-fous serveur, dans l'ordre de priorité : pas de clé > bouton d'arrêt >
 * sujet vide > plafond quotidien. Jamais uniquement en UI (cf. CLAUDE.md).
 */
export function guardResearch(input: {
  hasKey: boolean;
  paused: boolean;
  subject: string;
  usedToday: number;
  maxPerDay?: number;
}): ResearchGuard {
  if (!input.hasKey) return { ok: false, reason: "no_key" };
  if (input.paused) return { ok: false, reason: "paused" };
  if (!subjectKey(input.subject)) return { ok: false, reason: "no_subject" };
  const max = input.maxPerDay ?? MAX_RESEARCH_PER_DAY;
  if (input.usedToday >= max) return { ok: false, reason: "daily_cap" };
  return { ok: true };
}

/** Une entrée de cache est-elle encore valable ? (dates invalides = périmée) */
export function isFresh(
  createdAt: string,
  now: Date = new Date(),
  days: number = CACHE_DAYS,
): boolean {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return false;
  const ageMs = now.getTime() - then;
  if (ageMs < 0) return false;
  return ageMs < days * 24 * 60 * 60 * 1000;
}

function pushSource(
  out: ResearchSource[],
  seen: Set<string>,
  item: unknown,
): void {
  if (out.length >= MAX_SOURCES) return;
  if (!item || typeof item !== "object") return;
  const raw = item as Record<string, unknown>;
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url || seen.has(url)) return;
  seen.add(url);
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : url;
  const date = typeof raw.date === "string" && raw.date.trim() ? raw.date.trim() : undefined;
  out.push({ title: title.slice(0, 200), url, ...(date ? { date } : {}) });
}

/**
 * Lit la réponse de l'Agent API (`output[]` : un item `message` pour le texte,
 * un item `search_results` pour les sources). Tolère aussi l'ancienne forme
 * Sonar (`choices[].message.content` + `search_results`) : si Perplexity bascule
 * l'un ou l'autre, on ne casse pas. Ne lève jamais.
 */
export function parseResearchResponse(payload: unknown): ResearchAnswer {
  const empty: ResearchAnswer = { text: "", sources: [] };
  if (!payload || typeof payload !== "object") return empty;
  const root = payload as Record<string, unknown>;

  const chunks: string[] = [];
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  // Forme Agent API.
  if (Array.isArray(root.output)) {
    for (const item of root.output) {
      if (!item || typeof item !== "object") continue;
      const node = item as Record<string, unknown>;
      if (node.type === "message" && Array.isArray(node.content)) {
        for (const part of node.content) {
          if (!part || typeof part !== "object") continue;
          const p = part as Record<string, unknown>;
          if (typeof p.text === "string" && p.text.trim()) chunks.push(p.text.trim());
        }
      }
      if (node.type === "search_results" && Array.isArray(node.results)) {
        for (const r of node.results) pushSource(sources, seen, r);
      }
    }
  }

  // Forme Sonar (chat completions) — repli.
  if (chunks.length === 0 && Array.isArray(root.choices)) {
    for (const choice of root.choices) {
      if (!choice || typeof choice !== "object") continue;
      const message = (choice as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim()) chunks.push(content.trim());
      }
    }
  }
  if (Array.isArray(root.search_results)) {
    for (const r of root.search_results) pushSource(sources, seen, r);
  }
  if (sources.length === 0 && Array.isArray(root.citations)) {
    for (const c of root.citations) {
      if (typeof c === "string") pushSource(sources, seen, { url: c });
    }
  }

  return { text: chunks.join("\n\n").slice(0, MAX_ANSWER_CHARS), sources };
}

/** Rend une recherche lisible dans un prompt. Vide si rien trouvé (prompt inchangé). */
export function renderResearch(answer: ResearchAnswer | null | undefined): string {
  const text = (answer?.text ?? "").trim();
  if (!text) return "";
  const urls = (answer?.sources ?? []).map((s) => s.url);
  return urls.length > 0 ? `${text}\n\nSources : ${urls.join(", ")}` : text;
}
