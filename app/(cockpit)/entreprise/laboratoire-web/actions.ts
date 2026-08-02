"use server";

import { getEditorContext } from "@/lib/auth/context";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/lib/memory";
import { researchConfigured } from "@/lib/research/provider";
import { readResearchQuota } from "@/lib/research/research";
import { applyWebsitePreview } from "@/lib/research/website-preview-apply";
import { parseWebsitePreviewApplicationSections } from "@/lib/research/website-preview-apply-rules";
import {
  previewWebsite,
  purgeExpiredWebsitePreviews,
} from "@/lib/research/website-preview";
import { validatePublicWebsite } from "@/lib/research/website-preview-rules";
import { createAdminClient } from "@/lib/supabase/admin";

/** Action explicite : aucune analyse ne part sans confirmation côté client ET serveur. */
export async function runWebsitePreviewAction(input: {
  website: string;
  confirmed: boolean;
  force?: boolean;
  forceConfirmed?: boolean;
}) {
  const context = await getEditorContext();
  if (!context?.canEdit) return { ok: false as const, reason: "forbidden" };
  if (input.confirmed !== true) {
    return { ok: false as const, reason: "confirmation_required" };
  }
  if (input.force && input.forceConfirmed !== true) {
    return { ok: false as const, reason: "force_confirmation_required" };
  }

  const website = validatePublicWebsite(input.website);
  if (!website.ok) return { ok: false as const, reason: website.reason };
  if (!researchConfigured()) return { ok: false as const, reason: "no_key" };

  const admin = createAdminClient();
  const quotaBefore = await readResearchQuota(admin, context.orgId);
  if (!quotaBefore) {
    return { ok: false as const, reason: "quota_unavailable" };
  }

  // La rétention est une condition de l'appel : échec de purge = aucun coût.
  const purge = await purgeExpiredWebsitePreviews(admin);
  if (!purge.ok) {
    return {
      ok: false as const,
      reason: purge.reason,
      quota: quotaBefore,
    };
  }

  const result = await previewWebsite(admin, {
    orgId: context.orgId,
    actorId: context.userId,
    website: website.url,
    force: Boolean(input.force),
  });
  const quotaAfter = (await readResearchQuota(admin, context.orgId)) ?? quotaBefore;
  return { ...result, quota: quotaAfter };
}

/**
 * Action distincte et gratuite : seules les sections relues sont appliquées.
 * Le service verrouille la mémoire réelle et la RPC assure l'atomicité.
 */
export async function applyWebsitePreviewAction(input: {
  website: string;
  confirmed: boolean;
  sections: unknown;
}) {
  const context = await getEditorContext();
  if (!context?.canEdit) return { ok: false as const, reason: "forbidden" };
  if (input.confirmed !== true) {
    return { ok: false as const, reason: "application_confirmation_required" };
  }

  const parsed = parseWebsitePreviewApplicationSections(input.sections, {
    activityOptions: ACTIVITY_OPTIONS,
    audienceOptions: AUDIENCE_OPTIONS,
    channelOptions: CHANNEL_OPTIONS,
  });
  if (!parsed.ok) return { ok: false as const, reason: parsed.reason };

  return applyWebsitePreview(createAdminClient(), {
    orgId: context.orgId,
    actorId: context.userId,
    website: input.website,
    sections: parsed.sections,
  });
}
