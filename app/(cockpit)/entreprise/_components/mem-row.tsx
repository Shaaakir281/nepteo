/** Ligne de mémoire (label / valeur / Modifier) — pattern .mrow des maquettes. */
export function MemRow({
  label,
  value,
  sub,
  saved,
  canEdit,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: string;
  saved?: boolean;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-line-soft first:border-t-0">
      <summary
        className={`flex items-start gap-3 px-[22px] py-3.5 ${
          canEdit ? "cursor-pointer" : "pointer-events-none"
        }`}
      >
        <span className="w-[110px] flex-none pt-[3px] text-[11px] font-semibold uppercase tracking-[.05em] text-faint">
          {label}
        </span>
        <span className="flex-1 text-[13.5px] font-medium leading-[1.55] text-ink">
          {value ?? <span className="font-normal text-faint">À compléter</span>}
          {sub && (
            <span className="mt-0.5 block text-[12px] font-normal text-muted">
              {sub}
            </span>
          )}
        </span>
        {saved && (
          <span className="flex-none pt-[3px] text-[11.5px] font-semibold text-green">
            Enregistré ✓
          </span>
        )}
        {canEdit && (
          <>
            <span className="flex-none rounded-[7px] bg-tint px-3 py-[5px] text-[12px] font-semibold text-violet group-open:hidden">
              Modifier
            </span>
            <span className="hidden flex-none rounded-[7px] bg-tint-soft px-3 py-[5px] text-[12px] font-semibold text-muted group-open:inline">
              Fermer
            </span>
          </>
        )}
      </summary>
      <div className="px-[22px] pb-5 md:pl-[132px]">{children}</div>
    </details>
  );
}
