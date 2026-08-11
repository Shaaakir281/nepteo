/** Ligne de mémoire : toute la ligne ouvre le formulaire quand elle est éditable. */
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
  const summary = (
    <>
      <span className="flex w-[130px] flex-none items-center gap-1.5 text-[12.5px] font-medium text-ink max-sm:w-[105px]">
        <span>{label}</span>
        {sub && (
          <span
            role="note"
            tabIndex={0}
            aria-label={`${label} : ${sub}`}
            title={sub}
            className="grid h-4 w-4 flex-none place-items-center rounded-full border border-line text-[9px] font-semibold text-faint outline-none focus:border-violet focus:text-violet"
          >
            ?
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-body">
        {value ?? <span className="text-faint">À compléter</span>}
      </span>
      {saved && (
        <span className="flex-none text-[11px] font-semibold text-green">
          Enregistré ✓
        </span>
      )}
      {canEdit && (
        <span
          aria-hidden="true"
          className="flex-none text-[17px] leading-none text-faint transition group-open:rotate-90"
        >
          ›
        </span>
      )}
    </>
  );

  if (!canEdit) {
    return (
      <div className="flex min-h-11 items-center gap-3 border-b border-line-soft px-1 py-2.5 last:border-b-0">
        {summary}
      </div>
    );
  }

  return (
    <details className="group border-b border-line-soft last:border-b-0">
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[9px] px-1 py-2.5 transition hover:bg-white hover:px-2">
        {summary}
      </summary>
      <div className="px-2 pb-5 pt-2 md:pl-[142px]">{children}</div>
    </details>
  );
}
