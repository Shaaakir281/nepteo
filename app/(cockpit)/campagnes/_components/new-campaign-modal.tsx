"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { validateCampaignBrief, type CampaignValidationErrors } from "@/lib/campaign-plan";
import { validateCampaignStudioIntent } from "@/lib/campaign-studio";
import type { CampaignBriefDefaults } from "@/lib/campaign-brief-defaults";
import { buildCampaignAction, submitCampaignAction, type CampaignBuild } from "../actions";
import { CampaignBriefForm, EMPTY_CAMPAIGN_BRIEF, campaignBriefInput, type CampaignBriefDraft } from "./campaign-brief-form";
import { CampaignProposalReview } from "./campaign-proposal-review";
import { BuildingState, DoneState, ModalFooter, ModalHeader, StepRail } from "./campaign-modal-shell";

export function NewCampaignModal({
  initialDraft = EMPTY_CAMPAIGN_BRIEF,
}: {
  initialDraft?: CampaignBriefDefaults;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<CampaignBriefDraft>(initialDraft);
  const [errors, setErrors] = useState<CampaignValidationErrors>({});
  const [proposal, setProposal] = useState<CampaignBuild | null>(null);
  const [requestKey, setRequestKey] = useState("");
  const [building, setBuilding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [researching, setResearching] = useState(false);
  const [done, setDone] = useState<"created" | "duplicate" | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const busy = building || submitting || researching;

  const reset = useCallback(() => {
    setStep(1);
    setDraft({ ...initialDraft });
    setErrors({});
    setProposal(null);
    setRequestKey("");
    setBuilding(false);
    setSubmitting(false);
    setResearching(false);
    setDone(null);
    setActionId(null);
    setMessage(null);
  }, [initialDraft]);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    reset();
  }, [busy, reset]);

  function show() {
    reset();
    setRequestKey(crypto.randomUUID());
    setOpen(true);
  }

  useDialogFocus({ open, onClose: close, dialogRef, initialFocusRef: closeButtonRef, returnFocusRef: triggerRef });

  function updateDraft(patch: Partial<CampaignBriefDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(patch)) delete next[field as keyof CampaignValidationErrors];
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
    setBuilding(true);
    try {
      const result = await buildCampaignAction(input);
      if (!result.ok) {
        if (result.errors) setErrors(result.errors);
        setMessage(buildError(result.reason));
        return;
      }
      setProposal(result.build);
      setStep(2);
    } finally {
      setBuilding(false);
    }
  }

  async function submit() {
    if (!proposal || !requestKey || submitting) return;
    const studioValidation = validateCampaignStudioIntent(proposal.studio);
    if (!studioValidation.ok) {
      setMessage(studioValidation.issues[0]?.message ?? "La proposition doit être corrigée.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitCampaignAction(proposal.brief, proposal.studio, requestKey);
      if (result.ok) {
        setActionId(result.actionId);
        setDone(result.duplicate ? "duplicate" : "created");
        setStep(3);
        router.refresh();
      } else {
        if (result.errors) setErrors(result.errors);
        setMessage(submissionError(result.reason, result.message));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={show} className="rounded-[10px] bg-violet px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-deep">+ Nouvelle campagne</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/45 p-4 sm:p-12" onClick={close}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1} className="w-full max-w-[820px] rounded-[18px] bg-white shadow-[0_30px_80px_rgba(25,23,49,.3)]" onClick={(event) => event.stopPropagation()}>
            <ModalHeader titleId={titleId} closeButtonRef={closeButtonRef} onClose={close} disabled={busy} />
            <StepRail step={step} />
            <p role="status" aria-live="polite" className="sr-only">{done ? "Campagne proposée, non lancée." : building ? "Construction de la proposition en cours." : submitting ? "Ajout atomique de la proposition à votre file." : message ?? ""}</p>
            <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
              {done ? (
                <DoneState duplicate={done === "duplicate"} actionId={actionId} onClose={close} />
              ) : building ? (
                <BuildingState />
              ) : step === 1 ? (
                <CampaignBriefForm draft={draft} errors={errors} idPrefix={titleId} onChange={updateDraft} />
              ) : proposal ? (
                <CampaignProposalReview {...proposal} onResearchBusyChange={setResearching} onStudioChange={(studio) => setProposal((current) => current ? { ...current, studio } : current)} />
              ) : null}
              {message && <p className="mt-4 rounded-[10px] bg-red-tint px-3 py-2.5 text-[12.5px] text-red">{message}</p>}
            </div>
            {!done && !building && <ModalFooter step={step === 1 ? 1 : 2} busy={busy} onCancel={close} onEditBrief={() => { setProposal(null); setStep(1); }} onBuild={build} onSubmit={submit} />}
          </div>
        </div>
      )}
    </>
  );
}

function buildError(reason: string): string {
  if (reason === "forbidden") return "Votre rôle ne permet pas de gérer les campagnes.";
  if (reason === "invalid_brief") return "Le serveur a refusé le brief. Vérifiez les champs signalés.";
  return "La construction n'a pas abouti. Aucun nouvel essai automatique n'a été lancé.";
}

function submissionError(reason: string, detail?: string): string {
  if (reason === "forbidden") return "Votre rôle ne permet pas de gérer les campagnes.";
  if (reason === "invalid_studio") return detail ?? "La structure, l'allocation ou les hooks sont invalides.";
  if (reason === "invalid_brief") return "Le serveur a refusé le brief.";
  if (reason === "invalid_request_key") return "La clé de requête est invalide. Rouvrez la modale.";
  if (reason === "busy") return "Une autre mutation est en cours. Réessayez explicitement plus tard.";
  return "L'ajout n'a pas abouti. Aucun état partiel n'a été conservé.";
}
