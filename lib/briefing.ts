import { generateText } from "ai";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getModelForTask, telemetryForTask } from "@/lib/llm";
import { withLlmTrace } from "@/lib/observability";
import {
  computeFunnelStats,
  type BriefingProspect,
  type FunnelStats,
} from "@/lib/analysis-rules";
import { templateBriefing } from "@/lib/briefing-stats";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Briefing hebdomadaire en langage naturel (Phase 2 — insight, lecture seule).
 * L'agent résume l'état du funnel comme un directeur marketing, ancré sur des
 * chiffres réels. Habillage LLM (tâche `weekly_report`) avec repli déterministe.
 */

/** Génère le texte du briefing : LLM ancré sur les stats, repli sur le gabarit. */
async function narrateBriefing(
  orgId: string,
  actorId: string | null,
  stats: FunnelStats,
  memCtx: Record<string, unknown>,
): Promise<string> {
  const fallback = templateBriefing(stats);
  if (stats.total === 0) return fallback;

  try {
    const text = await withLlmTrace(
      { orgId, userId: actorId, task: "weekly_report" },
      async () => {
        const res = await generateText({
          model: getModelForTask("weekly_report"),
          maxOutputTokens: 400,
          telemetry: telemetryForTask("weekly_report"),
          prompt:
            `Tu es le directeur marketing de cette entreprise : ${JSON.stringify(memCtx)}.\n` +
            `Voici les chiffres réels de son funnel : ${JSON.stringify(stats)}.\n\n` +
            `Rédige un briefing de 2 à 3 phrases, en français, ton direct et concret, ` +
            `sans jargon ni chiffre inventé (n'utilise que ceux fournis). ` +
            `Dis l'état du funnel et la priorité de la semaine. Réponds uniquement par ce texte.`,
        });
        return res.text.trim();
      },
    );
    return text.length > 30 ? text : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Rafraîchit le briefing courant d'une organisation (upsert, un par org).
 * Lit les prospects, calcule les stats, habille, enregistre. Ne lève pas :
 * un briefing raté ne doit pas casser l'analyse qui l'appelle.
 */
export async function refreshBriefing(
  admin: Admin,
  orgId: string,
  actorId: string | null,
): Promise<void> {
  try {
    const { data: prospects } = await admin
      .from("prospects")
      .select("email, stage, company")
      .eq("organization_id", orgId);
    const stats = computeFunnelStats((prospects ?? []) as BriefingProspect[]);

    const { data: mem } = await admin
      .from("company_memory")
      .select("section, content")
      .eq("organization_id", orgId)
      .in("section", ["activite", "ton", "objectifs"]);
    const memCtx = Object.fromEntries(
      (mem ?? []).map((m) => [m.section, m.content]),
    );

    const content = await narrateBriefing(orgId, actorId, stats, memCtx);

    await admin.from("briefings").upsert(
      {
        organization_id: orgId,
        content,
        stats,
        created_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
  } catch (e) {
    console.warn(
      "[briefing] rafraîchissement ignoré :",
      e instanceof Error ? e.message : e,
    );
  }
}
