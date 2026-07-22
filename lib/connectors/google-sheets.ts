import type { FieldMapping, NormalizedProspect } from "./common";

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

/** En-tête correspondant au premier motif trouvé (par nom, réutilisable par l'UI). */
function matchHeader(headers: string[], patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const h = headers.find((x) => x && re.test(x));
    if (h) return h;
  }
  return null;
}

/** Détection auto des colonnes → champs Nepteo. Sert de valeur par défaut
 *  quand aucun mapping explicite n'est enregistré, et de valeur pré-remplie
 *  dans l'écran de correspondance. */
export function autoDetectSheetMapping(headers: string[]): FieldMapping {
  return {
    name: matchHeader(headers, [/^nom$|^name$/i, /nom/i, /name/i, /contact/i]),
    email: matchHeader(headers, [/e-?mail/i, /courriel/i]),
    company: matchHeader(headers, [/entreprise/i, /soci[eé]t[eé]/i, /company/i, /organisation/i]),
    stage: matchHeader(headers, [/statut/i, /status/i, /stage/i, /[ée]tape/i]),
    notes: matchHeader(headers, [/notes?/i, /remarque/i, /commentaire/i, /comment/i]),
  };
}

/** Lit méta + valeurs et renvoie en-têtes nettoyés + lignes de données. */
async function readSheet(
  token: string,
  spreadsheetId: string,
): Promise<{ headers: string[]; rows: string[][] }> {
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
  const all = data.values ?? [];
  if (all.length === 0) return { headers: [], rows: [] };
  return {
    headers: all[0].map((h) => (h ?? "").trim()),
    rows: all.slice(1),
  };
}

/** En-têtes de colonnes du classeur — pour peupler l'écran de correspondance. */
export async function listSheetColumns(
  token: string,
  spreadsheetId: string,
): Promise<string[]> {
  const { headers } = await readSheet(token, spreadsheetId);
  return headers.filter((h) => h.length > 0);
}

export async function fetchSheetProspects(
  token: string,
  spreadsheetId: string,
  mapping?: FieldMapping,
): Promise<NormalizedProspect[]> {
  const { headers, rows } = await readSheet(token, spreadsheetId);
  if (rows.length === 0) return [];

  const map = mapping ?? autoDetectSheetMapping(headers);
  const indexOf = (header: string | null | undefined) =>
    header ? headers.indexOf(header) : -1;
  const iName = indexOf(map.name);
  const iEmail = indexOf(map.email);
  const iCompany = indexOf(map.company);
  const iStage = indexOf(map.stage);
  const iNotes = indexOf(map.notes);

  return rows.flatMap((r, idx) => {
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
        notes: cell(iNotes),
        raw,
      },
    ];
  });
}
