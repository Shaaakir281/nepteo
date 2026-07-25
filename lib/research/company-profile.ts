import { generateText } from "ai";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getModelForTask, telemetryForTask } from "@/lib/llm";
import { withLlmTrace } from "@/lib/observability";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/lib/memory";
import { runResearch } from "@/lib/research/research";
import { buildCompanyQuery, cleanWebsite } from "@/lib/research/research-rules";
import type { ResearchSource } from "@/lib/research/research-rules";
import {
  isProposalUseful,
  parseIdentityProposal,
  type IdentityProposal,
} from "@/lib/research/profile-rules";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Onboarding enrichi — étape « ingestion de la page web ».
 * L'agent cherche l'entreprise sur le web (Perplexity), puis structure ce qu'il
 * a trouvé en une PROPOSITION d'identité, calée sur les options de la mémoire.
 *
 * Rien n'est écrit dans `company_memory` ici : le solopreneur valide ou corrige.
 * Sans clé Perplexity, sans résultat ou en cas d'erreur, on renvoie proprement
 * `{ ok: false }` — l'onboarding manuel reste intact (aucune régression).
 */

export type CompanyProfileResult =
  | {
      ok: true;
      proposal: IdentityProposal;
      sources: ResearchSource[];
      cached: boolean;
    }
  | { ok: false; reason: string };

const PROMPT_SCHEMA = `{
  "activity_type": "une valeur EXACTE parmi: __ACTIVITY__",
  "audience": "une valeur EXACTE parmi: __AUDIENCE__",
  "description": "ce que vend l'entreprise, 2 à 3 phrases, à la 1re personne du pluriel",
  "zone": "zone géographique servie, une ligne",
  "ton": "ton de communication observé, une ligne (ex: professionnel, direct, sans jargon)",
  "canaux": ["valeurs EXACTES parmi: __CHANNELS__"],
  "offres": [{ "name": "...", "price": "...", "target": "...", "promise": "..." }],
  "gaps": ["ce que la recherche n'a PAS permis d'établir"]
}`;

export async function researchCompanyProfile(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string | null;
    name: string;
    website?: string | null;
    activity?: string | null;
    force?: boolean;
  },
): Promise<CompanyProfileResult> {
  const site = cleanWebsite(args.website);
  // Le site prime comme sujet de cache : deux entreprises peuvent partager un nom.
  const subject = site || args.name;

  const research = await runResearch(admin, {
    orgId: args.orgId,
    actorId: args.actorId,
    kind: "company_profile",
    subject,
    query: buildCompanyQuery({
      name: args.name,
      website: site,
      activity: args.activity,
    }),
    force: args.force,
  });
  if (!research.ok) return { ok: false, reason: research.reason };

  const schema = PROMPT_SCHEMA.replace("__ACTIVITY__", ACTIVITY_OPTIONS.join(" | "))
    .replace("__AUDIENCE__", AUDIENCE_OPTIONS.join(" | "))
    .replace("__CHANNELS__", CHANNEL_OPTIONS.join(" | "));

  let proposal: IdentityProposal | null = null;
  try {
    proposal = await withLlmTrace(
      { orgId: args.orgId, userId: args.actorId, task: "identity_synthesis" },
      async () => {
        const { text } = await generateText({
          model: getModelForTask("identity_synthesis"),
          maxOutputTokens: 900,
          telemetry: telemetryForTask("identity_synthesis"),
          prompt:
            `Voici le résultat d'une recherche web sur l'entreprise « ${args.name} » :\n\n` +
            `${research.text}\n\n` +
            `Structure ces informations en JSON, en français, selon EXACTEMENT ce schéma :\n` +
            `${schema}\n\n` +
            `Règles impératives :\n` +
            `- N'invente RIEN. Toute information absente de la recherche est omise ` +
            `du JSON et listée dans "gaps".\n` +
            `- Pour "activity_type", "audience" et "canaux", recopie les valeurs ` +
            `proposées à l'identique ; si aucune ne convient, omets le champ.\n` +
            `- Réponds uniquement par le JSON, sans commentaire.`,
        });
        return parseIdentityProposal(text, {
          activityOptions: ACTIVITY_OPTIONS,
          audienceOptions: AUDIENCE_OPTIONS,
          channelOptions: CHANNEL_OPTIONS,
        });
      },
    );
  } catch {
    return { ok: false, reason: "synthesis_failed" };
  }

  if (!isProposalUseful(proposal) || !proposal) {
    return { ok: false, reason: "nothing_found" };
  }

  await admin.from("journal").insert({
    organization_id: args.orgId,
    event: "identity_proposed",
    actor: "agent",
    actor_id: args.actorId,
    payload: {
      subject,
      fields: Object.keys(proposal).filter((k) => k !== "gaps"),
      sources: research.sources.length,
    },
  });

  return {
    ok: true,
    proposal,
    sources: research.sources,
    cached: research.cached,
  };
}

/**
 * Variante « je connais juste l'organisation » : lit son nom et son activité
 * déclarée, puis délègue. Utilisée par l'onboarding et par la vue Entreprise —
 * une seule implémentation, deux points d'entrée.
 */
export async function proposeIdentityForOrg(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string | null;
    website: string;
    force?: boolean;
  },
): Promise<CompanyProfileResult> {
  const { data: org } = await admin
    .from("organizations")
    .select("name, activity")
    .eq("id", args.orgId)
    .maybeSingle();
  if (!org?.name) return { ok: false, reason: "not_found" };

  return researchCompanyProfile(admin, {
    orgId: args.orgId,
    actorId: args.actorId,
    name: org.name as string,
    website: args.website,
    activity: (org.activity as string | null) ?? null,
    force: args.force,
  });
}
