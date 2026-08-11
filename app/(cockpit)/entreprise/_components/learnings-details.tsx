export function LearningsDetails() {
  return (
    <details className="group border-b border-line-soft">
      <summary className="flex cursor-pointer items-center gap-3 px-1 py-3 text-[13px] font-semibold text-ink">
        <span aria-hidden="true" className="text-faint transition group-open:rotate-90">›</span>
        <span>Ce que Nepteo a appris</span>
        <b className="ml-auto rounded-full bg-tint-soft px-2 py-0.5 text-[11px] font-semibold text-muted">0</b>
      </summary>
      <p className="px-7 pb-4 text-[12px] leading-relaxed text-muted">
        Les observations arriveront avec vos données : délais de signature,
        meilleurs créneaux et segments les plus réceptifs. Elles resteront des
        hypothèses tant que vous ne les aurez pas confirmées.
      </p>
    </details>
  );
}
