"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEditorContext } from "@/lib/connectors/common";
import { generateCreativeBrief } from "@/lib/creative";
import {
  CREATIVE_CHANNELS,
  type CreativeChannel,
} from "@/lib/creative-template";

export type BriefResult =
  | { ok: true; brief: string }
  | { ok: false; reason: "forbidden" | "empty" };

/**
 * Génère un brief créatif à partir d'un objectif et du canal visé. Contenu
 * uniquement — ne lance rien, ne dépense rien. Retour direct au workspace.
 */
export async function generateBriefAction(
  objectif: string,
  canal: string,
): Promise<BriefResult> {
  const ctx = await getEditorContext();
  if (!ctx) redirect("/login");
  if (!ctx.canEdit) return { ok: false, reason: "forbidden" };
  const obj = objectif.trim();
  if (!obj) return { ok: false, reason: "empty" };

  const channel: CreativeChannel = (CREATIVE_CHANNELS as readonly string[]).includes(
    canal,
  )
    ? (canal as CreativeChannel)
    : "indifferent";

  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("company_memory")
    .select("section, content")
    .eq("organization_id", ctx.orgId)
    .in("section", ["activite", "offres", "cibles", "ton", "objectifs"]);
  const memCtx = Object.fromEntries(
    (mem ?? []).map((m) => [m.section, m.content]),
  );

  const brief = await generateCreativeBrief({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    ctx: memCtx,
    objectif: obj,
    canal: channel,
  });

  await admin.from("journal").insert({
    organization_id: ctx.orgId,
    event: "creative_brief_generated",
    actor: "agent",
    actor_id: ctx.userId,
    payload: { objectif: obj, canal: channel },
  });

  return { ok: true, brief };
}
