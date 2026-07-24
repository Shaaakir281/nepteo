import type { createAdminClient } from "@/lib/supabase/admin";
import { mockRevenueEvents } from "@/lib/revenue/mock-provider";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Charge des ventes de démo (fictives) dans `revenue_events`, upsert idempotent
 * (org+source+external_id). Sert à développer/démontrer la boucle revenu sans
 * compte Stripe. L'API réelle écrira les mêmes lignes.
 */
export async function seedRevenueDemo(
  admin: Admin,
  orgId: string,
  actorId: string | null,
): Promise<number> {
  const now = new Date().toISOString();
  const rows = mockRevenueEvents().map((s) => ({
    organization_id: orgId,
    source: s.source,
    external_id: s.external_id,
    label: s.label,
    amount: s.amount,
    occurred_on: s.occurred_on,
    synced_at: now,
  }));

  const { error } = await admin
    .from("revenue_events")
    .upsert(rows, { onConflict: "organization_id,source,external_id" });
  if (error) throw new Error(error.message);

  await admin.from("journal").insert({
    organization_id: orgId,
    event: "revenue_demo_loaded",
    actor: "user",
    actor_id: actorId,
    payload: { source: "stripe", rows: rows.length },
  });
  return rows.length;
}
