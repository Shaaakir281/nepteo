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
import {
  isFresh,
  subjectKey,
  type ResearchSource,
} from "@/lib/research/research-rules";
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

function parseUsefulProposal(raw: unknown): IdentityProposal | null {
  const proposal = parseIdentityProposal(raw, {
    activityOptions: ACTIVITY_OPTIONS,
    audienceOptions: AUDIENCE_OPTIONS,
    channelOptions: CHANNEL_OPTIONS,
  });
  return proposal && isProposalUseful(proposal) ? proposal : null;
}

/**
 * Une ancienne réponse OpenAI tronquée pouvait être marquée `ok` par la couche
 * réseau, puis échouer au parseur produit. Elle ne doit pas rester en cache 30
 * jours : on la marque en échec avant l'unique appel explicitement confirmé.
 */
async function invalidateUnusableCachedPreview(
  admin: Admin,
  orgId: string,
  website: string,
): Promise<boolean> {
  const key = subjectKey(website);
  if (!key) return true;

  const { data: cached, error } = await admin
    .from("research_runs")
    .select("answer, status, created_at")
    .eq("organization_id", orgId)
    .eq("kind", "website_preview")
    .eq("subject_key", key)
    .maybeSingle();
  if (error) return false;
  if (
    !cached ||
    cached.status !== "ok" ||
    !cached.answer ||
    !isFresh(cached.created_at as string) ||
    parseUsefulProposal(cached.answer)
  ) {
    return true;
  }

  const { error: invalidationError } = await admin
    .from("research_runs")
    .update({ status: "failed" })
    .eq("organization_id", orgId)
    .eq("kind", "website_preview")
    .eq("subject_key", key)
    .eq("status", "ok");
  return !invalidationError;
}

async function markPreviewUnusable(
  admin: Admin,
  orgId: string,
  website: string,
): Promise<void> {
  const key = subjectKey(website);
  if (!key) return;
  await admin
    .from("research_runs")
    .update({ status: "failed" })
    .eq("organization_id", orgId)
    .eq("kind", "website_preview")
    .eq("subject_key", key);
}

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

  if (
    !(await invalidateUnusableCachedPreview(
      admin,
      args.orgId,
      website.url,
    ))
  ) {
    return { ok: false, reason: "cache_unavailable" };
  }

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

  const proposal = parseUsefulProposal(research.text);
  if (!proposal) {
    await markPreviewUnusable(admin, args.orgId, website.url);
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
