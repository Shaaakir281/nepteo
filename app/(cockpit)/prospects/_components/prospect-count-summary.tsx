export function ProspectCountSummary({
  total,
  relaunchable,
  explanation,
}: {
  total: number;
  relaunchable: number;
  explanation: React.ReactNode;
}) {
  const helpId = "prospect-count-help";
  return (
    <div className="relative flex items-baseline gap-2">
      <strong className="font-display text-[28px] font-semibold tabular-nums text-ink">
        {total.toLocaleString("fr-FR")}
      </strong>
      <span className="text-[13px] text-muted">
        contacts · {relaunchable.toLocaleString("fr-FR")} relançables
      </span>
      <span
        tabIndex={0}
        role="note"
        aria-label="Expliquer les deux comptages"
        aria-describedby={helpId}
        className="peer grid h-5 w-5 cursor-help place-items-center rounded-full border border-line bg-white text-[11px] font-semibold text-muted outline-none focus:border-violet focus:text-violet"
      >
        ?
      </span>
      <span
        id={helpId}
        className="pointer-events-none invisible absolute left-0 top-8 z-20 w-[min(34rem,calc(100vw-4rem))] rounded-[13px] border border-line bg-white p-4 text-[12px] font-normal leading-relaxed text-body opacity-0 shadow-card transition peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100"
      >
        <b className="mb-1 block font-semibold text-ink">Deux comptages, deux usages</b>
        {explanation}
      </span>
    </div>
  );
}
