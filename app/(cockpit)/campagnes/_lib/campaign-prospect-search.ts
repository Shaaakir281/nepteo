import type { getCurrentAuthContext } from "@/lib/auth/context";
import type { CampaignProspectSearch } from "../_components/campaign-decision-types";
import {
  PROSPECT_QUERY_MAX_LENGTH,
  PROSPECT_QUERY_MIN_LENGTH,
  PROSPECT_SEARCH_LIMIT,
  type CampaignSearchParam,
} from "./campaign-page-constants";
import { formatDateTime } from "./campaign-formatters";
import { completeRead, isRecord } from "./campaign-read-utils";

type CampaignPageSupabase = Awaited<
  ReturnType<typeof getCurrentAuthContext>
>["supabase"];

interface SafeProspectRow {
  id: string;
  name: string | null;
  company: string | null;
  source: string;
  synced_at: string;
}

export async function readProspectSearch(
  supabase: CampaignPageSupabase,
  organizationId: string,
  requestedValue: CampaignSearchParam,
): Promise<CampaignProspectSearch> {
  if (Array.isArray(requestedValue)) {
    return { state: "invalid", query: "", message: "Un seul paramètre de recherche prospect est accepté.", results: [] };
  }
  const rawQuery = requestedValue ?? "";
  if (rawQuery.length > PROSPECT_QUERY_MAX_LENGTH) return invalidSearch("");
  const query = rawQuery.normalize("NFC").trim().replace(/\s+/g, " ");
  if (query === "") {
    return {
      state: "idle",
      query: "",
      message: "Recherchez par nom ou société dans les prospects synchronisés de cette organisation.",
      results: [],
    };
  }
  const safeQuery = /^[\p{L}\p{N}][\p{L}\p{N}\s.'&’-]*$/u.test(query);
  if (!safeQuery || query.length < PROSPECT_QUERY_MIN_LENGTH || query.length > PROSPECT_QUERY_MAX_LENGTH) {
    return invalidSearch(query);
  }

  const select = "id, name, company, source, synced_at";
  const pattern = `%${query}%`;
  const [nameResult, companyResult] = await Promise.all([
    supabase
      .from("prospects")
      .select(select, { count: "exact" })
      .eq("organization_id", organizationId)
      .ilike("name", pattern)
      .order("synced_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(PROSPECT_SEARCH_LIMIT),
    supabase
      .from("prospects")
      .select(select, { count: "exact" })
      .eq("organization_id", organizationId)
      .ilike("company", pattern)
      .order("synced_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(PROSPECT_SEARCH_LIMIT),
  ]);
  if (!completeRead(nameResult, PROSPECT_SEARCH_LIMIT) || !completeRead(companyResult, PROSPECT_SEARCH_LIMIT)) {
    return {
      state: "unavailable",
      query,
      message: "Recherche indisponible ou tronquée : aucun résultat partiel n’est affiché.",
      results: [],
    };
  }

  const rows = Array.from(
    new Map([...nameResult.data, ...companyResult.data].map((row) => [row.id, row])).values(),
  );
  if (rows.length > PROSPECT_SEARCH_LIMIT || !rows.every(isSafeProspectRow)) {
    return {
      state: "unavailable",
      query,
      message: "Recherche indisponible ou trop large : précisez les termes, aucune liste partielle n’est affichée.",
      results: [],
    };
  }
  const results = (rows as SafeProspectRow[])
    .sort((left, right) => right.synced_at.localeCompare(left.synced_at) || left.id.localeCompare(right.id))
    .map((row) => ({
      id: row.id,
      name: row.name?.trim() || "Prospect sans nom enregistré",
      company: row.company?.trim() || null,
      source: row.source,
      syncedAtLabel: formatDateTime(row.synced_at),
    }));
  return {
    state: results.length === 0 ? "empty" : "ready",
    query,
    message: results.length === 0
      ? "Aucun prospect synchronisé ne correspond à cette recherche."
      : `${results.length} prospect${results.length > 1 ? "s" : ""} trouvé${results.length > 1 ? "s" : ""} dans la lecture complète.`,
    results,
  };
}

function invalidSearch(query: string): CampaignProspectSearch {
  return {
    state: "invalid",
    query,
    message: `Saisissez ${PROSPECT_QUERY_MIN_LENGTH} à ${PROSPECT_QUERY_MAX_LENGTH} caractères (lettres, chiffres, espaces, apostrophes ou tirets).`,
    results: [],
  };
}

export function isSafeProspectRow(row: unknown): row is SafeProspectRow {
  if (!isRecord(row)) return false;
  const syncedAt = typeof row.synced_at === "string" ? new Date(row.synced_at) : null;
  return (
    typeof row.id === "string" && row.id.trim().length > 0 && row.id.length <= 128 &&
    (row.name === null || typeof row.name === "string" && row.name.length <= 200) &&
    (row.company === null || typeof row.company === "string" && row.company.length <= 200) &&
    typeof row.source === "string" && row.source.trim().length > 0 && row.source.length <= 80 &&
    syncedAt !== null && !Number.isNaN(syncedAt.getTime())
  );
}
