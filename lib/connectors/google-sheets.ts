import type { NormalizedProspect } from "./common";

/** Google Sheets — OAuth + lecture seule (scope spreadsheets.readonly). */

export interface GoogleCreds {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // epoch ms
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function googleExchangeCode(
  code: string,
  redirectUri: string,
): Promise<GoogleCreds> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status}`);
  const d = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_in ? Date.now() + d.expires_in * 1000 : undefined,
  };
}

/** Token valide, rafraîchi si besoin. `updated` à re-chiffrer si présent. */
export async function googleFreshToken(
  creds: GoogleCreds,
): Promise<{ token: string; updated?: GoogleCreds }> {
  if (creds.expires_at && creds.expires_at > Date.now() + 60_000) {
    return { token: creds.access_token };
  }
  if (!creds.refresh_token) return { token: creds.access_token };
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: creds.refresh_token,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh: ${res.status}`);
  const d = (await res.json()) as { access_token: string; expires_in?: number };
  const updated: GoogleCreds = {
    ...creds,
    access_token: d.access_token,
    expires_at: d.expires_in ? Date.now() + d.expires_in * 1000 : undefined,
  };
  return { token: updated.access_token, updated };
}

export function parseSpreadsheetId(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return null;
}

function findCol(headers: string[], patterns: RegExp[]): number {
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(h));
    if (i !== -1) return i;
  }
  return -1;
}

export async function fetchSheetProspects(
  token: string,
  spreadsheetId: string,
): Promise<NormalizedProspect[]> {
  const auth = { Authorization: `Bearer ${token}` };
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: auth },
  );
  if (!metaRes.ok) throw new Error(`Sheets meta: ${metaRes.status}`);
  const meta = (await metaRes.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const title = meta.sheets?.[0]?.properties?.title ?? "Feuille 1";

  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${title}!A1:Z5000`)}`,
    { headers: auth },
  );
  if (!valRes.ok) throw new Error(`Sheets values: ${valRes.status}`);
  const data = (await valRes.json()) as { values?: string[][] };
  const rows = data.values ?? [];
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => (h ?? "").trim());
  const iName = findCol(headers, [/^nom$|^name$/i, /nom/i, /name/i, /contact/i]);
  const iEmail = findCol(headers, [/e-?mail/i, /courriel/i]);
  const iCompany = findCol(headers, [/entreprise/i, /soci[eé]t[eé]/i, /company/i, /organisation/i]);
  const iStage = findCol(headers, [/statut/i, /status/i, /stage/i, /[ée]tape/i]);

  return rows.slice(1).flatMap((r, idx) => {
    const cell = (i: number) => (i >= 0 ? (r[i] ?? "").trim() || null : null);
    const email = cell(iEmail);
    const name = cell(iName);
    if (!email && !name) return [];
    const raw: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) raw[h] = r[i] ?? "";
    });
    return [
      {
        external_id: email?.toLowerCase() ?? `row_${idx + 2}`,
        name,
        email,
        company: cell(iCompany),
        stage: cell(iStage),
        raw,
      },
    ];
  });
}
