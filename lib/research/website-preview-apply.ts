import type { createAdminClient } from "@/lib/supabase/admin";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";
import { isFresh, subjectKey } from "@/lib/research/research-rules";
import type {
  WebsitePreviewApplicationSections,
  WebsitePreviewMemorySection,
} from "@/lib/research/website-preview-apply-rules";
import { validatePublicWebsite } from "@/lib/research/website-preview-rules";

type Admin = ReturnType<typeof createAdminClient>;

export type ApplyWebsitePreviewResult =
  | { ok: true; applied: number; sections: WebsitePreviewMemorySection[] }
  | { ok: false; reason: string };

function readApplicationResult(
  value: unknown,
): { applied: number; sections: WebsitePreviewMemorySection[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Number.isInteger(raw.applied) || (raw.applied as number) < 1) return null;
  const applied = raw.applied as number;
  if (!Array.isArray(raw.sections)) return null;
  const allowed = new Set<WebsitePreviewMemorySection>([
    "activite",
    "zone",
    "ton",
    "canaux",
    "offres",
    "presence",
  ]);
  const sections = raw.sections.filter(
    (section): section is WebsitePreviewMemorySection =>
      typeof section === "string" &&
      allowed.has(section as WebsitePreviewMemorySection),
  );
  return sections.length === applied ? { applied, sections } : null;
}

/**
 * Applique une prévisualisation déjà payée, sans nouvel appel externe.
 * La RPC écrit toutes les sections et leurs journaux dans une seule transaction.
 */
export async function applyWebsitePreview(
  admin: Admin,
  args: {
    orgId: string;
    actorId: string;
    website: string;
    sections: WebsitePreviewApplicationSections;
  },
): Promise<ApplyWebsitePreviewResult> {
  const website = validatePublicWebsite(args.website);
  if (!website.ok) return { ok: false, reason: website.reason };
  const key = subjectKey(website.url);
  if (!key) return { ok: false, reason: "invalid_url" };

  const { data: preview, error: previewError } = await admin
    .from("research_runs")
    .select("status, created_at")
    .eq("organization_id", args.orgId)
    .eq("kind", "website_preview")
    .eq("subject_key", key)
    .maybeSingle();
  if (previewError) return { ok: false, reason: "application_unavailable" };
  if (
    !preview ||
    preview.status !== "ok" ||
    typeof preview.created_at !== "string" ||
    !isFresh(preview.created_at)
  ) {
    return { ok: false, reason: "preview_unavailable" };
  }

  try {
    return await withRealDataMutationLock(admin, args.orgId, async () => {
      const { data, error } = await admin.rpc("apply_website_preview_sections", {
        p_organization_id: args.orgId,
        p_actor_id: args.actorId,
        p_subject_key: key,
        p_sections: args.sections,
      });
      if (error) {
        const reason = error.message.includes("fresh website preview not found")
          ? "preview_unavailable"
          : error.code === "42501"
            ? "forbidden"
            : error.code === "22023" || error.code === "55000"
              ? "application_unavailable"
              : "application_ambiguous";
        return { ok: false as const, reason };
      }
      const applied = readApplicationResult(data);
      return applied
        ? { ok: true as const, ...applied }
        : { ok: false as const, reason: "application_ambiguous" };
    });
  } catch (error) {
    if (error instanceof DemoDataMutationBlockedError) {
      return { ok: false, reason: "scenario_active" };
    }
    if (error instanceof DemoBusyError) {
      return { ok: false, reason: "application_busy" };
    }
    return { ok: false, reason: "application_ambiguous" };
  }
}
