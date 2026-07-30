import {
  buildDemoCampaigns,
  buildDemoProspects,
  buildDemoRevenue,
} from "@/lib/demo/demo-rules";
import {
  DEMO_SCENARIOS,
  findScenario,
  type DemoScenario,
} from "@/lib/demo/scenarios";
import {
  backupMemoryOnce,
  restoreLegacyOrganizationName,
  restoreMemory,
} from "@/lib/demo/memory-backup";
import { ensureOk, type Admin } from "@/lib/demo/db";
import {
  DEMO_CAMPAIGN_PREFIX,
  DEMO_PROVIDER,
  DEMO_REVENUE_PREFIX,
  demoCampaignId,
  demoRevenueId,
  isDemoAction,
} from "@/lib/demo/isolation-rules";
import {
  assertDemoLoadIsSafe,
  readDemoModeMarkers,
} from "@/lib/demo/isolation";

/**
 * Charge un scénario de démo complet : identité, prospects, campagnes, ventes.
 * Tout est fictif, cohérent entre les quatre, et **idempotent** — recharger le
 * même scénario ne duplique rien ; charger un autre scénario remplace la base
 * de démo précédente (les données issues de vrais connecteurs ne sont jamais
 * touchées : on n'écrit que sous le connecteur `demo`).
 *
 * **La vraie fiche entreprise est sauvegardée avant d'être écrasée** (B1) : le
 * scénario n'est qu'un emprunt, `clearDemoData` rend ce qu'il a pris.
 */

export interface DemoLoadResult {
  scenario: string;
  prospects: number;
  campaignRows: number;
  sales: number;
}

/** Provider réservé aux données de démo — jamais un vrai connecteur. Exporté
 *  pour que l'UI puisse l'exclure des comptages "connecteur réel branché". */
export { DEMO_PROVIDER } from "@/lib/demo/isolation-rules";

const LEGACY_CAMPAIGN_IDS = DEMO_SCENARIOS.flatMap((scenario) =>
  scenario.campaigns.map((campaign) => campaign.id),
);
const LEGACY_REVENUE_PATTERNS = DEMO_SCENARIOS.map(
  (scenario) => `${scenario.id}-sale-%`,
);

/**
 * Remet le cockpit à zéro entre deux scénarios : propositions, briefing et
 * messages préparés.
 *
 * Indispensable pour enchaîner les cas — sans ça, on garderait les propositions
 * de la menuiserie en regardant l'e-commerce, ce qui n'a aucun sens et donne
 * l'impression que l'agent délire.
 */
async function resetCockpitState(
  admin: Admin,
  orgId: string,
  legacy: boolean,
): Promise<void> {
  const { data: rows, error: readError } = await admin
    .from("actions")
    .select("id, payload, data_sources")
    .eq("organization_id", orgId);
  ensureOk(readError, "lecture des propositions de démonstration");

  const actionIds = (rows ?? [])
    .filter((row) => isDemoAction(row))
    .map((row) => row.id as string);
  if (actionIds.length > 0) {
    const outbox = await admin
      .from("outbox_messages")
      .delete()
      .eq("organization_id", orgId)
      .in("action_id", actionIds);
    ensureOk(outbox.error, "envois préparés de démonstration");

    const actions = await admin
      .from("actions")
      .delete()
      .eq("organization_id", orgId)
      .in("id", actionIds);
    ensureOk(actions.error, "propositions de démonstration");
  }

  const { data: briefing, error: briefingError } = await admin
    .from("briefings")
    .select("stats")
    .eq("organization_id", orgId)
    .maybeSingle();
  ensureOk(briefingError, "lecture du briefing de démonstration");
  const stats =
    briefing?.stats &&
    typeof briefing.stats === "object" &&
    !Array.isArray(briefing.stats)
      ? (briefing.stats as Record<string, unknown>)
      : {};
  if (briefing && (stats.demo === true || legacy)) {
    const deleted = await admin
      .from("briefings")
      .delete()
      .eq("organization_id", orgId);
    ensureOk(deleted.error, "briefing de démonstration");
  }
}

async function deleteDemoCampaigns(
  admin: Admin,
  orgId: string,
  legacy: boolean,
): Promise<void> {
  const namespaced = await admin
    .from("ad_metrics")
    .delete()
    .eq("organization_id", orgId)
    .eq("provider", "meta_ads")
    .like("campaign_id", `${DEMO_CAMPAIGN_PREFIX}%`);
  ensureOk(namespaced.error, "campagnes de démonstration");

  if (legacy) {
    const oldRows = await admin
      .from("ad_metrics")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", "meta_ads")
      .in("campaign_id", LEGACY_CAMPAIGN_IDS);
    ensureOk(oldRows.error, "anciennes campagnes de démonstration");
  }
}

async function deleteDemoRevenue(
  admin: Admin,
  orgId: string,
  legacy: boolean,
): Promise<void> {
  const namespaced = await admin
    .from("revenue_events")
    .delete()
    .eq("organization_id", orgId)
    .eq("source", "stripe")
    .like("external_id", `${DEMO_REVENUE_PREFIX}%`);
  ensureOk(namespaced.error, "ventes de démonstration");

  if (legacy) {
    for (const pattern of LEGACY_REVENUE_PATTERNS) {
      const oldRows = await admin
        .from("revenue_events")
        .delete()
        .eq("organization_id", orgId)
        .eq("source", "stripe")
        .like("external_id", pattern);
      ensureOk(oldRows.error, "anciennes ventes de démonstration");
    }
  }
}

/**
 * Tous les connecteurs du provider `demo`, du plus ancien au plus récent.
 *
 * Pas de `.maybeSingle()` ici : cette recherche n'est pas unique par nature.
 * `connectors` porte bien `unique (organization_id, provider)` aujourd'hui —
 * mais un `.maybeSingle()` renverrait `null` si la contrainte sautait un jour,
 * et le code se mettrait alors à ne rien supprimer tout en insérant un
 * connecteur de plus à chaque tentative. Silencieusement.
 */
async function demoConnectorIds(admin: Admin, orgId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("connectors")
    .select("id")
    .eq("organization_id", orgId)
    .eq("provider", DEMO_PROVIDER)
    .order("created_at", { ascending: true });
  ensureOk(error, "connecteurs de démonstration");
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

/** Supprime les prospects portés par les connecteurs de démo donnés. */
async function deleteDemoProspects(admin: Admin, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await admin.from("prospects").delete().in("connector_id", ids);
  ensureOk(error, "prospects de démonstration");
}

/**
 * Prépare le connecteur porteur des prospects de démo : vide la base de démo
 * précédente (tous connecteurs confondus), ne garde qu'un connecteur, en crée
 * un s'il n'y en a pas.
 */
async function prepareDemoConnector(admin: Admin, orgId: string): Promise<string> {
  const ids = await demoConnectorIds(admin, orgId);
  // Changer de scénario remplace la base de démo, sans toucher aux vraies données.
  await deleteDemoProspects(admin, ids);

  if (ids.length > 1) {
    const extra = ids.slice(1);
    const { error } = await admin.from("connectors").delete().in("id", extra);
    ensureOk(error, "connecteurs de démonstration en double");
  }
  if (ids.length > 0) return ids[0];

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
    { section: "presence", content: { list: m.presence } },
  ];

  const now = new Date().toISOString();
  const { error: memError } = await admin.from("company_memory").upsert(
    sections.map((s) => ({
      organization_id: orgId,
      section: s.section,
      content: s.content,
      updated_at: now,
    })),
    { onConflict: "organization_id,section" },
  );
  ensureOk(memError, "identité du scénario");

  const { error: orgError } = await admin
    .from("organizations")
    .update({ name: scenario.orgName, activity: m.description.slice(0, 300) })
    .eq("id", orgId);
  ensureOk(orgError, "nom de l'entreprise fictive");

  const journal = await admin.from("journal").insert({
    organization_id: orgId,
    event: "memory_updated",
    actor: "user",
    actor_id: userId,
    payload: { section: "demo", scenario: scenario.id },
  });
  ensureOk(journal.error, "journal de l'identité de démonstration");
}

export async function loadDemoScenario(
  admin: Admin,
  args: { orgId: string; actorId: string | null; scenarioId: string },
): Promise<DemoLoadResult> {
  const scenario = findScenario(args.scenarioId);
  if (!scenario) throw new Error("Scénario inconnu.");
  const { orgId, actorId } = args;

  const isolation = await assertDemoLoadIsSafe(admin, orgId);
  // Avant toute suppression : la vraie fiche est mise à l'abri. Le préflight
  // a déjà refusé une organisation portant un état opérationnel réel.
  await backupMemoryOnce(admin, orgId);
  // On repart d'un cockpit propre : les propositions du scénario précédent
  // parleraient de campagnes et de prospects qui n'existent plus.
  await resetCockpitState(admin, orgId, isolation.legacy);
  await seedMemory(admin, orgId, actorId, scenario);

  // --- Prospects (sous le connecteur de démo) ---
  const connectorId = await prepareDemoConnector(admin, orgId);

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
      last_contact_at: p.last_contact_at,
      source: DEMO_PROVIDER,
      raw: { demo: true, scenario: scenario.id },
      synced_at: now,
    })),
    { onConflict: "connector_id,external_id" },
  );
  if (pErr) throw new Error(pErr.message);

  // --- Campagnes ---
  await deleteDemoCampaigns(admin, orgId, isolation.legacy);
  const campaignRows = buildDemoCampaigns(scenario.campaigns);
  const { error: cErr } = await admin.from("ad_metrics").upsert(
    campaignRows.map((r) => ({
      organization_id: orgId,
      provider: "meta_ads",
      campaign_id: demoCampaignId(r.campaign_id),
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
  await deleteDemoRevenue(admin, orgId, isolation.legacy);
  const sales = buildDemoRevenue(scenario.products, scenario.id);
  const { error: rErr } = await admin.from("revenue_events").upsert(
    sales.map((s) => ({
      organization_id: orgId,
      source: "stripe",
      external_id: demoRevenueId(s.external_id),
      label: s.label,
      amount: s.amount,
      occurred_on: s.occurred_on,
      synced_at: now,
    })),
    { onConflict: "organization_id,source,external_id" },
  );
  if (rErr) throw new Error(rErr.message);

  const journal = await admin.from("journal").insert({
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
  ensureOk(journal.error, "journal du chargement de démonstration");

  return {
    scenario: scenario.id,
    prospects: prospects.length,
    campaignRows: campaignRows.length,
    sales: sales.length,
  };
}

/**
 * Retire toutes les données de démo (prospects, campagnes, ventes) **et rend la
 * fiche entreprise d'origine**, sauvegardée au premier chargement de scénario.
 *
 * Lève si une suppression échoue : un retrait partiel annoncé comme réussi
 * laisserait l'utilisateur avec des données fictives et aucun moyen de le
 * savoir.
 */
export async function clearDemoData(
  admin: Admin,
  args: { orgId: string; actorId: string | null },
): Promise<void> {
  const markers = await readDemoModeMarkers(admin, args.orgId);
  if (!markers.active) return;

  const ids = await demoConnectorIds(admin, args.orgId);
  await deleteDemoProspects(admin, ids);
  if (ids.length > 0) {
    const { error } = await admin.from("connectors").delete().in("id", ids);
    ensureOk(error, "connecteurs de démonstration");
  }

  await deleteDemoCampaigns(admin, args.orgId, markers.legacy);
  await deleteDemoRevenue(admin, args.orgId, markers.legacy);

  await resetCockpitState(admin, args.orgId, markers.legacy);
  const restored = await restoreMemory(admin, args.orgId);
  const legacyNameRestored = restored
    ? false
    : await restoreLegacyOrganizationName(admin, args.orgId);

  const journal = await admin.from("journal").insert({
    organization_id: args.orgId,
    event: "demo_scenario_cleared",
    actor: "user",
    actor_id: args.actorId,
    payload: { restored, legacy_name_restored: legacyNameRestored },
  });
  ensureOk(journal.error, "journal du retrait de démonstration");
}
