import { generateText } from "ai";
import { getModelForTask, telemetryForTask } from "@/lib/llm";
import { withLlmTrace } from "@/lib/observability";
import { memoText } from "@/lib/draft-template";
import {
  templateCreativeBrief,
  CHANNEL_LABELS,
  type CreativeChannel,
} from "@/lib/creative-template";

/**
 * Conseil créatif (Phase 4 — contenu) : l'agent propose un brief créatif
 * agnostique du canal, ancré sur le produit et le secteur (bonnes pratiques
 * générales, pas de veille temps réel — cf. backlog enrichissement internet).
 * Tâche LLM `campaign_brief`, repli déterministe. Ne lance rien, ne dépense rien.
 */
export async function generateCreativeBrief(args: {
  orgId: string;
  actorId: string | null;
  ctx: Record<string, unknown>;
  objectif: string;
  canal: CreativeChannel;
}): Promise<string> {
  const activite = memoText(args.ctx, "activite");
  const offre = memoText(args.ctx, "offres") || activite;
  const cibles = memoText(args.ctx, "cibles");
  const ton = memoText(args.ctx, "ton");

  const fallback = templateCreativeBrief({
    objectif: args.objectif,
    canal: args.canal,
    activite,
    offre,
    cibles,
    ton,
  });

  try {
    const text = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "campaign_brief" },
      async () => {
        const res = await generateText({
          model: getModelForTask("campaign_brief"),
          maxOutputTokens: 700,
          telemetry: telemetryForTask("campaign_brief"),
          prompt:
            `Tu es directeur créatif pour cette entreprise.\n` +
            `Activité / secteur : ${activite || "non précisé"}.\n` +
            `Produit / offre à mettre en avant : ${offre || "non précisé"}.\n` +
            `Cible : ${cibles || "non précisée"}.\n` +
            `Ton de marque : ${ton || "clair, chaleureux, direct"}.\n` +
            `Objectif de la campagne : ${args.objectif}.\n` +
            `Canal visé : ${CHANNEL_LABELS[args.canal]}.\n\n` +
            `Rédige un BRIEF CRÉATIF en français, agnostique du canal (utilisable ` +
            `pour une pub, une newsletter ou un post), structuré ainsi :\n` +
            `- Objectif et produit mis en avant\n` +
            `- 2 à 3 angles créatifs qui valorisent le produit\n` +
            `- Ce qui marche généralement dans ce secteur (bonnes pratiques ` +
            `générales — précise que ce n'est pas une veille temps réel)\n` +
            `- 2 à 3 accroches possibles\n` +
            `- Le message clé et l'appel à l'action\n` +
            `Termine par : « Prêt à transmettre à un créateur ou à une IA de ` +
            `génération. » Réponds uniquement par ce brief.`,
        });
        return res.text.trim();
      },
    );
    return text.length > 80 ? text : fallback;
  } catch {
    return fallback;
  }
}
