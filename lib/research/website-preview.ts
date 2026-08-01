import type { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/lib/memory";
import {
  isProposalUseful,
  parseIdentityProposal,
  type IdentityProposal,
} from "@/lib/research/profile-rules";
import { runResearch } from "@/lib/research/research";
import type { ResearchSource } from "@/lib/research/research-rules";
import {
  buildWebsitePreviewQuery,
  validatePublicWebsite,
  websitePreviewCutoff,
} from "@/lib/research/website-preview-rules";

type Admin = ReturnType<typeof createAdminClient>;

export type WebsitePreviewResult =
  | {
      ok: true;
      url: string;
      hostname: string;
      proposal: IdentityProposal;
      sources: ResearchSource[];
      cached: boolean;
    }
  | { ok: false; reason: string };

/**
 * Analyse isolée : un seul appel externe, obligatoirement via `runResearch`.
 * Le fournisseur rend directement le JSON structuré ; aucune seconde synthèse
 * payante et aucune écriture dans la mémoire entreprise ne sont effectuées.
 */
export async function previewWebsite(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string;
    website: string;
    force?: boolean;
  },
): Promise<WebsitePreviewResult> {
  const website = validatePublicWebsite(args.website);
  if (!website.ok) return { ok: false, reason: website.reason };

  const research = await runResearch(admin, {
    orgId: args.orgId,
    actorId: args.actorId,
    kind: "website_preview",
    subject: website.url,
    query: buildWebsitePreviewQuery(website, {
      activityOptions: ACTIVITY_OPTIONS,
      audienceOptions: AUDIENCE_OPTIONS,
      channelOptions: CHANNEL_OPTIONS,
    }),
    force: args.force,
  });
  if (!research.ok) return research;

  const proposal = parseIdentityProposal(research.text, {
    activityOptions: ACTIVITY_OPTIONS,
    audienceOptions: AUDIENCE_OPTIONS,
    channelOptions: CHANNEL_OPTIONS,
  });
  if (!proposal || !isProposalUseful(proposal)) {
    return { ok: false, reason: "nothing_found" };
  }

  return {
    ok: true,
    url: website.url,
    hostname: website.hostname,
    proposal,
    sources: research.sources,
    cached: research.cached,
  };
}

export type WebsitePreviewPurgeResult =
  | { ok: true; deleted: number }
  | { ok: false; reason: "retention_unavailable" };

/** Purge service-role, appelée par le cron et avant toute nouvelle analyse. */
export async function purgeExpiredWebsitePreviews(
  admin: Admin,
): Promise<WebsitePreviewPurgeResult> {
  const { count, error } = await admin
    .from("research_runs")
    .delete({ count: "exact" })
    .eq("kind", "website_preview")
    .lt("created_at", websitePreviewCutoff());

  return error
    ? { ok: false, reason: "retention_unavailable" }
    : { ok: true, deleted: count ?? 0 };
}
