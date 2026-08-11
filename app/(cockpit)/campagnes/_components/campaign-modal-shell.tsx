"use client";

import Link from "next/link";

export function ModalHeader({
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
        Nouvelle campagne
      </h3>
      <button ref={closeButtonRef} type="button" onClick={onClose} disabled={disabled} className="px-2 text-[15px] text-muted hover:text-ink disabled:opacity-40" aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}

export function StepRail({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="border-b border-line-soft px-6 py-3" aria-label={`Étape ${step} sur 3`}>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-muted">Étape {step} sur 3</span>
        <span className="flex flex-1 gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((item) => (
            <i key={item} className={`h-1 flex-1 rounded-full ${item <= step ? "bg-violet" : "bg-line-soft"}`} />
          ))}
        </span>
      </div>
    </div>
  );
}

export function BuildingState() {
  return (
    <div className="py-8 text-center">
      <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-violet/20 border-t-violet motion-reduce:animate-none" />
      <p className="mt-3 text-[14px] font-semibold text-ink">Construction en cours…</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted">
        Nepteo vérifie les données disponibles puis prépare une proposition.
        Un seul appel de rédaction, sans nouvel essai automatique.
      </p>
    </div>
  );
}

export function DoneState({
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
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted">
        Retrouvez-la dans « À valider ». Aucune campagne, publication ou dépense
        n&apos;a été lancée.
      </p>
      {actionId && (
        <Link href={`/contenu?campagne=${actionId}`} onClick={onClose} className="mx-auto mt-5 inline-flex rounded-[10px] bg-[#8a232d] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#741d25]">
          Créer le visuel de cette campagne
        </Link>
      )}
      <button type="button" onClick={onClose} className="mx-auto mt-3 block text-[12px] font-semibold text-muted hover:text-ink">
        Le faire plus tard
      </button>
    </div>
  );
}

export function ModalFooter({
  step,
  busy,
  onCancel,
  onEditBrief,
  onBuild,
  onSubmit,
}: {
  step: 1 | 2;
  busy: boolean;
  onCancel: () => void;
  onEditBrief: () => void;
  onBuild: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft px-4 py-4 sm:px-6">
      {step === 1 ? (
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-[9px] border border-line px-4 py-2.5 text-[13px] font-semibold text-body disabled:opacity-50">
            Fermer
          </button>
          <button type="button" onClick={onBuild} disabled={busy} className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50">
            {busy ? "Construction…" : "Construire la proposition"}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onSubmit} disabled={busy} className="rounded-[10px] bg-violet px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50">
            {busy ? "Ajout…" : "Ajouter à la file"}
          </button>
          <button type="button" onClick={onEditBrief} disabled={busy} className="rounded-[9px] border border-line px-4 py-2.5 text-[13px] font-semibold text-body disabled:opacity-50">
            Modifier le brief
          </button>
          <span className="text-[10.5px] text-faint">Validée ≠ lancée</span>
        </>
      )}
    </div>
  );
}
