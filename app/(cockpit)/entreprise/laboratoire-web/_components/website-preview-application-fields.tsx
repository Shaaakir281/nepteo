"use client";

import { FIELD } from "@/components/ui/styles";
import type { IdentityProposal, ProposedOffer } from "@/lib/research/profile-rules";

export interface ApplicationDraft {
  activityType: string;
  audience: string;
  description: string;
  zone: string;
  tone: string;
  channels: string[];
  offers: ProposedOffer[];
  presence: string;
}

export function createApplicationDraft(
  proposal: IdentityProposal,
): ApplicationDraft {
  return {
    activityType: proposal.activity_type ?? "",
    audience: proposal.audience ?? "",
    description: proposal.description ?? "",
    zone: proposal.zone ?? "",
    tone: proposal.ton ?? "",
    channels: [...proposal.canaux],
    offers: proposal.offres.map((offer) => ({ ...offer })),
    presence: proposal.presence.join("\n"),
  };
}

export function ActivityFields({
  draft,
  onChange,
  activityOptions,
  audienceOptions,
}: {
  draft: ApplicationDraft;
  onChange: (draft: ApplicationDraft) => void;
  activityOptions: readonly string[];
  audienceOptions: readonly string[];
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-[12px] font-semibold text-ink">
        Activité
        <select
          value={draft.activityType}
          onChange={(event) =>
            onChange({ ...draft, activityType: event.target.value })
          }
          className={`mt-1 ${FIELD}`}
        >
          <option value="">À choisir</option>
          {activityOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="text-[12px] font-semibold text-ink">
        Audience
        <select
          value={draft.audience}
          onChange={(event) =>
            onChange({ ...draft, audience: event.target.value })
          }
          className={`mt-1 ${FIELD}`}
        >
          <option value="">À choisir</option>
          {audienceOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="text-[12px] font-semibold text-ink sm:col-span-2">
        Description
        <textarea
          rows={3}
          maxLength={1000}
          value={draft.description}
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
          className={`mt-1 ${FIELD}`}
        />
      </label>
    </div>
  );
}

export function ChannelsFields({
  draft,
  onChange,
  options,
}: {
  draft: ApplicationDraft;
  onChange: (draft: ApplicationDraft) => void;
  options: readonly string[];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option}
          className="cursor-pointer rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium has-[:checked]:border-violet has-[:checked]:bg-tint"
        >
          <input
            type="checkbox"
            checked={draft.channels.includes(option)}
            onChange={(event) =>
              onChange({
                ...draft,
                channels: event.target.checked
                  ? [...draft.channels, option]
                  : draft.channels.filter((channel) => channel !== option),
              })
            }
            className="sr-only"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

export function OffersFields({
  draft,
  onChange,
}: {
  draft: ApplicationDraft;
  onChange: (draft: ApplicationDraft) => void;
}) {
  function update(index: number, field: keyof ProposedOffer, value: string) {
    const offers = draft.offers.map((offer, offerIndex) =>
      offerIndex === index ? { ...offer, [field]: value } : offer,
    );
    onChange({ ...draft, offers });
  }

  return (
    <div className="mt-3 space-y-3">
      {draft.offers.map((offer, index) => (
        <div key={index} className="grid gap-2 rounded-[10px] bg-white p-3 sm:grid-cols-2">
          {(["name", "price", "target", "promise"] as const).map((field) => (
            <label key={field} className="text-[11.5px] font-semibold text-ink">
              {field === "name"
                ? "Nom"
                : field === "price"
                  ? "Prix"
                  : field === "target"
                    ? "Cible"
                    : "Promesse"}
              <input
                value={offer[field] ?? ""}
                maxLength={field === "name" ? 80 : 200}
                onChange={(event) => update(index, field, event.target.value)}
                className={`mt-1 ${FIELD}`}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                offers: draft.offers.filter((_, offerIndex) => offerIndex !== index),
              })
            }
            className="justify-self-start text-[11.5px] font-semibold text-red hover:underline sm:col-span-2"
          >
            Retirer cette offre
          </button>
        </div>
      ))}
    </div>
  );
}
