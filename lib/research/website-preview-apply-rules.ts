/** Contrat pur de la revue I2 avant toute écriture dans la mémoire. */

export const WEBSITE_PREVIEW_MEMORY_SECTIONS = [
  "activite",
  "zone",
  "ton",
  "canaux",
  "offres",
  "presence",
] as const;

export type WebsitePreviewMemorySection =
  (typeof WEBSITE_PREVIEW_MEMORY_SECTIONS)[number];

export interface WebsitePreviewApplyOptions {
  activityOptions: readonly string[];
  audienceOptions: readonly string[];
  channelOptions: readonly string[];
}

export interface WebsitePreviewApplicationSections {
  activite?: {
    activity_type: string;
    audience: string;
    description?: string;
  };
  zone?: { text: string };
  ton?: { text: string };
  canaux?: { list: string[] };
  offres?: {
    items: Array<{
      name: string;
      price?: string;
      target?: string;
      promise?: string;
    }>;
  };
  presence?: { list: string[] };
}

export interface WebsitePreviewCurrentProfile {
  activite?: {
    activity_type?: string;
    audience?: string;
    description?: string;
  };
  zone?: { text: string };
  ton?: { text: string };
  canaux?: { list: string[] };
  offres?: NonNullable<WebsitePreviewApplicationSections["offres"]>;
  presence?: { list: string[] };
}

export type WebsitePreviewApplicationParseResult =
  | { ok: true; sections: WebsitePreviewApplicationSections }
  | { ok: false; reason: "invalid_sections" | "nothing_selected" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number, required = false): string | null {
  if (typeof value !== "string") return required ? null : "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  if ((required && !cleaned) || cleaned.length > max) return null;
  return cleaned;
}

function exactOption(value: unknown, options: readonly string[]): string | null {
  return typeof value === "string" && options.includes(value) ? value : null;
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
  options?: readonly string[],
): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) {
    return null;
  }
  const out: string[] = [];
  for (const item of value) {
    const cleaned = text(item, maxLength, true);
    if (!cleaned || (options && !options.includes(cleaned))) return null;
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  return out.length > 0 ? out : null;
}

function offers(value: unknown): NonNullable<WebsitePreviewApplicationSections["offres"]> | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return null;
  const items: NonNullable<WebsitePreviewApplicationSections["offres"]>["items"] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const name = text(raw.name, 80, true);
    const price = text(raw.price, 200);
    const target = text(raw.target, 200);
    const promise = text(raw.promise, 200);
    if (!name || price === null || target === null || promise === null) return null;
    items.push({
      name,
      ...(price ? { price } : {}),
      ...(target ? { target } : {}),
      ...(promise ? { promise } : {}),
    });
  }
  return { items };
}

/** Refuse toute section inconnue ou partiellement invalide, sans troncature silencieuse. */
export function parseWebsitePreviewApplicationSections(
  raw: unknown,
  options: WebsitePreviewApplyOptions,
): WebsitePreviewApplicationParseResult {
  if (!isRecord(raw)) return { ok: false, reason: "invalid_sections" };
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ok: false, reason: "nothing_selected" };
  if (
    keys.length > WEBSITE_PREVIEW_MEMORY_SECTIONS.length ||
    keys.some(
      (key) => !(WEBSITE_PREVIEW_MEMORY_SECTIONS as readonly string[]).includes(key),
    )
  ) {
    return { ok: false, reason: "invalid_sections" };
  }

  const sections: WebsitePreviewApplicationSections = {};

  if ("activite" in raw) {
    const value = raw.activite;
    if (!isRecord(value)) return { ok: false, reason: "invalid_sections" };
    const activityType = exactOption(value.activity_type, options.activityOptions);
    const audience = exactOption(value.audience, options.audienceOptions);
    const description = text(value.description, 1000);
    if (!activityType || !audience || description === null) {
      return { ok: false, reason: "invalid_sections" };
    }
    sections.activite = {
      activity_type: activityType,
      audience,
      ...(description ? { description } : {}),
    };
  }

  for (const [key, max] of [["zone", 200], ["ton", 500]] as const) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (!isRecord(value)) return { ok: false, reason: "invalid_sections" };
    const cleaned = text(value.text, max, true);
    if (!cleaned) return { ok: false, reason: "invalid_sections" };
    if (key === "zone") sections.zone = { text: cleaned };
    else sections.ton = { text: cleaned };
  }

  if ("canaux" in raw) {
    const value = raw.canaux;
    if (!isRecord(value)) return { ok: false, reason: "invalid_sections" };
    const list = stringList(value.list, options.channelOptions.length, 80, options.channelOptions);
    if (!list) return { ok: false, reason: "invalid_sections" };
    sections.canaux = { list };
  }

  if ("offres" in raw) {
    const value = raw.offres;
    if (!isRecord(value)) return { ok: false, reason: "invalid_sections" };
    const parsed = offers(value.items);
    if (!parsed) return { ok: false, reason: "invalid_sections" };
    sections.offres = parsed;
  }

  if ("presence" in raw) {
    const value = raw.presence;
    if (!isRecord(value)) return { ok: false, reason: "invalid_sections" };
    const list = stringList(value.list, 6, 200);
    if (!list) return { ok: false, reason: "invalid_sections" };
    sections.presence = { list };
  }

  return { ok: true, sections };
}

/** Snapshot client borné de la fiche actuelle, uniquement pour la comparaison. */
export function readWebsitePreviewCurrentProfile(
  raw: unknown,
): WebsitePreviewCurrentProfile {
  if (!isRecord(raw)) return {};
  const result: WebsitePreviewCurrentProfile = {};
  const activity = raw.activite;
  if (isRecord(activity)) {
    const activityType = text(activity.activity_type, 60);
    const audience = text(activity.audience, 60);
    const description = text(activity.description, 1000);
    if (description !== null) {
      const currentActivity = {
        ...(activityType ? { activity_type: activityType } : {}),
        ...(audience ? { audience } : {}),
        ...(description ? { description } : {}),
      };
      if (Object.keys(currentActivity).length > 0) {
        result.activite = currentActivity;
      }
    }
  }
  for (const [key, max] of [["zone", 200], ["ton", 500]] as const) {
    const value = raw[key];
    if (!isRecord(value)) continue;
    const cleaned = text(value.text, max);
    if (!cleaned) continue;
    if (key === "zone") result.zone = { text: cleaned };
    else result.ton = { text: cleaned };
  }
  const channels = raw.canaux;
  if (isRecord(channels) && Array.isArray(channels.list)) {
    const list = channels.list
      .map((item) => text(item, 80))
      .filter((item): item is string => Boolean(item));
    if (list.length > 0) result.canaux = { list: list.slice(0, 8) };
  }
  const currentOffers = raw.offres;
  if (isRecord(currentOffers) && Array.isArray(currentOffers.items)) {
    const parsed = offers(currentOffers.items.slice(0, 6));
    if (parsed) result.offres = parsed;
  }
  const currentPresence = raw.presence;
  if (isRecord(currentPresence) && Array.isArray(currentPresence.list)) {
    const list = currentPresence.list
      .map((item) => text(item, 200))
      .filter((item): item is string => Boolean(item));
    if (list.length > 0) result.presence = { list: list.slice(0, 6) };
  }
  return result;
}
