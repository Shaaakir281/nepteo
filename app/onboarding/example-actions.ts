"use server";

import { redirect } from "next/navigation";
import { demoAnalysisDetail } from "@/lib/demo/analysis-outcome";
import { DemoIsolationError } from "@/lib/demo/isolation";
import { loadAndAnalyzeDemoScenario } from "@/lib/demo/load-scenario";
import { DemoBusyError } from "@/lib/demo/lock";
import { findScenario } from "@/lib/demo/scenarios";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type StartExampleResult =
  | { ok: true; scenarioId: string; created: number }
  | {
      ok: false;
      reason:
        | "unknown_scenario"
        | "already_configured"
        | "creation_failed"
        | "unsafe_existing_data"
        | "busy"
        | "load_failed";
      detail?: string;
      organizationCreated?: boolean;
    };

async function removeUnconfiguredOrganization(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
): Promise<void> {
  await admin
    .from("memberships")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  await admin.from("organizations").delete().eq("id", orgId);
}

/**
 * Le clic sur une carte est l'intention explicite de choisir ET lancer ce
 * scénario. L'organisation vide est créée, journalisée, puis le chargement
 * passe par la même frontière protégée que le panneau Connecteurs.
 */
export async function startExampleScenario(
  scenarioId: string,
): Promise<StartExampleResult> {
  const scenario = findScenario(scenarioId);
  if (!scenario) return { ok: false, reason: "unknown_scenario" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("organization_id", { ascending: true })
    .limit(2);
  if (membershipError) return { ok: false, reason: "creation_failed" };
  // Une ligne suffit pour fermer le parcours. En cas d'ancienne anomalie avec
  // plusieurs memberships, on ne choisit jamais une organisation au hasard.
  if ((memberships ?? []).length > 0) {
    return { ok: false, reason: "already_configured" };
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: "Espace découverte Nepteo", activity: null })
    .select("id")
    .single();
  if (orgError || !org) return { ok: false, reason: "creation_failed" };

  const { error: memberError } = await admin.from("memberships").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "admin",
  });
  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id);
    return {
      ok: false,
      reason:
        memberError.code === "23505"
          ? "already_configured"
          : "creation_failed",
    };
  }

  const { error: journalError } = await admin.from("journal").insert({
    organization_id: org.id,
    event: "organization_created",
    actor: "user",
    actor_id: user.id,
    payload: {
      name: "Espace découverte Nepteo",
      onboarding_path: "example",
      scenario_intent: scenario.id,
    },
  });
  if (journalError) {
    await removeUnconfiguredOrganization(admin, org.id, user.id);
    return {
      ok: false,
      reason: "creation_failed",
      detail: journalError.message,
    };
  }

  try {
    const result = await loadAndAnalyzeDemoScenario(admin, {
      orgId: org.id,
      actorId: user.id,
      scenarioId: scenario.id,
    });
    return { ok: true, scenarioId: scenario.id, created: result.created };
  } catch (error) {
    const detail = demoAnalysisDetail(error);
    if (error instanceof DemoIsolationError) {
      return {
        ok: false,
        reason: "unsafe_existing_data",
        detail,
        organizationCreated: true,
      };
    }
    if (error instanceof DemoBusyError) {
      return {
        ok: false,
        reason: "busy",
        detail,
        organizationCreated: true,
      };
    }
    return {
      ok: false,
      reason: "load_failed",
      detail,
      organizationCreated: true,
    };
  }
}
