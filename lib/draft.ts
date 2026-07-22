import { generateText } from "ai";
import { getModelForTask, telemetryForTask } from "@/lib/llm";
import { withLlmTrace } from "@/lib/observability";
import {
  memoText,
  parseDraft,
  renderProspectContext,
  templateRelance,
  type Draft,
  type ProspectContext,
} from "@/lib/draft-template";

/**
 * Rédaction de brouillons de relance (Phase 2) — l'agent PRÉPARE un message
 * prêt à envoyer, il ne l'envoie jamais (l'envoi réel = Phase 3, avec garde-fous).
 * Habillage LLM via la tâche `draft_email`, repli sur un gabarit déterministe
 * (lib/draft-template) sans clé API. Le brouillon porte un placeholder {prénom}
 * remplacé à l'envoi.
 */

export type { Draft } from "@/lib/draft-template";
export { isRelanceKind } from "@/lib/draft-template";

/**
 * Brouillon de relance habillé par le LLM, ancré sur la mémoire entreprise et
 * le statut visé. Repli silencieux sur `templateRelance` sans clé ou en cas
 * d'erreur/format inattendu. Traces groupées par org (withLlmTrace).
 */
export async function draftRelance(args: {
  orgId: string;
  actorId: string | null;
  ctx: Record<string, unknown>;
  stage?: string | null;
}): Promise<Draft> {
  const activite = memoText(args.ctx, "activite") || memoText(args.ctx, "offres");
  const ton = memoText(args.ctx, "ton");
  const fallback = templateRelance({ stage: args.stage, activite });

  try {
    const draft = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "draft_email" },
      async () => {
        const { text } = await generateText({
          model: getModelForTask("draft_email"),
          maxOutputTokens: 500,
          telemetry: telemetryForTask("draft_email"),
          prompt:
            `Tu rédiges un email de relance commerciale pour cette entreprise.\n` +
            `Activité : ${activite || "non précisée"}.\n` +
            `Ton souhaité : ${ton || "professionnel, chaleureux, direct"}.\n` +
            `Statut du prospect : ${(args.stage ?? "").trim() || "non précisé"}.\n\n` +
            `Écris un email court (5 à 8 lignes), en français, sans jargon, qui invite à un échange. ` +
            `Utilise exactement le placeholder {prénom} pour le prénom du destinataire. ` +
            `Réponds STRICTEMENT dans ce format :\n` +
            `Objet: <objet en une ligne>\n\n<corps de l'email>`,
        });
        return parseDraft(text);
      },
    );
    return draft ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Brouillon personnalisé pour UN prospect : s'appuie sur ses notes personnelles
 * et toutes ses colonnes, en plus de la mémoire entreprise. Repli sur le gabarit
 * si pas de clé/erreur. Reste Phase 2 : prépare, n'envoie pas. Le `{prénom}` est
 * conservé (remplacé à l'envoi, Phase 3).
 */
export async function draftRelanceForProspect(args: {
  orgId: string;
  actorId: string | null;
  ctx: Record<string, unknown>;
  prospect: ProspectContext;
}): Promise<Draft> {
  const activite = memoText(args.ctx, "activite") || memoText(args.ctx, "offres");
  const ton = memoText(args.ctx, "ton");
  const stage = args.prospect.stage ?? null;
  const fallback = templateRelance({ stage, activite });
  const context = renderProspectContext(args.prospect);

  try {
    const draft = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "draft_email" },
      async () => {
        const { text } = await generateText({
          model: getModelForTask("draft_email"),
          maxOutputTokens: 500,
          telemetry: telemetryForTask("draft_email"),
          prompt:
            `Tu rédiges un email de relance commerciale personnalisé pour cette entreprise.\n` +
            `Activité : ${activite || "non précisée"}.\n` +
            `Ton souhaité : ${ton || "professionnel, chaleureux, direct"}.\n\n` +
            `Informations sur ce prospect :\n${context || "aucune"}\n\n` +
            `Appuie-toi sur ces informations (surtout les notes personnelles) pour ` +
            `personnaliser le message, sans les recopier telles quelles. ` +
            `Écris un email court (5 à 8 lignes), en français, sans jargon, qui invite à un échange. ` +
            `Utilise exactement le placeholder {prénom} pour le prénom du destinataire. ` +
            `Réponds STRICTEMENT dans ce format :\n` +
            `Objet: <objet en une ligne>\n\n<corps de l'email>`,
        });
        return parseDraft(text);
      },
    );
    return draft ?? fallback;
  } catch {
    return fallback;
  }
}
