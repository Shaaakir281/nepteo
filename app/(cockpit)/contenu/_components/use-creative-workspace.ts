"use client";

import { useState } from "react";
import { CREATIVE_IMAGE_FORMATS, type CreativeImageFormat } from "@/lib/creative-image-rules";
import type { CreativeAsset } from "@/lib/creative-asset-rules";
import type { CreativeWorkspaceProps } from "./creative-workspace";

interface ImageResult {
  image?: string;
  creative?: { id: string; version: number; status: CreativeAsset["status"]; model: string };
  error?: string;
}

export function useCreativeWorkspace({ canEdit, campaigns, initialCreativeAssets, initialCampaignId, initialFreeMode = false, initialFreeAssetTotal = 0 }: CreativeWorkspaceProps) {
  const requestedCampaign = initialCampaignId ? campaigns.find((item) => item.id === initialCampaignId) : undefined;
  const startsInFreeMode = initialFreeMode || campaigns.length === 0 || Boolean(initialCampaignId && !requestedCampaign);
  const initialCampaign = startsInFreeMode ? null : requestedCampaign ?? campaigns[0] ?? null;
  const initialAsset = initialCampaign
    ? initialCreativeAssets.find((asset) => asset.actionId === initialCampaign.id && (asset.status === "selected" || asset.status === "validated")) ?? initialCreativeAssets.find((asset) => asset.actionId === initialCampaign.id) ?? null
    : initialCreativeAssets.find((asset) => asset.actionId === null) ?? null;
  const [campaignId, setCampaignId] = useState<string | null>(initialCampaign?.id ?? null);
  const [freeMode, setFreeMode] = useState(startsInFreeMode);
  const [objective, setObjective] = useState(initialAsset?.headline ?? initialCampaign?.headline ?? "");
  const [format, setFormat] = useState<CreativeImageFormat>(initialAsset?.format ?? initialCampaign?.recommendedFormat ?? "story");
  const [image, setImage] = useState<string | null>(initialAsset?.imageUrl ?? null);
  const [creativeAssets, setCreativeAssets] = useState(initialCreativeAssets);
  const [freeAssetTotal, setFreeAssetTotal] = useState(initialFreeAssetTotal);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const campaignLocked = campaign?.status === "approved" && creativeAssets.some((asset) => asset.actionId === campaign.id && asset.status === "validated");
  const campaignAssets = creativeAssets.filter((asset) => asset.actionId === campaignId && (!campaignLocked || asset.status === "validated"));

  function chooseCampaign(id: string) {
    if (loading) return;
    const next = campaigns.find((item) => item.id === id);
    if (!next) return;
    const existing = creativeAssets.find((asset) => asset.actionId === next.id && (asset.status === "selected" || asset.status === "validated")) ?? creativeAssets.find((asset) => asset.actionId === next.id);
    setCampaignId(next.id);
    setFreeMode(false);
    setObjective(existing?.headline ?? next.headline);
    setFormat(existing?.format ?? next.recommendedFormat);
    setImage(existing?.imageUrl ?? null);
    setError(null);
  }

  function startFree() {
    if (loading) return;
    const existing = creativeAssets.find((asset) => asset.actionId === null);
    setCampaignId(null);
    setFreeMode(true);
    setObjective(existing?.headline ?? "");
    setFormat(existing?.format ?? "story");
    setImage(existing?.imageUrl ?? null);
    setError(null);
  }

  async function generate() {
    if (loading || campaignLocked || objective.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/creative/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective, format, campaignId: freeMode ? null : campaignId }) });
      const result = (await response.json()) as ImageResult;
      if (!response.ok || !result.image || !result.creative) {
        setError(result.error || "Le visuel n'a pas pu être créé.");
        return;
      }
      setImage(result.image);
      const newAsset: CreativeAsset = { id: result.creative.id, actionId: freeMode ? null : campaignId, format, headline: objective.trim(), version: result.creative.version, status: result.creative.status, storagePath: "", model: result.creative.model, createdAt: new Date().toISOString(), imageUrl: result.image };
      setCreativeAssets((current) => [newAsset, ...current.map((asset) => asset.actionId === campaignId && asset.status === "selected" ? { ...asset, status: "draft" as const } : asset)]);
      if (freeMode) setFreeAssetTotal((current) => current + 1);
    } catch {
      setError("Connexion au studio impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function selectAsset(asset: CreativeAsset) {
    if (loading) return;
    setObjective(asset.headline);
    setFormat(asset.format);
    setImage(asset.imageUrl ?? null);
    if (!canEdit || campaignLocked || asset.status !== "draft" || !asset.actionId || selectingId) return;
    setSelectingId(asset.id);
    setError(null);
    try {
      const response = await fetch(`/api/creative/${asset.id}/select`, { method: "PATCH" });
      const result = (await response.json()) as { error?: string; status?: CreativeAsset["status"] };
      if (!response.ok) {
        setError(result.error || "Cette version ne peut pas être retenue.");
        return;
      }
      setCreativeAssets((current) => current.map((item) => item.actionId !== asset.actionId ? item : item.id === asset.id ? { ...item, status: result.status === "validated" ? "validated" : "selected" } : item.status === "selected" || item.status === "validated" ? { ...item, status: "draft" } : item));
    } catch {
      setError("La sélection n'a pas pu être enregistrée.");
    } finally {
      setSelectingId(null);
    }
  }

  return { campaign, campaignId, freeMode, objective, format, formatLabel: `${CREATIVE_IMAGE_FORMATS[format].label} ${CREATIVE_IMAGE_FORMATS[format].ratio}`, image, campaignLocked, campaignAssets, freeAssetTotal, selectingId, loading, error, chooseCampaign, startFree, generate, selectAsset, setFormat, setObjective };
}
