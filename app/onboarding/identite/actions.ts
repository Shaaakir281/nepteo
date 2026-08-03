"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { isDemoModeOrMutationActive } from "@/lib/demo/isolation";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  type MemorySection,
  type Offer,
} from "@/lib/memory";
import { proposeIdentityForOrg } from "@/lib/research/company-profile";
import type { IdentityProposal } from "@/lib/research/profile-rules";
import type { ResearchSource } from "@/lib/research/research-rules";

/**
 * Onboarding, 2e écran (facultatif) : l'agent lit le site de l'entreprise et
 * PROPOSE une identité. L'utilisateur corrige, puis valide — c'est seulement à
 * ce moment que la mémoire est écrite. Rien n'est jamais enregistré à son insu.
 */

export type ProposeResult =
  | {
      ok: true;
      proposal: IdentityProposal;
      sources: ResearchSource[];
      cached: boolean;
    }
  | { ok: false; reason: string };

/** Session + organisation avec droit d'édition, vérifié côté serveur. */
async function requireEditorMembership() {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canEdit) redirect("/");
  if (
    await isDemoModeOrMutationActive(
      createAdminClient(),
      membership.organizationId,
    )
  ) {
    redirect(
      "/entreprise?onglet=connecteurs&error=Retirez%20d'abord%20la%20d%C3%A9monstration.",
    );
  }
  return { userId: user.id, orgId: membership.organizationId };
}

const urlSchema = z.string().trim().min(3).max(300);

/** Lance la recherche. Retour direct (pas de redirect) : appelé depuis le client. */
export async function proposeIdentity(website: string): Promise<ProposeResult> {
  const { userId, orgId } = await requireEditorMembership();
  const parsed = urlSchema.safeParse(website);
  if (!parsed.success) return { ok: false, reason: "invalid_url" };

  const result = await proposeIdentityForOrg(createAdminClient(), {
    orgId,
    actorId: userId,
    website: parsed.data,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    proposal: result.proposal,
    sources: result.sources,
    cached: result.cached,
  };
}

function readOffers(raw: FormDataEntryValue | null): Offer[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (o): o is Offer =>
          Boolean(o) &&
          typeof o === "object" &&
          typeof (o as Offer).name === "string" &&
          (o as Offer).name.trim().length > 0,
      )
      .slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * Enregistre l'identité VALIDÉE par l'utilisateur, section par section.
 * Une section vide n'est pas écrite : on ne remplace jamais du contenu existant
 * par du vide (le champ « philosophie » saisi à l'écran précédent est intact).
 */
export async function applyIdentity(formData: FormData) {
  const { userId, orgId } = await requireEditorMembership();
  const admin = createAdminClient();

  const text = (key: string, max: number): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  };

  const activityType = text("activity_type", 60);
  const audience = text("audience", 60);
  const description = text("description", 1000);
  const zone = text("zone", 200);
  const ton = text("ton", 500);
  const canaux = formData
    .getAll("canaux")
    .map(String)
    .filter((c) => (CHANNEL_OPTIONS as readonly string[]).includes(c));
  const offres = readOffers(formData.get("offres"));
  // Constats de communication publique gardés par l'utilisateur (il décoche
  // ce qui est faux) — bornés, texte libre venu de la recherche.
  const presence = formData
    .getAll("presence")
    .map((v) => String(v).trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 6);

  const sections: { section: MemorySection; content: Record<string, unknown> }[] = [];

  // L'activité n'est écrite que si les deux choix sont des options valides
  // (mêmes règles que le formulaire de /entreprise — pas de valeur bâtarde).
  if (
    (ACTIVITY_OPTIONS as readonly string[]).includes(activityType) &&
    (AUDIENCE_OPTIONS as readonly string[]).includes(audience)
  ) {
    sections.push({
      section: "activite",
      content: { activity_type: activityType, audience, description },
    });
  }
  if (zone) sections.push({ section: "zone", content: { text: zone } });
  if (ton) sections.push({ section: "ton", content: { text: ton } });
  if (canaux.length > 0) sections.push({ section: "canaux", content: { list: canaux } });
  if (offres.length > 0) sections.push({ section: "offres", content: { items: offres } });
  if (presence.length > 0) sections.push({ section: "presence", content: { list: presence } });

  try {
    await withRealDataMutationLock(admin, orgId, async () => {
      for (const { section, content } of sections) {
        const { error } = await admin.from("company_memory").upsert(
          {
            organization_id: orgId,
            section,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,section" },
        );
        if (error) continue; // une section ratée ne doit pas bloquer les autres
        await admin.from("journal").insert({
          organization_id: orgId,
          event: "memory_updated",
          actor: "user",
          actor_id: userId,
          payload: { section, source: "onboarding_web" },
        });
      }
    });
  } catch (error) {
    const message =
      error instanceof DemoDataMutationBlockedError
        ? "Retirez d'abord le scénario Nepteo avant de modifier la mémoire."
        : error instanceof DemoBusyError
          ? "Une autre opération est en cours. Réessayez dans un instant."
          : "Enregistrement impossible. Réessayez dans un instant.";
    redirect(`/entreprise?error=${encodeURIComponent(message)}`);
  }

  redirect("/prise-en-main?depart=real");
}

/** « Passer cette étape » — aucune écriture, on entre simplement dans le cockpit. */
export async function skipIdentity() {
  await requireEditorMembership();
  redirect("/prise-en-main?depart=real");
}
