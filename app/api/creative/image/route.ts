import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEditorContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { readMemory } from "@/lib/memory-store";
import { memoText } from "@/lib/draft-template";
import {
  buildCreativeImagePrompt,
  isCreativeImageFormat,
  type CreativeImageFormat,
} from "@/lib/creative-image-rules";
import {
  campaignCreativeSource,
  campaignImageObjective,
  type CampaignCreativeSource,
} from "@/lib/campaign-creative-rules";
import {
  creativeLimitMessage,
  creativeReservationResult,
  recordedCreativeResult,
} from "@/lib/creative-asset-rules";
import {
  generateOpenAIImage,
  ImageGenerationError,
} from "@/lib/openai-image";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";

export const maxDuration = 180;

const CREATIVE_BUCKET = "campaign-creatives";

const BodySchema = z.object({
  objective: z.string().trim().min(3).max(500),
  format: z.string(),
  campaignId: z.string().uuid().nullable().optional(),
});

type AdminClient = ReturnType<typeof createAdminClient>;

interface PreparedGeneration {
  campaign: CampaignCreativeSource | null;
  prompt: string;
  requestId: string;
}

async function markFailed(
  admin: AdminClient,
  organizationId: string,
  requestId: string,
  reason: string,
  clearStoragePath = false,
) {
  await admin
    .from("creative_generation_requests")
    .update({
      status: "failed",
      failure_reason: reason,
      completed_at: new Date().toISOString(),
      ...(clearStoragePath ? { storage_path: null } : {}),
    })
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .eq("status", "reserved");
}

async function journalFailure(
  admin: AdminClient,
  input: {
    organizationId: string;
    userId: string;
    requestId: string;
    format: CreativeImageFormat;
    campaign: CampaignCreativeSource | null;
    reason: string;
  },
) {
  await admin.from("journal").insert({
    organization_id: input.organizationId,
    action_id: input.campaign?.id ?? null,
    event: "creative_image_failed",
    actor: "agent",
    actor_id: input.userId,
    payload: {
      format: input.format,
      request_id: input.requestId,
      reason: input.reason,
      ...(input.campaign ? { title: input.campaign.title } : {}),
    },
  });
}

function demoLockResponse(error: unknown, operation: "create" | "save") {
  if (error instanceof DemoDataMutationBlockedError) {
    return NextResponse.json(
      {
        error:
          operation === "create"
            ? "Retirez d'abord le scénario d'exemple avant de créer un visuel."
            : "Le scénario d'exemple a été activé : le visuel n'a pas été sauvegardé.",
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
  return null;
}

export async function POST(request: Request) {
  const ctx = await getEditorContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!ctx.canManageCampaigns) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isCreativeImageFormat(parsed.data.format)) {
    return NextResponse.json(
      { error: "Précisez le message et le format du visuel." },
      { status: 400 },
    );
  }

  const format = parsed.data.format as CreativeImageFormat;
  const admin = createAdminClient();
  let prepared: PreparedGeneration | NextResponse;

  try {
    prepared = await withRealDataMutationLock(admin, ctx.orgId, async () => {
      let campaign: CampaignCreativeSource | null = null;
      if (parsed.data.campaignId) {
        const { data: campaignRow, error: campaignError } = await admin
          .from("actions")
          .select("id, kind, title, status, payload")
          .eq("id", parsed.data.campaignId)
          .eq("organization_id", ctx.orgId)
          .eq("kind", "launch_campaign")
          .in("status", ["proposed", "postponed", "approved"])
          .maybeSingle();
        campaign = campaignCreativeSource(campaignRow ?? {});
        if (campaignError || !campaign) {
          return NextResponse.json(
            { error: "Cette campagne n'est plus disponible pour la création." },
            { status: 409 },
          );
        }
      }

      const memory = await readMemory(
        admin,
        ["activite", "offres", "ton", "presence"],
        ctx.orgId,
      );
      const prompt = buildCreativeImagePrompt({
        objective: campaign
          ? campaignImageObjective(campaign, parsed.data.objective)
          : parsed.data.objective,
        format,
        activity: memoText(memory, "activite"),
        offer: memoText(memory, "offres"),
        tone: memoText(memory, "ton"),
        colors: memoText(memory, "presence"),
      });

      const { data: reservationData, error: reservationError } = await admin.rpc(
        "reserve_creative_generation",
        {
          p_organization_id: ctx.orgId,
          p_action_id: campaign?.id ?? null,
          p_actor_id: ctx.userId,
        },
      );
      if (reservationError) {
        return NextResponse.json(
          { error: "Le studio ne peut pas réserver cette génération. Réessayez." },
          { status: 503 },
        );
      }
      const reservation = creativeReservationResult(reservationData);
      if (!reservation.allowed) {
        const limit = creativeLimitMessage(reservation.reason);
        return NextResponse.json(
          { error: limit.error, reason: reservation.reason },
          { status: limit.status },
        );
      }

      const { error: requestedJournalError } = await admin.from("journal").insert({
        organization_id: ctx.orgId,
        action_id: campaign?.id ?? null,
        event: "creative_image_requested",
        actor: "user",
        actor_id: ctx.userId,
        payload: {
          format,
          request_id: reservation.requestId,
          ...(campaign ? { title: campaign.title } : {}),
        },
      });
      if (requestedJournalError) {
        await markFailed(
          admin,
          ctx.orgId,
          reservation.requestId,
          "journal",
        );
        return NextResponse.json(
          {
            error:
              "La génération n'a pas démarré : sa trace n'a pas pu être enregistrée.",
          },
          { status: 503 },
        );
      }

      return {
        campaign,
        prompt,
        requestId: reservation.requestId,
      } satisfies PreparedGeneration;
    });
  } catch (error) {
    const response = demoLockResponse(error, "create");
    if (response) return response;
    throw error;
  }

  if (prepared instanceof NextResponse) return prepared;

  let image: Awaited<ReturnType<typeof generateOpenAIImage>>;
  try {
    image = await generateOpenAIImage({ prompt: prepared.prompt, format });
  } catch (error) {
    const known =
      error instanceof ImageGenerationError
        ? error
        : new ImageGenerationError(
            "provider",
            "Le visuel n'a pas pu être créé. Réessayez.",
          );
    try {
      await withRealDataMutationLock(admin, ctx.orgId, async () => {
        await markFailed(admin, ctx.orgId, prepared.requestId, known.reason);
        await journalFailure(admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          requestId: prepared.requestId,
          format,
          campaign: prepared.campaign,
          reason: known.reason,
        });
      });
    } catch {
      // Si une démo a démarré entre-temps, la réservation expirera côté SQL.
    }
    return NextResponse.json(
      { error: known.message, reason: known.reason },
      { status: known.status },
    );
  }

  try {
    return await withRealDataMutationLock(admin, ctx.orgId, async () => {
      const creativeId = randomUUID();
      const storagePath = `${ctx.orgId}/${prepared.campaign?.id ?? "free"}/${creativeId}.jpg`;

      const { data: pathRow, error: pathError } = await admin
        .from("creative_generation_requests")
        .update({ storage_path: storagePath })
        .eq("id", prepared.requestId)
        .eq("organization_id", ctx.orgId)
        .eq("status", "reserved")
        .select("id")
        .maybeSingle();
      if (pathError || !pathRow) {
        const { data: reconciledPath, error: reconciliationError } = await admin
          .from("creative_generation_requests")
          .select("id")
          .eq("id", prepared.requestId)
          .eq("organization_id", ctx.orgId)
          .eq("status", "reserved")
          .eq("storage_path", storagePath)
          .maybeSingle();
        if (reconciliationError || !reconciledPath) {
          await markFailed(admin, ctx.orgId, prepared.requestId, "storage");
          return NextResponse.json(
            { error: "Le studio ne peut pas préparer le stockage du visuel." },
            { status: 503 },
          );
        }
      }

      const failPersistence = async (message: string) => {
        const { error: removalError } = await admin.storage
          .from(CREATIVE_BUCKET)
          .remove([storagePath]);
        const reason = removalError ? "storage_cleanup" : "storage";
        await markFailed(
          admin,
          ctx.orgId,
          prepared.requestId,
          reason,
          !removalError,
        );
        await journalFailure(admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          requestId: prepared.requestId,
          format,
          campaign: prepared.campaign,
          reason,
        });
        return NextResponse.json({ error: message, reason }, { status: 503 });
      };

      const { error: storageError } = await admin.storage
        .from(CREATIVE_BUCKET)
        .upload(storagePath, Buffer.from(image.base64, "base64"), {
          contentType: image.mimeType,
          cacheControl: "31536000",
          upsert: false,
        });
      if (storageError) {
        return failPersistence(
          "Le visuel a été créé mais n'a pas pu être sauvegardé. Réessayez.",
        );
      }

      const { data: recordedData, error: recordedError } = await admin.rpc(
        "record_creative_asset",
        {
          p_id: creativeId,
          p_organization_id: ctx.orgId,
          p_action_id: prepared.campaign?.id ?? null,
          p_request_id: prepared.requestId,
          p_actor_id: ctx.userId,
          p_format: format,
          p_headline: parsed.data.objective,
          p_storage_path: storagePath,
          p_model: image.model,
        },
      );
      let creative = recordedCreativeResult(recordedData);
      if (recordedError || !creative) {
        const { data: reconciledAsset, error: reconciliationError } = await admin
          .from("creative_assets")
          .select("id, version, status, storage_path")
          .eq("request_id", prepared.requestId)
          .eq("organization_id", ctx.orgId)
          .maybeSingle();
        creative = recordedCreativeResult(reconciledAsset);
        if (reconciliationError) {
          return NextResponse.json(
            {
              error:
                "Le visuel a été créé, mais son enregistrement doit être vérifié avant de réessayer.",
              reason: "storage_reconciliation",
            },
            { status: 503 },
          );
        }
        if (!creative) {
          return failPersistence(
            "Le visuel a été créé mais sa version n'a pas pu être enregistrée. Réessayez.",
          );
        }
      }

      return NextResponse.json(
        {
          image: `data:${image.mimeType};base64,${image.base64}`,
          format,
          creative: {
            id: creative.id,
            version: creative.version,
            status: creative.status,
            model: image.model,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (error) {
    const response = demoLockResponse(error, "save");
    if (response) return response;
    throw error;
  }
}
