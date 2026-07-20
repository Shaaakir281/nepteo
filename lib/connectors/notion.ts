import type { NormalizedProspect } from "./common";

/** Notion — OAuth intégration publique + lecture d'une base contacts. */

export interface NotionCreds {
  access_token: string;
  workspace_name?: string;
}

const NOTION = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

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
};

const plain = (arr?: { plain_text?: string }[]) =>
  (arr ?? []).map((t) => t.plain_text ?? "").join("").trim() || null;

export async function fetchNotionProspects(
  token: string,
  databaseId: string,
): Promise<NormalizedProspect[]> {
  const res = await fetch(`${NOTION}/databases/${databaseId}/query`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ page_size: 100 }),
  });
  if (!res.ok) throw new Error(`Notion query: ${res.status}`);
  const d = (await res.json()) as {
    results?: { id: string; properties?: Record<string, NotionProp> }[];
  };

  return (d.results ?? []).map((page) => {
    const props = page.properties ?? {};
    const entries = Object.entries(props);
    const byType = (t: string) => entries.find(([, p]) => p.type === t)?.[1];
    const byKey = (re: RegExp, types: string[]) =>
      entries.find(([k, p]) => re.test(k) && types.includes(p.type))?.[1];

    const name = plain(byType("title")?.title);
    const email = byType("email")?.email ?? null;
    const companyProp = byKey(/entreprise|soci|company|organisation/i, [
      "rich_text",
      "select",
    ]);
    const company =
      companyProp?.type === "select"
        ? (companyProp.select?.name ?? null)
        : plain(companyProp?.rich_text);
    const stageProp =
      byType("status") ??
      byKey(/statut|status|stage|[ée]tape/i, ["select", "status"]);
    const stage =
      stageProp?.type === "status"
        ? (stageProp.status?.name ?? null)
        : (stageProp?.select?.name ?? null);

    return {
      external_id: page.id,
      name,
      email,
      company,
      stage,
      raw: props as Record<string, unknown>,
    };
  });
}
