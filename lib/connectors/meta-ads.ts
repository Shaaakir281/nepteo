/**
 * Meta Marketing API -- contrat de lecture CAMP-3.
 *
 * Cet adaptateur ne contient volontairement aucun endpoint de mutation Ads.
 * Les lectures sont déclenchées exclusivement par les actions explicites de
 * l'utilisateur, avec timeout, sans retry automatique et sans persistance de
 * réponse brute.
 */

export const META_ADS_SCOPES = ["ads_read"] as const;
export const META_INSIGHT_WINDOWS = [7, 14, 30] as const;
export const META_MAX_ACCOUNTS = 25;
export const META_MAX_INSIGHT_ROWS = 100;

const REQUEST_TIMEOUT_MS = 20_000;

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

export interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
}

export interface MetaInsightSnapshot {
  version: 1;
  account_id: string;
  currency: string;
  window_days: (typeof META_INSIGHT_WINDOWS)[number];
  observation_from: string;
  observation_to: string;
  rows: MetaInsightRow[];
}

type JsonObject = Record<string, unknown>;

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

async function metaJson(path: string, query: Record<string, string>): Promise<JsonObject> {
  const response = await fetch(graphUrl(path, query), {
    method: "GET",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Lecture Meta Ads impossible.");
  const payload: unknown = await response.json();
  const parsed = object(payload);
  if (!parsed) throw new Error("Réponse Meta Ads invalide.");
  return parsed;
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

function day(value: unknown): string | null {
  const normalized = text(value, 10);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) && !Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))
    ? normalized
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647 ? parsed : null;
}

function nonNegativeMoney(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed <= 9_999_999_999.99 ? parsed : null;
}

function isWindow(value: number): value is (typeof META_INSIGHT_WINDOWS)[number] {
  return (META_INSIGHT_WINDOWS as readonly number[]).includes(value);
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
  const payload = await metaJson("me/permissions", {
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
  const payload = await metaJson("me/adaccounts", {
    fields: "id,name,currency,timezone_name,account_status",
    limit: String(META_MAX_ACCOUNTS),
    access_token: accessToken,
  });
  if (object(payload.paging)?.next) {
    throw new Error("Liste de comptes Meta Ads incomplète.");
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

export function utcInsightWindow(days: number, now = new Date()): {
  days: (typeof META_INSIGHT_WINDOWS)[number];
  since: string;
  until: string;
} {
  if (!isWindow(days)) throw new Error("Fenêtre Meta Ads invalide.");
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days + 1);
  return {
    days,
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

function parseMetaInsightRow(
  value: unknown,
  since: string,
  until: string,
  expectedCurrency?: string,
): MetaInsightRow {
  const item = object(value);
  const campaignId = text(item?.campaign_id, 32);
  const campaignName = text(item?.campaign_name, 200);
  const date = day(item?.date_start);
  const impressions = nonNegativeInteger(item?.impressions);
  const clicks = nonNegativeInteger(item?.clicks);
  const spend = nonNegativeMoney(item?.spend);
  const rowCurrency = expectedCurrency ? currency(item?.account_currency) : expectedCurrency;
  if (
    !campaignId || !/^\d{1,32}$/.test(campaignId) || !campaignName || !date ||
    date < since || date > until || impressions === null || clicks === null || spend === null ||
    (expectedCurrency !== undefined && rowCurrency !== expectedCurrency)
  ) {
    throw new Error("Métriques Meta Ads invalides ou partielles.");
  }
  return { campaign_id: campaignId, campaign_name: campaignName, date, impressions, clicks, spend };
}

function parseStoredMetaInsightRow(
  value: unknown,
  since: string,
  until: string,
): MetaInsightRow {
  const item = object(value);
  return parseMetaInsightRow({ ...item, date_start: item?.date }, since, until);
}

export async function readMetaCampaignInsights(
  accessToken: string,
  account: MetaAdAccount,
  days: number,
  now = new Date(),
): Promise<MetaInsightSnapshot> {
  const window = utcInsightWindow(days, now);
  const payload = await metaJson(`${account.id}/insights`, {
    level: "campaign",
    fields: "campaign_id,campaign_name,date_start,impressions,clicks,spend,account_currency",
    time_increment: "1",
    time_range: JSON.stringify({ since: window.since, until: window.until }),
    limit: String(META_MAX_INSIGHT_ROWS),
    access_token: accessToken,
  });
  if (object(payload.paging)?.next) {
    throw new Error("Métriques Meta Ads incomplètes : la pagination dépasse la borne.");
  }
  const entries = Array.isArray(payload.data) ? payload.data : null;
  if (!entries || entries.length > META_MAX_INSIGHT_ROWS) {
    throw new Error("Métriques Meta Ads invalides ou partielles.");
  }
  const rows = entries.map((entry) =>
    parseMetaInsightRow(entry, window.since, window.until, account.currency),
  );
  if (new Set(rows.map((row) => `${row.campaign_id}:${row.date}`)).size !== rows.length) {
    throw new Error("Métriques Meta Ads ambiguës.");
  }
  return {
    version: 1,
    account_id: account.id,
    currency: account.currency,
    window_days: window.days,
    observation_from: window.since,
    observation_to: window.until,
    rows,
  };
}

export function readMetaInsightSnapshot(config: unknown): MetaInsightSnapshot | null {
  const root = object(config);
  const snapshot = object(root?.meta_insights_snapshot);
  if (!snapshot || snapshot.version !== 1) return null;
  const account = readSelectedMetaAdAccount(config);
  const currencyCode = currency(snapshot.currency);
  const days = snapshot.window_days;
  const from = day(snapshot.observation_from);
  const to = day(snapshot.observation_to);
  const entries = Array.isArray(snapshot.rows) ? snapshot.rows : null;
  if (!account || !currencyCode || !isWindow(days as number) || !from || !to || !entries || entries.length > META_MAX_INSIGHT_ROWS) return null;
  try {
    const rows = entries.map((entry) => parseStoredMetaInsightRow(entry, from, to));
    if (snapshot.account_id !== account.id || currencyCode !== account.currency) return null;
    return {
      version: 1,
      account_id: account.id,
      currency: currencyCode,
      window_days: days as (typeof META_INSIGHT_WINDOWS)[number],
      observation_from: from,
      observation_to: to,
      rows,
    };
  } catch {
    return null;
  }
}
