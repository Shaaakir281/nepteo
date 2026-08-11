import Link from "next/link";

export function CreativeAuditUnavailable() {
  return (
    <details className="border-b border-line-soft bg-white px-1">
      <summary className="cursor-pointer py-3 text-[12.5px] font-semibold text-muted">
        Audit créatif indisponible
      </summary>
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-muted">
            Les lectures actuelles ne contiennent aucun identifiant creative,
            ad ou asset, ni métrique frequency. Les métriques agrégées de
            campagne ne constituent donc pas un audit de créatifs et aucune
            conclusion sur un contenu n&apos;est formulée.
          </p>
        </div>
        <Link
          href="/contenu"
          className="w-fit flex-none rounded-[9px] border border-line px-3.5 py-2 text-[11.5px] font-semibold text-body transition hover:bg-tint-soft hover:text-ink motion-reduce:transition-none"
        >
          Ouvrir Contenu
        </Link>
      </div>
    </details>
  );
}
