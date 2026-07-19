"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  EDIT_ROLES,
  MAX_OBJECTIVES,
  OBJECTIVE_OPTIONS,
  type MemorySection,
  type Offer,
} from "@/lib/memory";

function fail(message: string): never {
  redirect(`/entreprise?error=${encodeURIComponent(message)}`);
}

/** Garde-fou serveur : session + rôle éditeur, jamais l'UI seule. */
async function requireEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  if (!EDIT_ROLES.includes(membership.role)) {
    fail("Votre rôle ne permet pas de modifier la mémoire de l'entreprise.");
  }
  return { userId: user.id, orgId: membership.organization_id as string };
}

/** Upsert d'une section + entrée journal, puis retour à la page. */
async function persist(
  orgId: string,
  userId: string,
  section: MemorySection,
  content: Record<string, unknown>,
): Promise<never> {
  const admin = createAdminClient();
  const { error } = await admin.from("company_memory").upsert(
    {
      organization_id: orgId,
      section,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,section" },
  );
  if (error) fail("Enregistrement impossible. Réessayez dans un instant.");

  await admin.from("journal").insert({
    organization_id: orgId,
    event: "memory_updated",
    actor: "user",
    actor_id: userId,
    payload: { section },
  });

  redirect(`/entreprise?saved=${section}`);
}

async function readOffers(orgId: string): Promise<Offer[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("company_memory")
    .select("content")
    .eq("organization_id", orgId)
    .eq("section", "offres")
    .maybeSingle();
  const items = (data?.content as { items?: Offer[] } | null)?.items;
  return Array.isArray(items) ? items : [];
}

// ===== Identité & activité =====

const activiteSchema = z.object({
  activity_type: z.enum(ACTIVITY_OPTIONS),
  audience: z.enum(AUDIENCE_OPTIONS),
  description: z.string().trim().max(1000),
});

export async function saveActivite(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const parsed = activiteSchema.safeParse({
    activity_type: formData.get("activity_type"),
    audience: formData.get("audience"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) fail("Choisissez une activité et une clientèle.");
  await persist(orgId, userId, "activite", parsed.data);
}

const zoneSchema = z.object({ text: z.string().trim().min(2).max(200) });

export async function saveZone(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const parsed = zoneSchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) fail("Indiquez votre zone (2 à 200 caractères).");
  await persist(orgId, userId, "zone", parsed.data);
}

export async function saveCanaux(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const list = formData.getAll("channels").map(String);
  if (list.some((c) => !(CHANNEL_OPTIONS as readonly string[]).includes(c))) {
    fail("Canal inconnu.");
  }
  await persist(orgId, userId, "canaux", { list });
}

const tonSchema = z.object({ text: z.string().trim().min(2).max(500) });

export async function saveTon(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const parsed = tonSchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) fail("Décrivez le ton en 2 à 500 caractères.");
  await persist(orgId, userId, "ton", parsed.data);
}

export async function saveObjectifs(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const list = formData.getAll("objectives").map(String);
  if (list.some((o) => !(OBJECTIVE_OPTIONS as readonly string[]).includes(o))) {
    fail("Objectif inconnu.");
  }
  if (list.length > MAX_OBJECTIVES) {
    fail("Deux objectifs maximum — l'agent doit rester concentré.");
  }
  await persist(orgId, userId, "objectifs", { list });
}

// ===== Offres =====

const offerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.string().trim().max(200),
  target: z.string().trim().max(200),
  promise: z.string().trim().max(200),
});

export async function saveOffer(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const parsed = offerSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price") ?? "",
    target: formData.get("target") ?? "",
    promise: formData.get("promise") ?? "",
  });
  if (!parsed.success) {
    fail("Le nom de l'offre est requis (2 à 80 caractères).");
  }

  const items = await readOffers(orgId);
  const rawIndex = String(formData.get("index") ?? "new");
  if (rawIndex === "new") {
    items.push(parsed.data);
  } else {
    const i = Number(rawIndex);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) fail("Offre introuvable.");
    items[i] = parsed.data;
  }
  await persist(orgId, userId, "offres", { items });
}

export async function deleteOffer(formData: FormData) {
  const { userId, orgId } = await requireEditor();
  const items = await readOffers(orgId);
  const i = Number(String(formData.get("index")));
  if (!Number.isInteger(i) || i < 0 || i >= items.length) fail("Offre introuvable.");
  items.splice(i, 1);
  await persist(orgId, userId, "offres", { items });
}
