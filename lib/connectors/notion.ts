import type { FieldMapping, NormalizedProspect } from "./common";
import { normalizeContactDate } from "./date-rules.ts";

/** Notion — OAuth intégration publique + lecture d'une base contacts. */

export interface NotionCreds {
  access_token: string;
  workspace_name?: string;
}

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_DATABASE_PAGES = 50;

export function notionAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.NOTION_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
    state,
  });
  return `${NOTION}/oauth/authorize?${p}`;
}

export async function notionExchangeCode(
  code: string,
  redirectUri: string,
): Promise<NotionCreds> {
  const basic = Buffer.from(
    `${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(`${NOTION}/oauth/token`, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Notion token: ${res.status}`);
  const d = (await res.json()) as {
    access_token: string;
    workspace_name?: string;
  };
  return { access_token: d.access_token, workspace_name: d.workspace_name };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": VERSION,
    "Content-Type": "application/json",
  };
}

export async function notionListDatabases(
  token: string,
): Promise<{ id: string; title: string }[]> {
  const res = await fetch(`${NOTION}/search`, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: headers(token),
    body: JSON.stringify({
      filter: { property: "object", value: "database" },
      page_size: 25,
    }),
  });
  if (!res.ok) throw new Error(`Notion search: ${res.status}`);
  const d = (await res.json()) as {
    results?: { id: string; title?: { plain_text?: string }[] }[];
  };
  return (d.results ?? []).map((r) => ({
    id: r.id,
    title:
      (r.title ?? []).map((t) => t.plain_text ?? "").join("").trim() ||
      "Base sans titre",
  }));
}

type NotionProp = {
  type: string;
  title?: { plain_text?: string }[];
  rich_text?: { plain_text?: string }[];
  email?: string | null;
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  date?: { start?: string | null } | null;
};

const plain = (arr?: { plain_text?: string }[]) =>
  (arr ?? []).map((t) => t.plain_text ?? "").join("").trim() || null;

/** Valeur texte d'une propriété quel que soit son type. */
function readProp(prop?: NotionProp): string | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
      return plain(prop.title);
    case "rich_text":
      return plain(prop.rich_text);
    case "email":
      return prop.email ?? null;
    case "select":
      return prop.select?.name ?? null;
    case "status":
      return prop.status?.name ?? null;
    case "date":
      return prop.date?.start ?? null;
    default:
      return null;
  }
}

export interface NotionProperty {
  key: string;
  type: string;
}

/** Propriétés de la base (clé + type) — pour peupler l'écran de correspondance. */
export async function listNotionProperties(
  token: string,
  databaseId: string,
): Promise<NotionProperty[]> {
  const res = await fetch(`${NOTION}/databases/${databaseId}`, {
    headers: headers(token),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Notion database: ${res.status}`);
  const d = (await res.json()) as {
    properties?: Record<string, { type?: string }>;
  };
  return Object.entries(d.properties ?? {}).map(([key, p]) => ({
    key,
    type: p.type ?? "unknown",
  }));
}

/** Détection auto des propriétés → champs Nepteo, à partir du schéma de la base.
 *  Sert de valeur par défaut (sans mapping enregistré) et de pré-remplissage UI. */
export function autoDetectNotionMapping(props: NotionProperty[]): FieldMapping {
  const byType = (t: string) => props.find((p) => p.type === t)?.key ?? null;
  const byKey = (re: RegExp, types: string[]) =>
    props.find((p) => re.test(p.key) && types.includes(p.type))?.key ?? null;
  return {
    name: byType("title"),
    email: byType("email"),
    company: byKey(/entreprise|soci|company|organisation/i, ["rich_text", "select"]),
    stage:
      byType("status") ??
      byKey(/statut|status|stage|[ée]tape/i, ["select", "status"]),
    notes: byKey(/notes?|remarque|commentaire|comment/i, ["rich_text", "select"]),
    last_contact_at:
      byKey(
        /dernier.*contact|derni[eè]re.*relance|last.*contact|relance/i,
        ["date", "rich_text"],
      ) ??
      byType("date"),
  };
}

export async function fetchNotionProspects(
  token: string,
  databaseId: string,
  mapping?: FieldMapping,
): Promise<NormalizedProspect[]> {
  type NotionPage = {
    results?: { id: string; properties?: Record<string, NotionProp> }[];
    has_more?: boolean;
    next_cursor?: string | null;
  };
  const results: NonNullable<NotionPage["results"]> = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_DATABASE_PAGES; page++) {
    const res = await fetch(`${NOTION}/databases/${databaseId}/query`, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: headers(token),
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Notion query: ${res.status}`);
    const data = (await res.json()) as NotionPage;
    results.push(...(data.results ?? []));
    if (!data.has_more) break;
    if (!data.next_cursor || data.next_cursor === cursor) {
      throw new Error("Notion query: pagination invalide");
    }
    cursor = data.next_cursor;

    if (page === MAX_DATABASE_PAGES - 1) {
      throw new Error(
        `Notion query: plus de ${MAX_DATABASE_PAGES * 100} lignes, synchronisation interrompue`,
      );
    }
  }

  if (results.length === 0) return [];

  const schema: NotionProperty[] = Object.entries(
    results[0].properties ?? {},
  ).map(([key, p]) => ({ key, type: p.type }));
  const map = mapping ?? autoDetectNotionMapping(schema);

  return results.map((page) => {
    const props = page.properties ?? {};
    const val = (key: string | null | undefined) =>
      key ? readProp(props[key]) : null;
    return {
      external_id: page.id,
      name: val(map.name),
      email: val(map.email),
      company: val(map.company),
      stage: val(map.stage),
      notes: val(map.notes),
      last_contact_at: normalizeContactDate(val(map.last_contact_at)),
      raw: props as Record<string, unknown>,
    };
  });
}
