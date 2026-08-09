import { NextResponse } from "next/server";
import { z } from "zod";
import { getEditorContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getEditorContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!ctx.canManageCampaigns) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  const parsed = ParamsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Version invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    return await withRealDataMutationLock(admin, ctx.orgId, async () => {
  const { data: asset, error: assetError } = await admin
    .from("creative_assets")
    .select("id, action_id")
    .eq("id", parsed.data.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (assetError || !asset?.action_id) {
    return NextResponse.json({ error: "Version introuvable" }, { status: 404 });
  }

  const { data, error } = await admin.rpc("select_creative_asset", {
    p_organization_id: ctx.orgId,
    p_action_id: asset.action_id,
    p_creative_id: asset.id,
    p_actor_id: ctx.userId,
  });
  const selected =
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>).selected === true;
  const status =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).status
      : null;
  if (
    error ||
    !selected ||
    (status !== "selected" && status !== "validated")
  ) {
    return NextResponse.json(
      { error: "Cette version ne peut plus être sélectionnée." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status });
    });
  } catch (error) {
    if (error instanceof DemoDataMutationBlockedError) {
      return NextResponse.json(
        {
          error:
            "Retirez d'abord le scénario d'exemple avant de choisir un visuel.",
          reason: "demo_forbidden",
        },
        { status: 409 },
      );
    }
    if (error instanceof DemoBusyError) {
      return NextResponse.json(
        {
          error: "Une autre opération est en cours. Réessayez dans un instant.",
          reason: "busy",
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
