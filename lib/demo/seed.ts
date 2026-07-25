import type { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDemoCampaigns,
  buildDemoProspects,
  buildDemoRevenue,
} from "@/lib/demo/demo-rules";
import { findScenario, type DemoScenario } from "@/lib/demo/scenarios";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Charge un scénario de démo complet : identité, prospects, campagnes, ventes.
 * Tout est fictif, cohérent entre les quatre, et **idempotent** — recharger le
 * même scénario ne duplique rien ; charger un autre scénario remplace la base
 * de démo précédente (les données issues de vrais connecteurs ne sont jamais
 * touchées : on n'écrit que sous le connecteur `demo`).
 */

export interface DemoLoadResult {
  scenario: string;
  prospects: number;
  campaignRows: number;
  sales: number;
}

const DEMO_PROVIDER = "demo";

/** Connecteur porteur des prospects de démo (les prospects exigent un connecteur). */
async function ensureDemoConnector(admin: Admin, orgId: string): Promise<string> {
  const { data: existing } = await admin
    .from("connectors")
    .select("id")
    .eq("organization_id", orgId)
    .eq("provider", DEMO_PROVIDER)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await admin
    .from("connectors")
    .insert({
      organization_id: orgId,
      type: "crm",
      provider: DEMO_PROVIDER,
      status: "connected",
      config: { demo: true },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "connecteur de démo");
  return data.id as string;
}

async function seedMemory(
  admin: Admin,
  orgId: string,
  userId: string | null,
  scenario: DemoScenario,
): Promise<void> {
  const m = scenario.memory;
  const sections: { section: string; content: Record<string, unknown> }[] = [
    {
      section: "activite",
      content: {
        activity_type: m.activity_type,
        audience: m.audience,
        description: m.description,
      },
    },
    { section: "zone", content: { text: m.zone } },
    { section: "canaux", content: { list: m.canaux } },
    { section: "ton", content: { text: m.ton } },
    { section: "objectifs", content: { list: m.objectifs } },
    { section: "offres", content: { items: m.offres } },
    { section: "philosophie", content: { text: m.philosophie } },
  ];

  const now = new Date().toISOString();
  await admin.from("company_memory").upsert(
    sections.map((s) => ({
      organization_id: orgId,
      section: s.section,
      content: s.content,
      updated_at: now,
    })),
    { onConflict: "organization_id,section" },
  );

  await admin
    .from("organizations")
    .update({ name: scenario.orgName, activity: m.description.slice(0, 300) })
    .eq("id", orgId);

  await admin.from("journal").insert({
    organization_id: orgId,
    event: "memory_updated",
    actor: "user",
    actor_id: userId,
    payload: { section: "demo", scenario: scenario.id },
  });
}

export async function loadDemoScenario(
  admin: Admin,
  args: { orgId: string; actorId: string | null; scenarioId: string },
): Promise<DemoLoadResult> {
  const scenario = findScenario(args.scenarioId);
  if (!scenario) throw new Error("Scénario inconnu.");
  const { orgId, actorId } = args;

  await seedMemory(admin, orgId, actorId, scenario);

  // --- Prospects (sous le connecteur de démo) ---
  const connectorId = await ensureDemoConnector(admin, orgId);
  // Changer de scénario remplace la base de démo, sans toucher aux vraies données.
  await admin.from("prospects").delete().eq("connector_id", connectorId);

  const now = new Date().toISOString();
  const prospects = buildDemoProspects(scenario.pool, scenario.id);
  const { error: pErr } = await admin.from("prospects").upsert(
    prospects.map((p) => ({
      organization_id: orgId,
      connector_id: connectorId,
      external_id: p.external_id,
      name: p.name,
      email: p.email,
      company: p.company,
      stage: p.stage || null,
      notes: p.notes,
      source: DEMO_PROVIDER,
      raw: { demo: true, scenario: scenario.id },
      synced_at: now,
    })),
    { onConflict: "connector_id,external_id" },
  );
  if (pErr) throw new Error(pErr.message);

  // --- Campagnes ---
  await admin
    .from("ad_metrics")
    .delete()
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads");
  const campaignRows = buildDemoCampaigns(scenario.campaigns);
  const { error: cErr } = await admin.from("ad_metrics").upsert(
    campaignRows.map((r) => ({
      organization_id: orgId,
      provider: "meta_ads",
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      date: r.date,
      impressions: r.impressions,
      clicks: r.clicks,
      spend: r.spend,
      conversions: r.conversions,
      revenue: r.revenue,
      synced_at: now,
    })),
    { onConflict: "organization_id,provider,campaign_id,date" },
  );
  if (cErr) throw new Error(cErr.message);

  // --- Ventes ---
  await admin
    .from("revenue_events")
    .delete()
    .eq("organization_id", orgId)
    .eq("source", "stripe");
  const sales = buildDemoRevenue(scenario.products, scenario.id);
  const { error: rErr } = await admin.from("revenue_events").upsert(
    sales.map((s) => ({
      organization_id: orgId,
      source: "stripe",
      external_id: s.external_id,
      label: s.label,
      amount: s.amount,
      occurred_on: s.occurred_on,
      synced_at: now,
    })),
    { onConflict: "organization_id,source,external_id" },
  );
  if (rErr) throw new Error(rErr.message);

  await admin.from("journal").insert({
    organization_id: orgId,
    event: "demo_scenario_loaded",
    actor: "user",
    actor_id: actorId,
    payload: {
      scenario: scenario.id,
      name: scenario.orgName,
      prospects: prospects.length,
      campaigns: scenario.campaigns.length,
      sales: sales.length,
    },
  });

  return {
    scenario: scenario.id,
    prospects: prospects.length,
    campaignRows: campaignRows.length,
    sales: sales.length,
  };
}

/**
 * Retire toutes les données de démo (prospects, campagnes, ventes) sans toucher
 * à la mémoire : on peut repartir d'un cockpit vide pour montrer l'état initial.
 */
export async function clearDemoData(
  admin: Admin,
  args: { orgId: string; actorId: string | null },
): Promise<void> {
  const { data: connector } = await admin
    .from("connectors")
    .select("id")
    .eq("organization_id", args.orgId)
    .eq("provider", DEMO_PROVIDER)
    .maybeSingle();
  if (connector?.id) {
    await admin.from("prospects").delete().eq("connector_id", connector.id);
  }
  await admin
    .from("ad_metrics")
    .delete()
    .eq("organization_id", args.orgId)
    .eq("provider", "meta_ads");
  await admin
    .from("revenue_events")
    .delete()
    .eq("organization_id", args.orgId)
    .eq("source", "stripe");
  await admin.from("actions").delete().eq("organization_id", args.orgId).eq("status", "proposed");

  await admin.from("journal").insert({
    organization_id: args.orgId,
    event: "demo_scenario_cleared",
    actor: "user",
    actor_id: args.actorId,
    payload: {},
  });
}
