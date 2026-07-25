/**
 * Proposition d'identité d'entreprise — parties pures (aucun import, testable).
 * Lit la sortie JSON du LLM et la RAMÈNE aux valeurs que la mémoire accepte
 * (options d'activité, de clientèle, de canaux), en bornant chaque champ.
 *
 * Les listes d'options sont passées en paramètre plutôt qu'importées : un import
 * de valeur relatif entre `.ts` casse le type-stripping de node:test (piège
 * documenté dans docs/SUIVI.md). Ce fichier reste donc sans aucun import.
 *
 * Rien de ce qui sort d'ici n'est écrit en mémoire : c'est une PROPOSITION que
 * le solopreneur valide ou corrige (cf. principe directeur du chantier).
 */

export interface ProposedOffer {
  name: string;
  price?: string;
  target?: string;
  promise?: string;
}

export interface IdentityProposal {
  activity_type?: string;
  audience?: string;
  description?: string;
  zone?: string;
  ton?: string;
  canaux: string[];
  offres: ProposedOffer[];
  /** Ce que la recherche n'a pas permis d'établir — affiché tel quel, sans bluff. */
  gaps: string[];
}

export interface ProfileOptions {
  activityOptions: readonly string[];
  audienceOptions: readonly string[];
  channelOptions: readonly string[];
}

const MAX_DESCRIPTION = 1000;
const MAX_ZONE = 200;
const MAX_TON = 500;
const MAX_OFFERS = 6;
const MAX_OFFER_NAME = 80;
const MAX_OFFER_FIELD = 200;
const MAX_GAPS = 5;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Ramène une valeur libre à l'option la plus proche, sinon `undefined`. */
export function snapToOption(
  value: unknown,
  options: readonly string[],
): string | undefined {
  if (typeof value !== "string") return undefined;
  const needle = fold(value);
  if (!needle) return undefined;
  const exact = options.find((o) => fold(o) === needle);
  if (exact) return exact;
  // Tolérance : « saas » pour « SaaS ou application », « pro » pour « Entreprises »…
  return options.find((o) => {
    const hay = fold(o);
    return hay.includes(needle) || needle.includes(hay);
  });
}

/**
 * Extrait le premier objet JSON d'une réponse LLM (avec ou sans balises ```json).
 * Renvoie `null` si rien d'exploitable — l'appelant retombe alors sur la saisie
 * manuelle, jamais sur une identité inventée.
 */
export function extractJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  const withoutFences = raw.replace(/```(?:json)?/gi, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(withoutFences.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseOffers(raw: unknown): ProposedOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: ProposedOffer[] = [];
  for (const item of raw) {
    if (out.length >= MAX_OFFERS) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = str(o.name, MAX_OFFER_NAME);
    if (!name) continue; // le nom est le seul champ obligatoire d'une offre
    const offer: ProposedOffer = { name };
    const price = str(o.price, MAX_OFFER_FIELD);
    const target = str(o.target, MAX_OFFER_FIELD);
    const promise = str(o.promise, MAX_OFFER_FIELD);
    if (price) offer.price = price;
    if (target) offer.target = target;
    if (promise) offer.promise = promise;
    out.push(offer);
  }
  return out;
}

/**
 * Construit une proposition d'identité propre à partir de la sortie du LLM.
 * Toute valeur hors options est écartée (jamais forcée) : mieux vaut un champ
 * vide que l'utilisateur corrigera qu'une valeur que la mémoire refuserait.
 */
export function parseIdentityProposal(
  raw: unknown,
  options: ProfileOptions,
): IdentityProposal | null {
  const json = extractJson(raw);
  if (!json) return null;

  const canauxRaw = Array.isArray(json.canaux) ? json.canaux : [];
  const canaux: string[] = [];
  for (const c of canauxRaw) {
    const snapped = snapToOption(c, options.channelOptions);
    if (snapped && !canaux.includes(snapped)) canaux.push(snapped);
  }

  const gaps: string[] = [];
  if (Array.isArray(json.gaps)) {
    for (const g of json.gaps) {
      if (gaps.length >= MAX_GAPS) break;
      const text = str(g, MAX_OFFER_FIELD);
      if (text) gaps.push(text);
    }
  }

  const proposal: IdentityProposal = { canaux, offres: parseOffers(json.offres), gaps };

  const activityType = snapToOption(json.activity_type, options.activityOptions);
  const audience = snapToOption(json.audience, options.audienceOptions);
  const description = str(json.description, MAX_DESCRIPTION);
  const zone = str(json.zone, MAX_ZONE);
  const ton = str(json.ton, MAX_TON);
  if (activityType) proposal.activity_type = activityType;
  if (audience) proposal.audience = audience;
  if (description) proposal.description = description;
  if (zone) proposal.zone = zone;
  if (ton) proposal.ton = ton;

  return proposal;
}

/** Une proposition vide ne vaut pas la peine d'être montrée. */
export function isProposalUseful(p: IdentityProposal | null): boolean {
  if (!p) return false;
  return Boolean(
    p.activity_type ||
      p.audience ||
      p.description ||
      p.zone ||
      p.ton ||
      p.canaux.length > 0 ||
      p.offres.length > 0,
  );
}
