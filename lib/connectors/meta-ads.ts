/**
 * Meta Marketing API -- contrat de lecture CAMP-3.
 *
 * Cet adaptateur ne contient volontairement aucun endpoint de mutation Ads.
 * Les lectures sont déclenchées exclusivement par les actions explicites de
 * l'utilisateur, avec timeout, sans retry automatique et sans persistance de
 * réponse brute.
 */

export const META_ADS_SCOPES = ["ads_read"] as const;
export const META_MAX_ACCOUNTS = 25;

const REQUEST_TIMEOUT_MS = 20_000;

export type MetaReadErrorCode =
  | "timeout"
  | "provider_error"
  | "invalid_response"
  | "partial_response"
  | "snapshot_too_large"
  | "account_changed"
  | "currency_mismatch"
  | "persistence_failed"
  | "persistence_ambiguous"
  | "stale_snapshot";

export class MetaReadError extends Error {
  readonly code: MetaReadErrorCode;

  constructor(code: MetaReadErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "MetaReadError";
  }
}

export interface MetaCreds {
  access_token: string;
  expires_at?: number;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function graphVersion(): string {
  const value = process.env.META_GRAPH_API_VERSION?.trim();
  if (!value || !/^v\d+\.\d+$/.test(value)) {
    throw new Error("Configuration Meta Ads incomplète.");
  }
  return value;
}

function oauthConfig(): { appId: string; appSecret: string; version: string } {
  const appId = process.env.META_OAUTH_APP_ID?.trim();
  const appSecret = process.env.META_OAUTH_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("Configuration Meta Ads incomplète.");
  return { appId, appSecret, version: graphVersion() };
}

function graphUrl(path: string, query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return `https://graph.facebook.com/${graphVersion()}/${path}?${params.toString()}`;
}

export async function metaGraphGet(
  path: string,
  query: Record<string, string>,
): Promise<JsonObject> {
  try {
    const response = await fetch(graphUrl(path, query), {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new MetaReadError("provider_error", "Lecture Meta Ads impossible.");
    }
    const payload: unknown = await response.json();
    const parsed = object(payload);
    if (!parsed) {
      throw new MetaReadError("invalid_response", "Réponse Meta Ads invalide.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof MetaReadError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new MetaReadError("timeout", "Lecture Meta Ads expirée.");
    }
    throw new MetaReadError("invalid_response", "Réponse Meta Ads invalide.");
  }
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function accountId(value: unknown): string | null {
  const id = text(value, 40);
  return id && /^act_\d{1,32}$/.test(id) ? id : null;
}

function currency(value: unknown): string | null {
  const normalized = text(value, 3)?.toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647 ? parsed : null;
}

export function metaAuthUrl(redirectUri: string, state: string): string {
  const { appId, version } = oauthConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: META_ADS_SCOPES.join(","),
    state,
  });
  return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}

export async function metaExchangeCode(code: string, redirectUri: string): Promise<MetaCreds> {
  const { appId, appSecret, version } = oauthConfig();
  const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token`, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!response.ok) throw new Error("Échange Meta Ads impossible.");
  const payload = object(await response.json());
  if (!payload) throw new Error("Réponse Meta Ads invalide.");
  const accessToken = text(payload.access_token, 4_096);
  if (!accessToken) throw new Error("Jeton Meta Ads invalide.");
  const expires = nonNegativeInteger(payload.expires_in);
  return {
    access_token: accessToken,
    expires_at: expires ? Date.now() + expires * 1_000 : undefined,
  };
}

/** Vérifie côté serveur que le jeton accordé contient bien, et seulement, le scope requis. */
export async function verifyMetaReadScope(accessToken: string): Promise<boolean> {
  const payload = await metaGraphGet("me/permissions", {
    fields: "permission,status",
    access_token: accessToken,
  });
  const entries = Array.isArray(payload.data) ? payload.data : [];
  return entries.some((entry) => {
    const item = object(entry);
    return item?.permission === "ads_read" && item.status === "granted";
  });
}

export function parseMetaAdAccounts(payload: unknown): MetaAdAccount[] {
  const root = object(payload);
  const entries = root && Array.isArray(root.data) ? root.data : null;
  if (!entries || entries.length > META_MAX_ACCOUNTS) {
    throw new Error("Liste de comptes Meta Ads invalide ou incomplète.");
  }
  const seen = new Set<string>();
  return entries.map((entry) => {
    const item = object(entry);
    const id = accountId(item?.id);
    const name = text(item?.name, 160);
    const accountCurrency = currency(item?.currency);
    const timezone = text(item?.timezone_name, 80);
    if (!id || !name || !accountCurrency || !timezone || seen.has(id)) {
      throw new Error("Liste de comptes Meta Ads invalide ou incomplète.");
    }
    seen.add(id);
    return { id, name, currency: accountCurrency, timezone };
  });
}

export async function listMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const payload = await metaGraphGet("me/adaccounts", {
    fields: "id,name,currency,timezone_name,account_status",
    limit: String(META_MAX_ACCOUNTS),
    access_token: accessToken,
  });
  if (object(payload.paging)?.next) {
    throw new MetaReadError("partial_response", "Liste de comptes Meta Ads incomplète.");
  }
  return parseMetaAdAccounts(payload);
}

function parseStoredMetaAccount(value: unknown): MetaAdAccount | null {
  const item = object(value);
  const id = accountId(item?.id);
  const name = text(item?.name, 160);
  const accountCurrency = currency(item?.currency);
  const timezone = text(item?.timezone, 80);
  return id && name && accountCurrency && timezone
    ? { id, name, currency: accountCurrency, timezone }
    : null;
}

export function readMetaAdAccountCandidates(config: unknown): MetaAdAccount[] {
  const root = object(config);
  const raw = root && Array.isArray(root.meta_ad_account_candidates)
    ? root.meta_ad_account_candidates
    : [];
  if (raw.length > META_MAX_ACCOUNTS) return [];
  const accounts = raw.map(parseStoredMetaAccount);
  if (accounts.some((account) => account === null)) return [];
  const valid = accounts as MetaAdAccount[];
  return new Set(valid.map((account) => account.id)).size === valid.length ? valid : [];
}

export function readSelectedMetaAdAccount(config: unknown): MetaAdAccount | null {
  const root = object(config);
  return parseStoredMetaAccount(root?.meta_ad_account);
}
