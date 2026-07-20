import { generateText } from "ai";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getModelForTask } from "@/lib/llm";

type Admin = ReturnType<typeof createAdminClient>;

interface Finding {
  kind: string;
  title: string;
  finding: string; // constat
  rationale: string; // raison (peut être réécrite par le LLM)
  data_sources: string[];
  expected_impact: string;
  confidence: number;
  risk: "low" | "medium" | "high";
  payload: Record<string, unknown>;
}

/**
 * Moteur d'analyse v1 (Phase 2) — règles simples sur les prospects synchronisés.
 * Propose, n'exécute jamais. Habillage LLM optionnel (repli templates sans clé).
 */
export async function runAnalysis(
  admin: Admin,
  orgId: string,
  actorId: string | null,
): Promise<number> {
  const { data: prospects } = await admin
    .from("prospects")
    .select("email, stage, source")
    .eq("organization_id", orgId);
  const all = prospects ?? [];

  const findings: Finding[] = [];
  const sources = [...new Set(all.map((p) => p.source))].join(", ");

  if (all.length > 0) {
    // Règle 1 — emails manquants (qualité de données)
    const noEmail = all.filter((p) => !p.email).length;
    if (noEmail > 0) {
      findings.push({
        kind: "complete_missing_emails",
        title: `Compléter ${noEmail} email${noEmail > 1 ? "s" : ""} manquant${noEmail > 1 ? "s" : ""}`,
        finding: `${noEmail} prospect${noEmail > 1 ? "s" : ""} sur ${all.length} n'ont pas d'adresse email.`,
        rationale:
          "Sans email, aucune relance n'est possible — c'est la première fuite du funnel à colmater.",
        data_sources: [`prospects (${sources})`],
        expected_impact: `${noEmail} prospect${noEmail > 1 ? "s" : ""} de plus joignable${noEmail > 1 ? "s" : ""} pour les relances`,
        confidence: 0.9,
        risk: "low",
        payload: { count: noEmail, total: all.length },
      });
    }

    // Règle 2 — plus gros groupe par statut → relance ciblée
    const byStage = new Map<string, number>();
    for (const p of all) {
      const s = (p.stage ?? "").trim();
      if (s) byStage.set(s, (byStage.get(s) ?? 0) + 1);
    }
    const top = [...byStage.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      const [stage, count] = top;
      findings.push({
        kind: `relaunch_stage_${stage.toLowerCase().replace(/\W+/g, "_")}`,
        title: `Préparer la relance des ${count} prospects « ${stage} »`,
        finding: `${count} prospects sur ${all.length} sont au statut « ${stage} » — le groupe le plus important de votre base.`,
        rationale:
          "Concentrer l'effort sur le groupe le plus fourni maximise le retour d'une seule action de relance.",
        data_sources: [`prospects (${sources})`],
        expected_impact: `${count} prospects recontactés en une action`,
        confidence: 0.7,
        risk: "low",
        payload: { stage, count },
      });
    }
  }

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
    for (const f of fresh) {
      const { text } = await generateText({
        model: getModelForTask("recommend_action"),
        maxOutputTokens: 160,
        prompt: `Tu es l'agent marketing de cette entreprise: ${JSON.stringify(ctx)}. Constat: ${f.finding} Réécris en 1 à 2 phrases simples, en français, sans jargon, la raison pour laquelle cette action vaut la peine. Réponds uniquement par ce texte.`,
      });
      if (text.trim().length > 20) f.rationale = text.trim();
    }
  } catch {
    // pas de clé ou erreur API : les templates suffisent
  }

  const now = new Date().toISOString();
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
