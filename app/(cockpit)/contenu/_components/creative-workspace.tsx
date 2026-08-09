"use client";

import Link from "next/link";
import { useState } from "react";
import { icons } from "@/components/icons";
import {
  CREATIVE_IMAGE_FORMATS,
  storyHeadline,
  type CreativeImageFormat,
} from "@/lib/creative-image-rules";
import type { CampaignCreativeSource } from "@/lib/campaign-creative-rules";
import type { CreativeAsset } from "@/lib/creative-asset-rules";
import type { CreativeSuggestion } from "@/lib/creative-template";
import { StoryPreview } from "./story-preview";

interface ImageResult {
  image?: string;
  creative?: {
    id: string;
    version: number;
    status: CreativeAsset["status"];
    model: string;
  };
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  proposed: "À valider",
  approved: "Validée",
  postponed: "Reportée",
};

export function CreativeWorkspace({
  canEdit,
  suggestions,
  campaigns,
  initialCreativeAssets,
  initialCampaignId,
  initialFreeMode = false,
  initialFreeAssetTotal = 0,
  initialFreeAssetPage = 1,
  freeAssetPageSize = 8,
}: {
  canEdit: boolean;
  suggestions: CreativeSuggestion[];
  campaigns: CampaignCreativeSource[];
  initialCreativeAssets: CreativeAsset[];
  initialCampaignId?: string;
  initialFreeMode?: boolean;
  initialFreeAssetTotal?: number;
  initialFreeAssetPage?: number;
  freeAssetPageSize?: number;
}) {
  const requestedCampaign = initialCampaignId
    ? campaigns.find((campaign) => campaign.id === initialCampaignId)
    : undefined;
  const startsInFreeMode =
    initialFreeMode ||
    campaigns.length === 0 ||
    Boolean(initialCampaignId && !requestedCampaign);
  const initialCampaign = startsInFreeMode
    ? null
    : requestedCampaign ?? campaigns[0] ?? null;
  const initialAsset = initialCampaign
    ? initialCreativeAssets.find(
        (asset) =>
          asset.actionId === initialCampaign.id &&
          (asset.status === "selected" || asset.status === "validated"),
      ) ??
      initialCreativeAssets.find((asset) => asset.actionId === initialCampaign.id) ??
      null
    : initialCreativeAssets.find((asset) => asset.actionId === null) ?? null;
  const [campaignId, setCampaignId] = useState<string | null>(
    initialCampaign?.id ?? null,
  );
  const [freeMode, setFreeMode] = useState(startsInFreeMode);
  const [objective, setObjective] = useState(
    initialAsset?.headline ?? initialCampaign?.headline ?? "",
  );
  const [format, setFormat] = useState<CreativeImageFormat>(
    initialAsset?.format ?? initialCampaign?.recommendedFormat ?? "story",
  );
  const [image, setImage] = useState<string | null>(initialAsset?.imageUrl ?? null);
  const [creativeAssets, setCreativeAssets] = useState(initialCreativeAssets);
  const [freeAssetTotal, setFreeAssetTotal] = useState(initialFreeAssetTotal);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campaign = campaigns.find((item) => item.id === campaignId) ?? null;
  const campaignLocked =
    campaign?.status === "approved" &&
    creativeAssets.some(
      (asset) =>
        asset.actionId === campaign.id && asset.status === "validated",
    );
  const campaignAssets = creativeAssets.filter(
    (asset) =>
      asset.actionId === campaignId &&
      (!campaignLocked || asset.status === "validated"),
  );
  const freePageCount = Math.max(
    1,
    Math.ceil(freeAssetTotal / Math.max(1, freeAssetPageSize)),
  );

  function chooseCampaign(id: string) {
    if (loading) return;
    const next = campaigns.find((item) => item.id === id);
    if (!next) return;
    setCampaignId(next.id);
    setFreeMode(false);
    const existing =
      creativeAssets.find(
        (asset) =>
          asset.actionId === next.id &&
          (asset.status === "selected" || asset.status === "validated"),
      ) ?? creativeAssets.find((asset) => asset.actionId === next.id);
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
      const response = await fetch("/api/creative/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          format,
          campaignId: freeMode ? null : campaignId,
        }),
      });
      const result = (await response.json()) as ImageResult;
      if (!response.ok || !result.image || !result.creative) {
        setError(result.error || "Le visuel n'a pas pu être créé.");
        return;
      }
      setImage(result.image);
      const newAsset: CreativeAsset = {
        id: result.creative.id,
        actionId: freeMode ? null : campaignId,
        format,
        headline: objective.trim(),
        version: result.creative.version,
        status: result.creative.status,
        storagePath: "",
        model: result.creative.model,
        createdAt: new Date().toISOString(),
        imageUrl: result.image,
      };
      setCreativeAssets((current) => [
        newAsset,
        ...current.map((asset) =>
          asset.actionId === campaignId && asset.status === "selected"
            ? { ...asset, status: "draft" as const }
            : asset,
        ),
      ]);
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
    if (
      !canEdit ||
      campaignLocked ||
      asset.status !== "draft" ||
      !asset.actionId ||
      selectingId
    ) {
      return;
    }
    setSelectingId(asset.id);
    setError(null);
    try {
      const response = await fetch(`/api/creative/${asset.id}/select`, {
        method: "PATCH",
      });
      const result = (await response.json()) as {
        error?: string;
        status?: CreativeAsset["status"];
      };
      if (!response.ok) {
        setError(result.error || "Cette version ne peut pas être retenue.");
        return;
      }
      setCreativeAssets((current) =>
        current.map((item) =>
          item.actionId !== asset.actionId
            ? item
            : item.id === asset.id
              ? {
                  ...item,
                  status:
                    result.status === "validated" ? "validated" : "selected",
                }
              : item.status === "selected" || item.status === "validated"
                ? { ...item, status: "draft" }
                : item,
        ),
      );
    } catch {
      setError("La sélection n'a pas pu être enregistrée.");
    } finally {
      setSelectingId(null);
    }
  }

  if (campaigns.length === 0 && !freeMode) {
    return null;
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[12px] border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-violet">
            {icons.sparkle}
            Studio visuel IA
          </div>
          {campaigns.length > 0 && (
            <button
              type="button"
              onClick={freeMode ? () => chooseCampaign(campaigns[0].id) : startFree}
              disabled={loading}
              className="text-[11px] font-semibold text-muted transition hover:text-violet-ink disabled:cursor-not-allowed disabled:opacity-45"
            >
              {freeMode ? "Revenir aux campagnes" : "Créer sans campagne"}
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className="mt-5 rounded-[12px] border border-dashed border-line bg-tint-soft px-5 py-5">
            <p className="font-display text-[17px] font-medium text-ink">
              Donnez d’abord un cap au visuel
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              Une campagne permet à Nepteo de préparer le message et le format.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/campagnes"
                className="rounded-[9px] bg-violet px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
              >
                Préparer une campagne
              </Link>
              <span className="text-[11px] text-faint">ou créez librement ci-dessous</span>
            </div>
          </div>
        ) : freeMode ? (
          <div className="mt-5 rounded-[11px] border border-line-soft bg-tint-soft px-4 py-3">
            <p className="text-[12px] font-semibold text-ink">Création libre</p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Le visuel ne sera rattaché à aucune campagne.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <label
              htmlFor="creative-campaign"
              className="text-[11.5px] font-semibold text-ink"
            >
              Campagne source
            </label>
            <select
              id="creative-campaign"
              value={campaignId ?? ""}
              onChange={(event) => chooseCampaign(event.target.value)}
              disabled={loading}
              className="mt-2 w-full rounded-[9px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-ink focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/10 disabled:cursor-not-allowed disabled:bg-tint-soft"
            >
              {campaigns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            {campaign && (
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[9px] bg-[#eaf0f9] px-3 py-2">
                <p className="line-clamp-2 text-[11.5px] leading-relaxed text-[#2d5ba7]">
                  {campaign.context || "Brief et message repris automatiquement."}
                </p>
                <span className="flex-none rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#2d5ba7]">
                  {STATUS_LABELS[campaign.status] ?? campaign.status}
                </span>
              </div>
            )}
          </div>
        )}

        {(campaignAssets.length > 0 || (freeMode && freeAssetTotal > 0)) && (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11.5px] font-semibold text-ink">
                {freeMode ? "Créations libres enregistrées" : "Versions enregistrées"}
              </p>
              <span className="text-[10.5px] text-faint">
                {freeMode
                  ? `${freeAssetTotal} au total`
                  : campaignLocked
                    ? "Visuel final"
                    : `${campaignAssets.length}/5`}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {campaignAssets.map((asset) => {
                const retained =
                  asset.status === "selected" || asset.status === "validated";
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => selectAsset(asset)}
                    disabled={loading || selectingId === asset.id}
                    className={`overflow-hidden rounded-[9px] border text-left transition ${
                      retained
                        ? "border-[#2d5ba7] bg-[#eaf0f9]"
                        : "border-line bg-white hover:border-violet"
                    }`}
                  >
                    <span
                      className="block h-14 bg-[#ddd4c7] bg-cover bg-center"
                      style={
                        asset.imageUrl
                          ? { backgroundImage: `url(${asset.imageUrl})` }
                          : undefined
                      }
                    />
                    <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <span className="text-[11px] font-semibold text-ink">
                        {freeMode
                          ? CREATIVE_IMAGE_FORMATS[asset.format].label
                          : `Version ${asset.version}`}
                      </span>
                      <span className="text-[9.5px] font-semibold text-muted">
                        {selectingId === asset.id
                          ? "Sélection…"
                          : retained
                            ? asset.status === "validated"
                              ? "Validée"
                              : "Retenue"
                            : canEdit && !campaignLocked
                              ? "Choisir"
                              : "Aperçu"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {freeMode && freePageCount > 1 && (
              <div className="mt-2.5 flex items-center justify-between gap-3 text-[10.5px] font-semibold">
                {initialFreeAssetPage > 1 ? (
                  <Link
                    href={`/contenu?libre=1&creatives_page=${initialFreeAssetPage - 1}`}
                    className="text-violet-ink hover:underline"
                  >
                    Plus récentes
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-faint">
                  Page {initialFreeAssetPage}/{freePageCount}
                </span>
                {initialFreeAssetPage < freePageCount ? (
                  <Link
                    href={`/contenu?libre=1&creatives_page=${initialFreeAssetPage + 1}`}
                    className="text-violet-ink hover:underline"
                  >
                    Plus anciennes
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        )}

        <fieldset className="mt-5">
          <legend className="text-[11.5px] font-semibold text-ink">Format</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(CREATIVE_IMAGE_FORMATS) as CreativeImageFormat[]).map(
              (id) => {
                const item = CREATIVE_IMAGE_FORMATS[id];
                const selected = format === id;
                const recommended = campaign?.recommendedFormat === id && !freeMode;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFormat(id)}
                    disabled={campaignLocked || loading}
                    className={`rounded-[9px] border px-2.5 py-2.5 text-left transition ${
                      selected
                        ? "border-violet bg-tint text-violet-ink"
                        : "border-line bg-white text-body hover:bg-tint-soft"
                    }`}
                  >
                    <span className="block text-[12.5px] font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-muted">
                      {item.ratio}{recommended ? " · conseillé" : ""}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </fieldset>

        {freeMode && suggestions.length > 0 && (
          <div className="mt-5">
            <p className="text-[11.5px] font-semibold text-ink">
              Suggestions de l&apos;agent
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => setObjective(suggestion.objectif)}
                  disabled={loading}
                  className="rounded-full border border-line bg-tint-soft px-3 py-1.5 text-[11.5px] font-medium text-body transition hover:border-violet hover:text-violet-ink disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label
          htmlFor="creative-objective"
          className="mt-5 block text-[11.5px] font-semibold text-ink"
        >
          {freeMode ? "Votre message" : "Message proposé"}
        </label>
        <textarea
          id="creative-objective"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          disabled={!canEdit || campaignLocked || loading}
          maxLength={500}
          rows={4}
          placeholder="Ex. Faire découvrir notre nouvelle offre aux indépendants qui manquent de temps"
          className="mt-2 w-full resize-none rounded-[9px] border border-line bg-white px-3.5 py-3 text-[13px] leading-relaxed text-ink placeholder:text-faint focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/10 disabled:bg-tint-soft"
        />
        {!freeMode && (
          <p className="mt-1.5 text-[10.5px] text-faint">
            {campaignLocked
              ? "Livrable validé · consultation et téléchargement uniquement"
              : campaign?.status === "approved"
                ? "Campagne déjà validée · choisissez une version pour valider son visuel"
                : "Déjà préparé depuis la campagne · modifiable avant génération"}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-[8px] bg-red-tint px-3 py-2 text-[12px] text-red" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={generate}
          disabled={
            !canEdit ||
            campaignLocked ||
            loading ||
            objective.trim().length < 3 ||
            (!freeMode && campaignAssets.length >= 5)
          }
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#8a232d] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#741d25] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {icons.sparkle}
          {campaignLocked
            ? "Campagne validée · visuel final"
            : !freeMode && campaignAssets.length >= 5
            ? "5 versions créées · choisissez-en une"
            : loading
            ? "Nepteo imagine votre visuel…"
            : image
              ? "Créer une nouvelle version"
              : `Créer ${format === "story" ? "la story" : "le visuel"}`}
        </button>
        <p className="mt-2 text-center text-[10.5px] text-faint">
          1 proposition · rien n&apos;est publié sans votre accord
        </p>
      </section>

      <StoryPreview
        format={format}
        headline={storyHeadline(objective || "Votre message prendra vie ici")}
        image={image}
        loading={loading}
      />
    </div>
  );
}
