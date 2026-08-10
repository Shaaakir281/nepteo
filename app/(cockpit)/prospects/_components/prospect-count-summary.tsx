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
    <div className="flex items-baseline gap-2">
      <strong className="font-display text-[28px] font-semibold tabular-nums text-ink">
        {total.toLocaleString("fr-FR")}
      </strong>
      <span className="text-[13px] text-muted">
        contacts · {relaunchable.toLocaleString("fr-FR")} relançables
      </span>
      <span className="group relative inline-flex">
        <span
          tabIndex={0}
          role="note"
          aria-label="Expliquer les deux comptages"
          aria-describedby={helpId}
          className="grid h-5 w-5 cursor-help place-items-center rounded-full border border-line bg-white text-[11px] font-semibold text-muted outline-none focus:border-violet focus:text-violet"
        >
          ?
        </span>
        <span
          id={helpId}
          className="pointer-events-none invisible absolute left-0 top-7 z-20 w-[min(34rem,calc(100vw-2rem))] rounded-[13px] border border-line bg-white p-4 text-[12px] font-normal leading-relaxed text-body opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <b className="mb-1 block font-semibold text-ink">Deux comptages, deux usages</b>
          {explanation}
        </span>
      </span>
    </div>
  );
}
