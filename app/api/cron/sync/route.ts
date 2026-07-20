import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONNECTOR_SELECT,
  isSyncable,
  syncConnectorRow,
  type ConnectorRow,
} from "@/lib/connectors/sync";

/**
 * Sync quotidienne de tous les connecteurs configurés (toutes organisations).
 * Appelée par un scheduler externe avec `Authorization: Bearer CRON_SECRET`.
 * L'acteur est « agent » : l'activité apparaît comme telle dans le journal.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("connectors")
    .select(CONNECTOR_SELECT)
    .eq("status", "connected");

  const results: {
    provider: string;
    organization_id: string;
    count?: number;
    error?: string;
  }[] = [];

  for (const c of (data ?? []) as ConnectorRow[]) {
    if (!isSyncable(c)) continue;
    try {
      const count = await syncConnectorRow(admin, c, "agent", null);
      results.push({ provider: c.provider, organization_id: c.organization_id, count });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erreur inconnue";
      results.push({
        provider: c.provider,
        organization_id: c.organization_id,
        error: msg,
      });
      await admin.from("journal").insert({
        organization_id: c.organization_id,
        event: "connector_sync_failed",
        actor: "agent",
        actor_id: null,
        payload: { provider: c.provider, error: msg },
      });
    }
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
}
