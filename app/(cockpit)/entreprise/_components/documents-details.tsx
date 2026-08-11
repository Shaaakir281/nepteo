import Link from "next/link";

export function DocumentsDetails({
  canEdit,
  researchEnabled,
}: {
  canEdit: boolean;
  researchEnabled: boolean;
}) {
  return (
    <details className="group border-b border-line-soft">
      <summary className="flex cursor-pointer items-center gap-3 px-1 py-3 text-[13px] font-semibold text-ink">
        <span aria-hidden="true" className="text-faint transition group-open:rotate-90">›</span>
        <span>Documents &amp; sources</span>
        <b className="ml-auto rounded-full bg-tint-soft px-2 py-0.5 text-[11px] font-semibold text-muted">0</b>
      </summary>
      <div className="px-7 pb-4">
        <p className="text-[12px] text-muted">
          Tester un site public sans rien enregistrer, y compris pendant un
          scénario d&apos;exemple.
        </p>
        {researchEnabled && canEdit && (
          <Link
            href="/entreprise/laboratoire-web"
            className="mt-3 inline-flex rounded-[9px] border border-line bg-white px-3 py-2 text-[12px] font-semibold text-body hover:border-violet/30 hover:text-violet-ink"
          >
            Ouvrir le laboratoire web
          </Link>
        )}
      </div>
    </details>
  );
}
