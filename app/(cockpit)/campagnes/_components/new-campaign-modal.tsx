"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import {
  validateCampaignBrief,
  type CampaignValidationErrors,
} from "@/lib/campaign-plan";
import { validateCampaignStudioIntent } from "@/lib/campaign-studio";
import { buildCampaignAction, submitCampaignAction } from "../actions";
import {
  CampaignBriefForm,
  EMPTY_CAMPAIGN_BRIEF,
  campaignBriefInput,
  type CampaignBriefDraft,
} from "./campaign-brief-form";
import {
  CampaignGuards,
  CampaignProposalReview,
  CampaignProposalSummary,
} from "./campaign-proposal-review";
import type { CampaignBuild } from "../actions";

const STEPS = ["Brief", "Construction", "Studio", "Limites"];

export function NewCampaignModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<CampaignBriefDraft>(EMPTY_CAMPAIGN_BRIEF);
  const [errors, setErrors] = useState<CampaignValidationErrors>({});
  const [proposal, setProposal] = useState<CampaignBuild | null>(null);
  const [requestKey, setRequestKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [researching, setResearching] = useState(false);
  const [done, setDone] = useState<"created" | "duplicate" | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const reset = useCallback(() => {
    setStep(1);
    setDraft(EMPTY_CAMPAIGN_BRIEF);
    setErrors({});
    setProposal(null);
    setRequestKey("");
    setSubmitting(false);
    setResearching(false);
    setDone(null);
    setActionId(null);
    setMessage(null);
  }, []);

  const close = useCallback(() => {
    if (step === 2 || submitting || researching) return;
    setOpen(false);
    reset();
  }, [reset, researching, step, submitting]);

  function show() {
    reset();
    setRequestKey(crypto.randomUUID());
    setOpen(true);
  }

  useDialogFocus({
    open,
    onClose: close,
    dialogRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef: triggerRef,
  });

  function updateDraft(patch: Partial<CampaignBriefDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(patch)) {
        delete next[field as keyof CampaignValidationErrors];
      }
      return next;
    });
    setMessage(null);
  }

  async function build() {
    const input = campaignBriefInput(draft);
    const localValidation = validateCampaignBrief(input);
    if (!localValidation.ok) {
      setErrors(localValidation.errors);
      setMessage("Complétez les champs signalés avant de construire la proposition.");
      return;
    }

    setMessage(null);
    setStep(2);
    const result = await buildCampaignAction(input);
    if (!result.ok) {
      if (result.errors) setErrors(result.errors);
      setMessage(
        result.reason === "forbidden"
          ? "Votre rôle ne permet pas de gérer les campagnes."
          : result.reason === "invalid_brief"
            ? "Le serveur a refusé le brief. Vérifiez les champs signalés."
            : "La construction n'a pas abouti. Aucun nouvel essai automatique n'a été lancé.",
      );
      setStep(1);
      return;
    }

    setProposal(result.build);
    setStep(3);
  }

  async function submit() {
    if (!proposal || !requestKey || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitCampaignAction(
        proposal.brief,
        proposal.studio,
        requestKey,
      );
      if (result.ok) {
        setActionId(result.actionId);
        setDone(result.duplicate ? "duplicate" : "created");
        router.refresh();
        return;
      }
      if (result.errors) setErrors(result.errors);
      setMessage(submissionError(result.reason, result.message));
    } finally {
      setSubmitting(false);
    }
  }

  function reviewLimits() {
    if (!proposal) return;
    const validation = validateCampaignStudioIntent(proposal.studio);
    if (!validation.ok) {
      setMessage(validation.issues[0]?.message ?? "La proposition doit être corrigée.");
      return;
    }
    setMessage(null);
    setStep(4);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        className="rounded-[10px] bg-violet px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-deep"
      >
        + Nouvelle campagne
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/45 p-4 sm:p-12"
          onClick={close}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-busy={step === 2 || submitting || researching}
            tabIndex={-1}
            className="w-full max-w-[980px] rounded-[18px] bg-white shadow-[0_30px_80px_rgba(25,23,49,.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <ModalHeader
              titleId={titleId}
              closeButtonRef={closeButtonRef}
              onClose={close}
              disabled={step === 2 || submitting || researching}
            />
            <StepRail step={step} />

            <p role="status" aria-live="polite" className="sr-only">
              {done
                ? "Campagne proposée, non lancée."
                : step === 2
                  ? "Construction de la proposition en cours."
                  : submitting
                    ? "Ajout atomique de la proposition à votre file."
                    : message ?? ""}
            </p>

            <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
              {done ? (
                <DoneState
                  duplicate={done === "duplicate"}
                  actionId={actionId}
                  onClose={close}
                />
              ) : step === 1 ? (
                <CampaignBriefForm
                  draft={draft}
                  errors={errors}
                  idPrefix={titleId}
                  onChange={updateDraft}
                />
              ) : step === 2 ? (
                <BuildingState />
              ) : step === 3 && proposal ? (
                <CampaignProposalReview
                  brief={proposal.brief}
                  plan={proposal.plan}
                  evidence={proposal.evidence}
                  projection={proposal.projection}
                  studio={proposal.studio}
                  expectedFormats={proposal.expectedFormats}
                  generation={proposal.generation}
                  demo={proposal.demo}
                  onResearchBusyChange={setResearching}
                  onStudioChange={(studio) =>
                    setProposal((current) =>
                      current ? { ...current, studio } : current,
                    )
                  }
                />
              ) : step === 4 && proposal ? (
                <>
                  <CampaignProposalSummary
                    brief={proposal.brief}
                    plan={proposal.plan}
                    evidence={proposal.evidence}
                    projection={proposal.projection}
                    studio={proposal.studio}
                    expectedFormats={proposal.expectedFormats}
                  />
                  <CampaignGuards plan={proposal.plan} />
                </>
              ) : null}
              {message && (
                <p className="mt-4 rounded-[10px] bg-red-tint px-3 py-2.5 text-[12.5px] text-red">
                  {message}
                </p>
              )}
            </div>

            {!done && (
              <ModalFooter
                step={step}
                submitting={submitting}
                onCancel={close}
                onEditBrief={() => {
                  setProposal(null);
                  setStep(1);
                }}
                onBack={() => setStep(3)}
                onBuild={build}
                onGuards={reviewLimits}
                onSubmit={submit}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function submissionError(reason: string, detail?: string): string {
  if (reason === "forbidden") return "Votre rôle ne permet pas de gérer les campagnes.";
  if (reason === "invalid_studio") return detail ?? "La structure, l'allocation ou les hooks sont invalides.";
  if (reason === "invalid_brief") return "Le serveur a refusé le brief.";
  if (reason === "invalid_request_key") return "La clé de requête est invalide. Rouvrez la modale.";
  if (reason === "busy") return "Une autre mutation de cet environnement est en cours. Réessayez explicitement plus tard.";
  return "L'ajout n'a pas abouti. Aucun état partiel n'a été conservé.";
}

function ModalHeader({
  titleId,
  closeButtonRef,
  onClose,
  disabled,
}: {
  titleId: string;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft px-6 py-4">
      <h3 id={titleId} className="font-display text-[16px] font-semibold">
        Nouvelle campagne — l&apos;agent construit, vous arbitrez
      </h3>
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="px-2 text-[15px] text-muted hover:text-ink disabled:opacity-40"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
}

function StepRail({ step }: { step: number }) {
  return (
    <ol aria-label="Étapes de création" className="flex gap-1.5 overflow-x-auto border-b border-line-soft px-4 py-2.5 sm:px-6">
      {STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={step === index + 1 ? "step" : undefined}
          className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            step === index + 1
              ? "bg-tint text-violet-ink"
              : step > index + 1
                ? "text-green"
                : "text-faint"
          }`}
        >
          {index + 1} · {label}
        </li>
      ))}
    </ol>
  );
}

function BuildingState() {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-violet/20 border-t-violet motion-reduce:animate-none" />
      <p className="mt-3 text-[14px] font-semibold text-ink">Construction en cours…</p>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
        Lecture de la fenêtre publicitaire de 30 jours, vérification de la
        suffisance, dérivation du plan et un seul appel de rédaction borné.
        Aucun retry automatique et aucune recherche concurrentielle implicite.
      </p>
    </div>
  );
}

function DoneState({
  duplicate,
  actionId,
  onClose,
}: {
  duplicate: boolean;
  actionId: string | null;
  onClose: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <p className="text-[15px] font-semibold text-ink">
        {duplicate ? "Cette proposition est déjà dans votre file." : "Campagne proposée ✓"}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
        Une seule action et sa trace ont été conservées. Retrouvez-la dans « À
        valider » sur Aujourd&apos;hui. Aucune campagne, publication ou dépense
        n&apos;a été lancée.
      </p>
      {actionId && (
        <Link
          href={`/contenu?campagne=${actionId}`}
          onClick={onClose}
          className="mx-auto mt-5 inline-flex rounded-[10px] bg-[#8a232d] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#741d25]"
        >
          Créer le visuel de cette campagne
        </Link>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mx-auto mt-3 block text-[12px] font-semibold text-muted hover:text-ink"
      >
        Le faire plus tard
      </button>
    </div>
  );
}

function ModalFooter({
  step,
  submitting,
  onCancel,
  onEditBrief,
  onBack,
  onBuild,
  onGuards,
  onSubmit,
}: {
  step: number;
  submitting: boolean;
  onCancel: () => void;
  onEditBrief: () => void;
  onBack: () => void;
  onBuild: () => void;
  onGuards: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-4 sm:px-6">
      <button
        type="button"
        onClick={step === 3 ? onEditBrief : step === 4 ? onBack : onCancel}
        disabled={step === 2 || submitting}
        className="rounded-[9px] px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink disabled:opacity-50"
      >
        {step === 3 ? "Modifier le brief" : step === 4 ? "Retour" : "Annuler"}
      </button>
      {step === 1 && (
        <button type="button" onClick={onBuild} className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep">
          Construire la proposition
        </button>
      )}
      {step === 2 && <span className="text-[12px] text-muted">Construction…</span>}
      {step === 3 && (
        <button type="button" onClick={onGuards} className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep">
          Relire le récapitulatif
        </button>
      )}
      {step === 4 && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50"
        >
          {submitting ? "Ajout atomique…" : "Ajouter à ma file — sans lancer"}
        </button>
      )}
    </div>
  );
}
