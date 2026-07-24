import { generateText } from "ai";
import { getModelForTask, telemetryForTask } from "@/lib/llm";
import { withLlmTrace } from "@/lib/observability";
import { memoText } from "@/lib/draft-template";
import {
  objectiveLabel,
  channelLabel,
  type CampaignBrief,
} from "@/lib/campaign-plan";

/**
 * Variantes de message pour une nouvelle campagne (Phase 4). L'agent rédige 2
 * accroches à tester l'une contre l'autre, ancrées sur le produit et l'objectif.
 * Tâche LLM `draft_post`, repli déterministe. Ne lance rien.
 */

function templateVariants(brief: CampaignBrief, offre: string): [string, string] {
  const o = offre || "notre offre";
  return [
    `Une PME a gagné du temps grâce à ${o}. Voici comment — et ce que ça peut changer pour vous.`,
    `Vous savez que ${o} peut vous aider. La vraie question : par où commencer ? On s'en occupe.`,
  ];
}

export async function generateCampaignVariants(args: {
  orgId: string;
  actorId: string | null;
  ctx: Record<string, unknown>;
  brief: CampaignBrief;
}): Promise<string[]> {
  const activite = memoText(args.ctx, "activite");
  const offre = memoText(args.ctx, "offres") || activite;
  const ton = memoText(args.ctx, "ton");
  const fallback = templateVariants(args.brief, offre);

  try {
    const variants = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "draft_post" },
      async () => {
        const { text } = await generateText({
          model: getModelForTask("draft_post"),
          maxOutputTokens: 400,
          telemetry: telemetryForTask("draft_post"),
          prompt:
            `Rédige exactement 2 accroches de campagne, à tester l'une contre l'autre.\n` +
            `Objectif : ${objectiveLabel(args.brief.objectif)}.\n` +
            `Canal : ${channelLabel(args.brief.canal)}.\n` +
            `Produit / offre : ${offre || "non précisé"}.\n` +
            `Ton : ${ton || "concret, sans jargon"}.\n` +
            `Contexte : ${args.brief.contexte || "aucun"}.\n\n` +
            `Chaque accroche : 1 à 2 phrases, en français, orientée bénéfice. ` +
            `Réponds STRICTEMENT deux lignes, préfixées « A: » et « B: ».`,
        });
        const lines = text
          .split("\n")
          .map((l) => l.replace(/^\s*[AB]\s*[:.\-]\s*/i, "").trim())
          .filter((l) => l.length > 10);
        return lines.length >= 2 ? [lines[0], lines[1]] : null;
      },
    );
    return variants ?? fallback;
  } catch {
    return fallback;
  }
}
