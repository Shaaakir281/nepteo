"use server";

import { getEditorContext } from "@/lib/auth/context";
import { researchConfigured } from "@/lib/research/provider";
import { readResearchQuota } from "@/lib/research/research";
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
