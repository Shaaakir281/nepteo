/**
 * Recherche web — parties pures (aucun import, testable node:test).
 * Construction des requêtes, clé de cache, garde-fous et lecture des réponses.
 * Les appels HTTP vivent dans lib/research/perplexity.ts et
 * lib/research/openai-search.ts, le choix du fournisseur dans
 * lib/research/provider.ts, l'orchestration (cache, journal, plafonds en base)
 * dans lib/research/research.ts.
 *
 * Principe : le fournisseur de recherche COLLECTE des faits sourcés ; la couche
 * LLM existante les met en forme. Deux rôles distincts, deux modules.
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

/** Plafond atomique des appels facturés par organisation et par jour UTC. */
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
    `. En français, à partir de son site et de sources publiques, indique :\n` +
    `1. Ce qu'elle vend exactement, à quels clients, et sur quelle zone.\n` +
    `2. Ses OFFRES ou gammes identifiables, avec les prix affichés quand il y en a.\n` +
    `3. Le ton de sa communication et ses preuves de sérieux (avis, références, ` +
    `certifications).\n` +
    `4. Sa COMMUNICATION PUBLIQUE observable aujourd'hui : publicités visibles ` +
    `(bibliothèque publicitaire Meta, annonces Google), promotions ou offres en ` +
    `cours sur le site, réseaux sociaux actifs et rythme de publication, blog, ` +
    `newsletter, participation à des salons.\n` +
    `N'invente rien : si une information est introuvable, écris-le explicitement. ` +
    `Distingue bien ce que tu as vérifié de ce que tu supposes.`
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
  | { ok: false; reason: "no_key" | "no_subject" };

/**
 * Garde-fous serveur sans accès aux données : clé puis sujet. Pause et plafond
 * sont décidés ensemble par la réservation PostgreSQL, sous verrou organisation.
 */
export function guardResearch(input: {
  hasKey: boolean;
  subject: string;
}): ResearchGuard {
  if (!input.hasKey) return { ok: false, reason: "no_key" };
  if (!subjectKey(input.subject)) return { ok: false, reason: "no_subject" };
  return { ok: true };
}

export type ResearchQuotaReservation =
  | { allowed: true; reason: null; used: number }
  | {
      allowed: false;
      reason: "paused" | "daily_cap";
      used: number;
    };

/** Valide la réponse JSON de la RPC avant d'autoriser une dépense externe. */
export function readQuotaReservation(
  raw: unknown,
): ResearchQuotaReservation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.allowed !== "boolean") return null;
  if (typeof value.used !== "number" || !Number.isInteger(value.used)) {
    return null;
  }
  if (value.allowed) {
    if (value.reason !== null || value.used < 1) return null;
    return { allowed: true, reason: null, used: value.used };
  }
  if (
    (value.reason !== "paused" && value.reason !== "daily_cap") ||
    value.used < 0
  ) {
    return null;
  }
  return {
    allowed: false,
    reason: value.reason,
    used: value.used,
  };
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

/**
 * Profondeur de contexte web côté OpenAI (`search_context_size`) — le levier de
 * coût le plus direct de l'outil `web_search`.
 *
 * `ResearchPreset` reste la notion PRODUIT (calée sur Perplexity) : on ne la
 * remplace pas, on la traduit au bord. L'identité de l'entreprise du client
 * mérite plus de contexte qu'une fiche société de prospect, qui se contente
 * d'un survol.
 */
export function openaiSearchContext(kind: ResearchKind): "low" | "medium" | "high" {
  return kind === "company_profile" ? "medium" : "low";
}

/**
 * Lit la réponse de la Responses API OpenAI avec l'outil `web_search`.
 *
 * Forme attendue (`output[]`) :
 * - items `web_search_call` : `action.sources[]` = TOUTES les URL consultées
 *   (présentes seulement si la requête portait
 *   `include: ["web_search_call.action.sources"]`) ;
 * - items `message` : `content[].text` pour le texte, et
 *   `content[].annotations[]` de type `url_citation` pour les sources citées.
 *
 * Les citations passent AVANT la liste exhaustive : ce sont les sources
 * réellement utilisées, et `MAX_SOURCES` tronque le reste.
 *
 * ⚠️ Fonction distincte de `parseResearchResponse` (forme Perplexity) à dessein :
 * les deux formes se ressemblent assez (`output[]`, `type: "message"`,
 * `content[].text`) pour qu'un parseur « unifié » extraie le texte OpenAI mais
 * perde ses sources, silencieusement. Ne lève jamais.
 */
export function parseOpenAiSearchResponse(payload: unknown): ResearchAnswer {
  const empty: ResearchAnswer = { text: "", sources: [] };
  if (!payload || typeof payload !== "object") return empty;
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.output)) return empty;

  const chunks: string[] = [];
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  // 1) Texte + citations (`url_citation`) : les sources qui portent la réponse.
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const node = item as Record<string, unknown>;
    if (node.type !== "message" || !Array.isArray(node.content)) continue;
    for (const part of node.content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string" && p.text.trim()) chunks.push(p.text.trim());
      if (!Array.isArray(p.annotations)) continue;
      for (const annotation of p.annotations) {
        if (!annotation || typeof annotation !== "object") continue;
        if ((annotation as Record<string, unknown>).type !== "url_citation") continue;
        pushSource(sources, seen, annotation);
      }
    }
  }

  // 2) Complément : les pages consultées mais non citées.
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const node = item as Record<string, unknown>;
    if (node.type !== "web_search_call") continue;
    const action = node.action;
    if (!action || typeof action !== "object") continue;
    const list = (action as Record<string, unknown>).sources;
    if (!Array.isArray(list)) continue;
    for (const source of list) {
      pushSource(sources, seen, typeof source === "string" ? { url: source } : source);
    }
  }

  return { text: chunks.join("\n\n").slice(0, MAX_ANSWER_CHARS), sources };
}

/**
 * Nombre de recherches web réellement effectuées dans une réponse OpenAI.
 *
 * Une requête ≠ une recherche facturée : en mode agentique, le modèle peut
 * enchaîner plusieurs `web_search_call` dans un seul appel, chacun facturé
 * (10 $ / 1 000 appels d'outil, doc vérifiée le 2026-07-26). `MAX_RESEARCH_PER_DAY`
 * compte des appels `runResearch`, pas des recherches — ce compteur est le seul
 * moyen de savoir ce qu'on paie vraiment. Il finit au journal.
 */
export function countWebSearchCalls(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.output)) return 0;
  let count = 0;
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    if ((item as Record<string, unknown>).type === "web_search_call") count += 1;
  }
  return count;
}

/** Rend une recherche lisible dans un prompt. Vide si rien trouvé (prompt inchangé). */
export function renderResearch(answer: ResearchAnswer | null | undefined): string {
  const text = (answer?.text ?? "").trim();
  if (!text) return "";
  const urls = (answer?.sources ?? []).map((s) => s.url);
  return urls.length > 0 ? `${text}\n\nSources : ${urls.join(", ")}` : text;
}
