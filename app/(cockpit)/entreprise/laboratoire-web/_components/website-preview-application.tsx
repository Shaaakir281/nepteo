"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FIELD } from "@/components/ui/styles";
import {
  ACTIVITY_OPTIONS,
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/lib/memory";
import type { IdentityProposal } from "@/lib/research/profile-rules";
import type {
  WebsitePreviewApplicationSections,
  WebsitePreviewCurrentProfile,
  WebsitePreviewMemorySection,
} from "@/lib/research/website-preview-apply-rules";
import { applyWebsitePreviewAction } from "../actions";
import {
  ActivityFields,
  ChannelsFields,
  OffersFields,
  createApplicationDraft,
} from "./website-preview-application-fields";
import {
  currentSummary,
  WebsitePreviewReviewSection,
} from "./website-preview-review-section";

const ERRORS: Record<string, string> = {
  forbidden: "Votre rôle ne permet pas de modifier la fiche entreprise.",
  application_confirmation_required: "Confirmez la revue avant d'appliquer.",
  invalid_sections: "Une section cochée est vide ou invalide. Corrigez-la avant de continuer.",
  nothing_selected: "Choisissez au moins une section à appliquer.",
  preview_unavailable: "Cette analyse n'est plus disponible ou a plus de 30 jours. Relancez-la d'abord.",
  scenario_active: "Retirez le scénario Nepteo avant de modifier votre vraie fiche.",
  application_busy: "Une autre opération de mémoire est en cours. Réessayez dans un instant.",
  application_unavailable: "L'application a été refusée avant écriture. Aucune section n'a été modifiée.",
  application_ambiguous: "Impossible de confirmer le résultat. Rechargez la fiche avant toute nouvelle tentative.",
};

function selectableSections(proposal: IdentityProposal): WebsitePreviewMemorySection[] {
  const sections: WebsitePreviewMemorySection[] = [];
  if (proposal.activity_type || proposal.audience || proposal.description) sections.push("activite");
  if (proposal.zone) sections.push("zone");
  if (proposal.ton) sections.push("ton");
  if (proposal.canaux.length > 0) sections.push("canaux");
  if (proposal.offres.length > 0) sections.push("offres");
  if (proposal.presence.length > 0) sections.push("presence");
  return sections;
}

export function WebsitePreviewApplication({
  website,
  proposal,
  currentProfile,
  applicationBlocked,
  applicationContextAvailable,
}: {
  website: string;
  proposal: IdentityProposal;
  currentProfile: WebsitePreviewCurrentProfile;
  applicationBlocked: boolean;
  applicationContextAvailable: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createApplicationDraft(proposal));
  const [selected, setSelected] = useState<WebsitePreviewMemorySection[]>(() => selectableSections(proposal));
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<WebsitePreviewMemorySection[] | null>(null);

  const activityAvailable = Boolean(
    proposal.activity_type || proposal.audience || proposal.description,
  );
  function toggle(section: WebsitePreviewMemorySection) {
    setSelected((sections) =>
      sections.includes(section)
        ? sections.filter((item) => item !== section)
        : [...sections, section],
    );
    setConfirmed(false);
    setError(null);
  }

  async function apply() {
    if (running || selected.length === 0 || !confirmed) return;
    const sections: WebsitePreviewApplicationSections = {};
    if (selected.includes("activite")) {
      sections.activite = {
        activity_type: draft.activityType,
        audience: draft.audience,
        description: draft.description,
      };
    }
    if (selected.includes("zone")) sections.zone = { text: draft.zone };
    if (selected.includes("ton")) sections.ton = { text: draft.tone };
    if (selected.includes("canaux")) sections.canaux = { list: draft.channels };
    if (selected.includes("offres")) sections.offres = { items: draft.offers };
    if (selected.includes("presence")) {
      sections.presence = {
        list: draft.presence.split(/\r?\n/).filter((item) => item.trim()),
      };
    }

    setRunning(true);
    setError(null);
    try {
      const result = await applyWebsitePreviewAction({
        website,
        confirmed: true,
        sections,
      });
      if (result.ok) {
        setApplied(result.sections);
        router.refresh();
      } else {
        setError(ERRORS[result.reason] ?? ERRORS.application_unavailable);
      }
    } catch {
      setError(ERRORS.application_ambiguous);
    } finally {
      setRunning(false);
    }
  }

  if (applied) {
    return (
      <div className="mt-4 rounded-[13px] border border-green/25 bg-green-tint px-4 py-3 text-[12.5px] text-body">
        <b>{applied.length} section{applied.length > 1 ? "s" : ""} appliquée{applied.length > 1 ? "s" : ""}.</b>{" "}
        Les autres sections sont restées intactes. Aucun nouvel appel web n&apos;a été lancé.{" "}
        <Link href="/entreprise?onglet=identite" className="font-semibold text-violet hover:underline">
          Voir la fiche
        </Link>
      </div>
    );
  }

  if (applicationBlocked || !applicationContextAvailable) {
    return (
      <section className="mt-4 border-t border-line-soft pt-4">
        <h3 className="font-display text-[15px] font-semibold text-ink">
          Préparer l&apos;application à ma fiche
        </h3>
        <p className={`mt-3 rounded-[10px] px-3.5 py-2.5 text-[12px] font-medium ${applicationBlocked ? "bg-amber-tint text-body" : "bg-red-tint text-red"}`}>
          {applicationBlocked
            ? "Application bloquée pendant le scénario Nepteo. L'analyse de test reste disponible et séparée."
            : "La fiche actuelle ou le verrou de scénario ne peut pas être vérifié. L'application reste bloquée."}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 border-t border-line-soft pt-4">
      <h3 className="font-display text-[15px] font-semibold text-ink">
        Préparer l&apos;application à ma fiche
      </h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        Comparez, corrigez puis cochez uniquement les sections à remplacer. Une section non cochée reste intacte.
      </p>

      <div className="mt-4 space-y-3">
        {activityAvailable && (
          <WebsitePreviewReviewSection section="activite" title="Activité et audience" selected={selected.includes("activite")} current={currentSummary("activite", currentProfile)} onToggle={toggle}>
            <ActivityFields draft={draft} onChange={setDraft} activityOptions={ACTIVITY_OPTIONS} audienceOptions={AUDIENCE_OPTIONS} />
          </WebsitePreviewReviewSection>
        )}
        {proposal.zone && (
          <WebsitePreviewReviewSection section="zone" title="Zone" selected={selected.includes("zone")} current={currentSummary("zone", currentProfile)} onToggle={toggle}>
            <input value={draft.zone} maxLength={200} onChange={(event) => setDraft({ ...draft, zone: event.target.value })} className={`mt-3 ${FIELD}`} />
          </WebsitePreviewReviewSection>
        )}
        {proposal.ton && (
          <WebsitePreviewReviewSection section="ton" title="Ton" selected={selected.includes("ton")} current={currentSummary("ton", currentProfile)} onToggle={toggle}>
            <textarea rows={2} value={draft.tone} maxLength={500} onChange={(event) => setDraft({ ...draft, tone: event.target.value })} className={`mt-3 ${FIELD}`} />
          </WebsitePreviewReviewSection>
        )}
        {proposal.canaux.length > 0 && (
          <WebsitePreviewReviewSection section="canaux" title="Canaux" selected={selected.includes("canaux")} current={currentSummary("canaux", currentProfile)} onToggle={toggle}>
            <ChannelsFields draft={draft} onChange={setDraft} options={CHANNEL_OPTIONS} />
          </WebsitePreviewReviewSection>
        )}
        {proposal.offres.length > 0 && (
          <WebsitePreviewReviewSection section="offres" title="Offres" selected={selected.includes("offres")} current={currentSummary("offres", currentProfile)} onToggle={toggle}>
            <OffersFields draft={draft} onChange={setDraft} />
          </WebsitePreviewReviewSection>
        )}
        {proposal.presence.length > 0 && (
          <WebsitePreviewReviewSection section="presence" title="Présence publique" selected={selected.includes("presence")} current={currentSummary("presence", currentProfile)} onToggle={toggle}>
            <textarea rows={Math.min(6, proposal.presence.length + 1)} value={draft.presence} maxLength={1205} onChange={(event) => setDraft({ ...draft, presence: event.target.value })} className={`mt-3 ${FIELD}`} />
            <p className="mt-1 text-[11px] text-faint">Une observation par ligne, six maximum.</p>
          </WebsitePreviewReviewSection>
        )}
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-[12px] leading-relaxed text-body">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-violet" />
        J&apos;ai vérifié les sections cochées. Elles seules remplaceront les sections correspondantes de ma fiche.
      </label>
      {error && <p role="alert" className="mt-3 rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[12px] font-medium text-red">{error}</p>}
      <button
        type="button"
        onClick={() => void apply()}
        disabled={running || selected.length === 0 || !confirmed || applicationBlocked || !applicationContextAvailable}
        className="mt-3 rounded-[10px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running ? "Application en cours…" : `Appliquer les ${selected.length} section${selected.length > 1 ? "s" : ""}`}
      </button>
      <p className="mt-2 text-[11px] text-faint">
        Cette action est gratuite, atomique et journalisée. Aucun envoi ni campagne n&apos;est créé.
      </p>
    </section>
  );
}
