import type { OutcomeSourceCounts, ValueRate } from "@/lib/value-scorecard-rules";

export function formatRate(value: ValueRate): string {
  if (value.percentage === null) return `— (${value.numerator}/${value.denominator})`;
  return `${value.percentage.toLocaleString("fr-FR")} % (${value.numerator}/${value.denominator})`;
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[11px] border border-line-soft bg-white px-3.5 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[.07em] text-faint">{label}</p>
      <p className="mt-1 font-display text-[19px] font-semibold text-ink">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

export function OutcomeMetric({
  label,
  counts,
}: {
  label: string;
  counts: OutcomeSourceCounts;
}) {
  const detail =
    counts.observed > 0
      ? `${counts.declared} déclaré(s) · ${counts.observed} observé(s) fournisseur`
      : `${counts.declared} déclaré(s) · aucun fait fournisseur observé`;
  return <Metric label={label} value={counts.total} detail={detail} />;
}

export function GateLine({
  label,
  current,
  target,
  met,
}: {
  label: string;
  current: string;
  target: string;
  met: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-line-soft py-2.5 first:border-t-0">
      <div>
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted">{current} · objectif {target}</p>
      </div>
      <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${met ? "bg-green-tint text-green" : "bg-tint text-violet"}`}>
        {met ? "Atteint" : "À poursuivre"}
      </span>
    </li>
  );
}
