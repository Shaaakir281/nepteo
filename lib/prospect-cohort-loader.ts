import type { SupabaseClient } from "@supabase/supabase-js";
import { isTerminalStage, isoDateMs } from "./analysis-rules.ts";
import { dedupeByEmail } from "./dedupe-prospects.ts";

export const DEFAULT_PROSPECT_PAGE_SIZE = 1_000;
export const DEFAULT_PROSPECT_MAX_ROWS = 5_000;
export const DEFAULT_PROSPECT_MAX_CONCURRENCY = 5;

export interface ProspectCohortRow {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  source: string;
  last_contact_at: string | null;
  synced_at: string;
}

export type ProspectCohortConflict = "active_stage_conflict";

/**
 * Ligne dérivée réservée aux calculs métier. Le marqueur de conflit n'existe
 * qu'en mémoire : il ne correspond à aucune colonne Supabase et n'est jamais
 * écrit dans la donnée source.
 */
export type CanonicalProspectCohortRow<
  T extends ProspectCohortRow = ProspectCohortRow,
> = Omit<T, "stage" | "last_contact_at"> &
  Pick<ProspectCohortRow, "stage" | "last_contact_at"> & {
    cohort_conflict?: ProspectCohortConflict;
  };

export interface ProspectSnapshotHead {
  id: string;
  synced_at: string;
}

export type ProspectSnapshotResult =
  | {
      ok: true;
      count: number;
      head: ProspectSnapshotHead | null;
    }
  | {
      ok: false;
      error?: unknown;
    };

export type ProspectPageResult<T extends ProspectCohortRow> =
  | {
      ok: true;
      rows: T[];
    }
  | {
      ok: false;
      error?: unknown;
    };

/**
 * Petite frontière injectable pour tester le scan sans Supabase. `page`
 * reçoit une plage inclusive, comme PostgREST `.range(from, to)`.
 */
export interface ProspectCohortReader<
  T extends ProspectCohortRow = ProspectCohortRow,
> {
  snapshot(): Promise<ProspectSnapshotResult>;
  page(from: number, to: number): Promise<ProspectPageResult<T>>;
}

export interface ProspectCohortFilters {
  organizationId?: string;
  source?: string;
  excludeSource?: string;
}

export interface LoadProspectCohortOptions {
  pageSize?: number;
  maxRows?: number;
  maxConcurrentPages?: number;
}

export type ProspectCohortUnavailableReason =
  | "count_failed"
  | "page_failed"
  | "verification_failed"
  | "concurrent_change";

export type ProspectCohortResult<
  T extends ProspectCohortRow = ProspectCohortRow,
> =
  | {
      status: "complete";
      importedCount: number;
      rawRows: T[];
      dedupedRows: T[];
      dedupedCount: number;
      maskedCount: number;
      canonicalRows: CanonicalProspectCohortRow<T>[];
      canonicalCount: number;
      canonicalMaskedCount: number;
    }
  | {
      status: "partial";
      reason: "limit_exceeded";
      importedCount: number;
      maxRows: number;
    }
  | {
      status: "unavailable";
      reason: ProspectCohortUnavailableReason;
      importedCount: number | null;
    };

function applyProspectFilters<T>(
  query: T,
  filters: ProspectCohortFilters,
): T {
  let filtered = query as T & {
    eq(column: string, value: string): T;
    neq(column: string, value: string): T;
  };

  if (filters.organizationId) {
    filtered = filtered.eq("organization_id", filters.organizationId) as typeof filtered;
  }
  if (filters.source) {
    filtered = filtered.eq("source", filters.source) as typeof filtered;
  }
  if (filters.excludeSource) {
    filtered = filtered.neq("source", filters.excludeSource) as typeof filtered;
  }
  return filtered as T;
}

/**
 * Adaptateur Supabase. Les deux snapshots lisent un count exact et la tête de
 * l'ordre total `synced_at DESC, id DESC`.
 */
export function createSupabaseProspectReader(
  client: SupabaseClient,
  filters: ProspectCohortFilters = {},
): ProspectCohortReader {
  return {
    async snapshot() {
      try {
        let query = client
          .from("prospects")
          .select("id, synced_at", { count: "exact" });
        query = applyProspectFilters(query, filters);
        const { data, count, error } = await query
          .order("synced_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1);

        if (error || count === null || data === null) {
          return { ok: false, error };
        }

        const first = data[0] as ProspectSnapshotHead | undefined;
        return {
          ok: true,
          count,
          head: first
            ? { id: first.id, synced_at: first.synced_at }
            : null,
        };
      } catch (error) {
        return { ok: false, error };
      }
    },

    async page(from, to) {
      try {
        let query = client
          .from("prospects")
          .select(
            "id, name, email, company, stage, source, last_contact_at, synced_at",
          );
        query = applyProspectFilters(query, filters);
        const { data, error } = await query
          .order("synced_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);

        if (error || data === null) return { ok: false, error };
        return { ok: true, rows: data as ProspectCohortRow[] };
      } catch (error) {
        return { ok: false, error };
      }
    },
  };
}

interface PageRange {
  from: number;
  to: number;
}

type InternalAttemptResult<T extends ProspectCohortRow> =
  | ProspectCohortResult<T>
  | {
      status: "inconsistent";
      importedCount: number;
    };

const sameHead = (
  left: ProspectSnapshotHead | null,
  right: ProspectSnapshotHead | null,
) =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.id === right.id &&
    left.synced_at === right.synced_at);

const validSnapshot = (
  snapshot: Extract<ProspectSnapshotResult, { ok: true }>,
) =>
  Number.isSafeInteger(snapshot.count) &&
  snapshot.count >= 0 &&
  (snapshot.count === 0
    ? snapshot.head === null
    : Boolean(snapshot.head?.id && snapshot.head.synced_at));

const descendingBySyncThenId = <T extends ProspectCohortRow>(
  left: T,
  right: T,
) => {
  if (left.synced_at !== right.synced_at) {
    return left.synced_at > right.synced_at ? -1 : 1;
  }
  if (left.id === right.id) return 0;
  return left.id > right.id ? -1 : 1;
};

const normalizedEmail = (value: string | null) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const canonicalGroupKey = (prospect: ProspectCohortRow): string | null => {
  const email = normalizedEmail(prospect.email);
  return email ? `e:${email}` : null;
};

const normalizedActiveStage = (stage: string) =>
  stage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

interface ValidContactDate {
  value: string;
  timestamp: number;
}

const validContactDate = (
  value: string | null | undefined,
): ValidContactDate | null => {
  const normalized = (value ?? "").trim();
  const timestamp = isoDateMs(normalized);
  return timestamp === null ? null : { value: normalized, timestamp };
};

interface CanonicalGroup<T extends ProspectCohortRow> {
  row: CanonicalProspectCohortRow<T>;
  terminalStage: string | null;
  activeStages: Map<string, string>;
  lastContact: ValidContactDate | null;
}

const addStageToGroup = <T extends ProspectCohortRow>(
  group: CanonicalGroup<T>,
  value: string | null,
) => {
  const stage = (value ?? "").trim();
  if (!stage) return;

  if (isTerminalStage(stage)) {
    // Les lignes arrivent dans un ordre total récent -> ancien : le premier
    // terminal est donc le libellé terminal le plus récent et déterministe.
    group.terminalStage ??= stage;
    return;
  }

  const key = normalizedActiveStage(stage);
  if (!group.activeStages.has(key)) group.activeStages.set(key, stage);
};

const addLastContactToGroup = <T extends ProspectCohortRow>(
  group: CanonicalGroup<T>,
  value: string | null | undefined,
) => {
  const candidate = validContactDate(value);
  if (
    candidate &&
    (!group.lastContact || candidate.timestamp > group.lastContact.timestamp)
  ) {
    group.lastContact = candidate;
    group.row.last_contact_at = candidate.value;
  }
};

/**
 * Canonicalisation métier, distincte de la déduplication d'affichage :
 *
 * - seules les adresses email non vides rapprochent plusieurs lignes ;
 * - chaque ligne sans email reste distincte, même à nom+entreprise identiques ;
 * - tout statut terminal/opposition d'un groupe l'emporte sur les statuts actifs ;
 * - plusieurs statuts actifs incompatibles donnent un statut `null`, donc aucune
 *   relance, avec un marqueur dérivé explicite utilisable pour le diagnostic ;
 * - seul le dernier contact valide le plus récent est conservé.
 *
 * L'ordre de sortie est celui de la première occurrence de chaque clé dans
 * l'entrée. Avec le tri total du loader, le résultat est donc déterministe.
 */
export function canonicalizeProspectCohort<T extends ProspectCohortRow>(
  rows: readonly T[],
): CanonicalProspectCohortRow<T>[] {
  const groups = new Map<string, CanonicalGroup<T>>();
  const ordered: CanonicalGroup<T>[] = [];

  for (const prospect of rows) {
    const key = canonicalGroupKey(prospect);
    const firstContact = validContactDate(prospect.last_contact_at);
    let group = key ? groups.get(key) : undefined;
    if (!group) {
      const canonical = {
        ...prospect,
        last_contact_at: firstContact?.value ?? null,
      } as CanonicalProspectCohortRow<T>;
      group = {
        row: canonical,
        terminalStage: null,
        activeStages: new Map(),
        lastContact: firstContact,
      };
      if (key) groups.set(key, group);
      ordered.push(group);
    } else {
      group.row.name ??= prospect.name;
      group.row.company ??= prospect.company;
      addLastContactToGroup(group, prospect.last_contact_at);
    }

    addStageToGroup(group, prospect.stage);
  }

  for (const group of ordered) {
    if (group.terminalStage) {
      group.row.stage = group.terminalStage;
      delete group.row.cohort_conflict;
    } else if (group.activeStages.size > 1) {
      group.row.stage = null;
      group.row.cohort_conflict = "active_stage_conflict";
    } else {
      group.row.stage = group.activeStages.values().next().value ?? null;
      delete group.row.cohort_conflict;
    }
  }

  return ordered.map(({ row }) => row);
}

async function readPagesBounded<T extends ProspectCohortRow>(
  reader: ProspectCohortReader<T>,
  ranges: PageRange[],
  maxConcurrentPages: number,
) {
  const results = new Array<ProspectPageResult<T>>(ranges.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < ranges.length) {
      const index = nextIndex;
      nextIndex += 1;
      const range = ranges[index];
      try {
        results[index] = await reader.page(range.from, range.to);
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(maxConcurrentPages, ranges.length) },
      () => worker(),
    ),
  );
  return results;
}

async function loadOnce<T extends ProspectCohortRow>(
  reader: ProspectCohortReader<T>,
  options: Required<LoadProspectCohortOptions>,
): Promise<InternalAttemptResult<T>> {
  let initial: ProspectSnapshotResult;
  try {
    initial = await reader.snapshot();
  } catch {
    initial = { ok: false };
  }
  if (!initial.ok || !validSnapshot(initial)) {
    return {
      status: "unavailable",
      reason: "count_failed",
      importedCount: null,
    };
  }

  if (initial.count > options.maxRows) {
    return {
      status: "partial",
      reason: "limit_exceeded",
      importedCount: initial.count,
      maxRows: options.maxRows,
    };
  }

  const ranges = Array.from(
    { length: Math.ceil(initial.count / options.pageSize) },
    (_, pageIndex) => {
      const from = pageIndex * options.pageSize;
      return {
        from,
        to: Math.min(from + options.pageSize - 1, initial.count - 1),
      };
    },
  );
  const pages = await readPagesBounded(
    reader,
    ranges,
    options.maxConcurrentPages,
  );
  if (pages.some((page) => !page?.ok)) {
    return {
      status: "unavailable",
      reason: "page_failed",
      importedCount: initial.count,
    };
  }

  const completePages = pages as Extract<
    ProspectPageResult<T>,
    { ok: true }
  >[];
  const pagesHaveExpectedLengths = completePages.every(
    (page, index) =>
      page.rows.length === ranges[index].to - ranges[index].from + 1,
  );
  const rows = completePages.flatMap((page) => page.rows);
  const ids = new Set(rows.map((row) => row.id));

  let verification: ProspectSnapshotResult;
  try {
    verification = await reader.snapshot();
  } catch {
    verification = { ok: false };
  }
  if (!verification.ok || !validSnapshot(verification)) {
    return {
      status: "unavailable",
      reason: "verification_failed",
      importedCount: initial.count,
    };
  }

  if (
    !pagesHaveExpectedLengths ||
    rows.length !== initial.count ||
    ids.size !== initial.count ||
    verification.count !== initial.count ||
    !sameHead(verification.head, initial.head)
  ) {
    return { status: "inconsistent", importedCount: initial.count };
  }

  const rawRows = [...rows].sort(descendingBySyncThenId);
  const dedupedRows = dedupeByEmail(rawRows);
  const canonicalRows = canonicalizeProspectCohort(rawRows);
  return {
    status: "complete",
    importedCount: initial.count,
    rawRows,
    dedupedRows,
    dedupedCount: dedupedRows.length,
    maskedCount: initial.count - dedupedRows.length,
    canonicalRows,
    canonicalCount: canonicalRows.length,
    canonicalMaskedCount: initial.count - canonicalRows.length,
  };
}

const positiveInteger = (value: number | undefined, fallback: number) =>
  Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : fallback;

/**
 * Charge une cohorte cohérente ou n'expose aucune ligne. Une incohérence de
 * pagination/snapshot déclenche exactement un nouveau passage complet.
 */
export async function loadProspectCohort<T extends ProspectCohortRow>(
  reader: ProspectCohortReader<T>,
  options: LoadProspectCohortOptions = {},
): Promise<ProspectCohortResult<T>> {
  const normalizedOptions: Required<LoadProspectCohortOptions> = {
    pageSize: positiveInteger(
      options.pageSize,
      DEFAULT_PROSPECT_PAGE_SIZE,
    ),
    maxRows:
      Number.isSafeInteger(options.maxRows) && (options.maxRows ?? -1) >= 0
        ? options.maxRows!
        : DEFAULT_PROSPECT_MAX_ROWS,
    maxConcurrentPages: positiveInteger(
      options.maxConcurrentPages,
      DEFAULT_PROSPECT_MAX_CONCURRENCY,
    ),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await loadOnce(reader, normalizedOptions);
    if (result.status !== "inconsistent") return result;
    if (attempt === 1) {
      return {
        status: "unavailable",
        reason: "concurrent_change",
        importedCount: result.importedCount,
      };
    }
  }

  // Le retour est couvert par la boucle, mais garde l'union totale pour TS.
  return {
    status: "unavailable",
    reason: "concurrent_change",
    importedCount: null,
  };
}
