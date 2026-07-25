"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

/** Session + organisation de l'utilisateur (admin par construction ici). */
async function requireMembership() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  return { userId: user.id, orgId: membership.organization_id as string };
}

const urlSchema = z.string().trim().min(3).max(300);

/** Lance la recherche. Retour direct (pas de redirect) : appelé depuis le client. */
export async function proposeIdentity(website: string): Promise<ProposeResult> {
  const { userId, orgId } = await requireMembership();
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
  const { userId, orgId } = await requireMembership();
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

  redirect("/");
}

/** « Passer cette étape » — aucune écriture, on entre simplement dans le cockpit. */
export async function skipIdentity() {
  await requireMembership();
  redirect("/");
}
