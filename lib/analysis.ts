import { generateText } from "ai";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getModelForTask, telemetryForTask } from "@/lib/llm";
import { buildFindings, type RuleProspect } from "@/lib/analysis-rules";
import { withLlmTrace } from "@/lib/observability";
import { refreshBriefing } from "@/lib/briefing";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Moteur d'analyse v1 (Phase 2) — applique les règles sur les prospects
 * synchronisés, habille la raison via LLM (repli templates sans clé), puis
 * insère les propositions. Propose, n'exécute jamais. Retourne le nombre créé.
 */
export async function runAnalysis(
  admin: Admin,
  orgId: string,
  actorId: string | null,
): Promise<number> {
  const { data: prospects } = await admin
    .from("prospects")
    .select("email, stage, source, company, name")
    .eq("organization_id", orgId);

  // Briefing rafraîchi à chaque analyse (insight lecture seule), même si aucune
  // proposition ne se déclenche ensuite.
  await refreshBriefing(admin, orgId, actorId);

  const findings = buildFindings((prospects ?? []) as RuleProspect[]);
  if (findings.length === 0) return 0;

  // Dédupe : ne pas reproposer un kind déjà en file
  const { data: existing } = await admin
    .from("actions")
    .select("kind")
    .eq("organization_id", orgId)
    .eq("status", "proposed");
  const existingKinds = new Set((existing ?? []).map((a) => a.kind));
  const fresh = findings.filter((f) => !existingKinds.has(f.kind));
  if (fresh.length === 0) return 0;

  // Habillage LLM (ton + objectifs de la mémoire) — repli silencieux sur les templates
  try {
    const { data: mem } = await admin
      .from("company_memory")
      .select("section, content")
      .eq("organization_id", orgId)
      .in("section", ["activite", "ton", "objectifs"]);
    const ctx = Object.fromEntries(
      (mem ?? []).map((m) => [m.section, m.content]),
    );
    // Traces groupées par organisation (sessionId = org) pour le multi-tenant.
    await withLlmTrace(
      { orgId, userId: actorId, task: "recommend_action" },
      async () => {
        for (const f of fresh) {
          const { text } = await generateText({
            model: getModelForTask("recommend_action"),
            // Marge suffisante : sur les modèles à raisonnement (gpt-5, o-series),
            // les reasoning tokens sont décomptés du budget de sortie ; un budget
            // trop bas renvoie un texte vide et fait retomber sur les templates.
            maxOutputTokens: 500,
            telemetry: telemetryForTask("recommend_action"),
            prompt: `Tu es l'agent marketing de cette entreprise: ${JSON.stringify(ctx)}. Constat: ${f.finding} Réécris en 1 à 2 phrases simples, en français, sans jargon, la raison pour laquelle cette action vaut la peine. Réponds uniquement par ce texte.`,
          });
          if (text.trim().length > 20) f.rationale = text.trim();
        }
      },
    );
  } catch (e) {
    // pas de clé ou erreur API : les templates suffisent (repli silencieux).
    // Trace en dev pour distinguer « pas de clé » d'une vraie erreur API.
    console.warn(
      "[analysis] habillage LLM ignoré, repli sur templates:",
      e instanceof Error ? e.message : e,
    );
  }

  const { error } = await admin.from("actions").insert(
    fresh.map((f) => ({
      organization_id: orgId,
      kind: f.kind,
      title: f.title,
      finding: f.finding,
      rationale: f.rationale,
      data_sources: f.data_sources,
      expected_impact: f.expected_impact,
      confidence: f.confidence,
      risk: f.risk,
      status: "proposed",
      payload: f.payload,
    })),
  );
  if (error) throw new Error(error.message);

  for (const f of fresh) {
    await admin.from("journal").insert({
      organization_id: orgId,
      event: "action_proposed",
      actor: "agent",
      actor_id: actorId,
      payload: { kind: f.kind, title: f.title },
    });
  }
  return fresh.length;
}
