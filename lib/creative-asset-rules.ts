import type { CreativeImageFormat } from "./creative-image-rules.ts";

export type CreativeAssetStatus = "draft" | "selected" | "validated";

export interface CreativeAsset {
  id: string;
  actionId: string | null;
  format: CreativeImageFormat;
  headline: string;
  version: number;
  status: CreativeAssetStatus;
  storagePath: string;
  model: string;
  createdAt: string;
  imageUrl?: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function creativeReservationResult(value: unknown):
  | { allowed: true; requestId: string }
  | { allowed: false; reason: string } {
  const row = record(value);
  if (row.allowed === true && text(row.request_id)) {
    return { allowed: true, requestId: text(row.request_id) };
  }
  return {
    allowed: false,
    reason: text(row.reason) || "reservation_failed",
  };
}

export function recordedCreativeResult(value: unknown): {
  id: string;
  version: number;
  status: CreativeAssetStatus;
  storagePath: string;
} | null {
  const row = record(value);
  const id = text(row.id);
  const storagePath = text(row.storage_path);
  const version = Number(row.version);
  const status = text(row.status);
  if (
    !id ||
    !storagePath ||
    !Number.isInteger(version) ||
    version < 1 ||
    !["draft", "selected", "validated"].includes(status)
  ) {
    return null;
  }
  return {
    id,
    version,
    status: status as CreativeAssetStatus,
    storagePath,
  };
}

export function creativeAssetFromRow(value: unknown): CreativeAsset | null {
  const row = record(value);
  const id = text(row.id);
  const format = text(row.format);
  const headline = text(row.headline);
  const storagePath = text(row.storage_path);
  const model = text(row.model);
  const createdAt = text(row.created_at);
  const version = Number(row.version);
  const status = text(row.status);
  if (
    !id ||
    !["story", "square", "landscape"].includes(format) ||
    !headline ||
    !storagePath ||
    !model ||
    !createdAt ||
    !Number.isInteger(version) ||
    version < 1 ||
    !["draft", "selected", "validated"].includes(status)
  ) {
    return null;
  }
  return {
    id,
    actionId: text(row.action_id) || null,
    format: format as CreativeImageFormat,
    headline,
    version,
    status: status as CreativeAssetStatus,
    storagePath,
    model,
    createdAt,
  };
}

export function creativeLimitMessage(reason: string): {
  error: string;
  status: number;
} {
  if (reason === "campaign_limit") {
    return {
      error: "Cette campagne a atteint ses 5 générations. Sélectionnez une version existante.",
      status: 429,
    };
  }
  if (reason === "daily_limit") {
    return {
      error: "La limite quotidienne de 20 visuels est atteinte. Réessayez demain.",
      status: 429,
    };
  }
  if (reason === "campaign_unavailable") {
    return {
      error: "Cette campagne n'est plus disponible pour la création.",
      status: 409,
    };
  }
  return {
    error: "Le studio ne peut pas réserver cette génération. Réessayez.",
    status: 503,
  };
}
