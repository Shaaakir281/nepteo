import { DEMO_PROVIDER } from "@/lib/demo/isolation-rules";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type RelaunchProspectRow = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
  source: string;
  notes: string | null;
  note_internal: string | null;
  last_contact_at: string | null;
  synced_at: string;
};

export type RelaunchProspectLoadResult =
  | { ok: true; prospects: RelaunchProspectRow[] }
  | { ok: false; reason: "read_failed" | "base_too_large" };

const PROSPECT_PAGE_SIZE = 1_000;
export const MAX_RELAUNCH_PROSPECT_SCAN = 20_000;

/**
 * Lecture commune aux trois moments du play : proposition, approbation et
 * préparation. L'ordre de synchronisation récent → ancien rend la
 * canonicalisation déterministe ; la règle métier trie ensuite les dormants
 * ancien → récent. Une base au-delà de la
 * borne échoue fermée plutôt que de présenter une cohorte partielle.
 */
export async function loadRelaunchProspects(
  admin: Admin,
  organizationId: string,
  demo: boolean,
): Promise<RelaunchProspectLoadResult> {
  const prospects: RelaunchProspectRow[] = [];

  for (
    let offset = 0;
    offset < MAX_RELAUNCH_PROSPECT_SCAN;
    offset += PROSPECT_PAGE_SIZE
  ) {
    let query = admin
      .from("prospects")
      .select(
        "id, name, email, company, stage, source, notes, note_internal, last_contact_at, synced_at",
      )
      .eq("organization_id", organizationId)
      .order("synced_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PROSPECT_PAGE_SIZE - 1);

    query = demo
      ? query.eq("source", DEMO_PROVIDER)
      : query.neq("source", DEMO_PROVIDER);

    const { data, error } = await query;
    if (error || !data) return { ok: false, reason: "read_failed" };
    prospects.push(...(data as RelaunchProspectRow[]));
    if (data.length < PROSPECT_PAGE_SIZE) {
      return { ok: true, prospects };
    }
  }

  let sentinel = admin
    .from("prospects")
    .select("id")
    .eq("organization_id", organizationId)
    .order("synced_at", { ascending: false })
    .order("id", { ascending: false })
    .range(
      MAX_RELAUNCH_PROSPECT_SCAN,
      MAX_RELAUNCH_PROSPECT_SCAN,
    );
  sentinel = demo
    ? sentinel.eq("source", DEMO_PROVIDER)
    : sentinel.neq("source", DEMO_PROVIDER);
  const { data: overflow, error: overflowError } = await sentinel;
  if (overflowError || !overflow) return { ok: false, reason: "read_failed" };
  return overflow.length === 0
    ? { ok: true, prospects }
    : { ok: false, reason: "base_too_large" };
}
