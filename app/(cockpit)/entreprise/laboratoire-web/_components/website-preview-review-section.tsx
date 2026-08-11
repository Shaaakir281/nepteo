import type { WebsitePreviewCurrentProfile, WebsitePreviewMemorySection } from "@/lib/research/website-preview-apply-rules";

export function currentSummary(
  section: WebsitePreviewMemorySection,
  current: WebsitePreviewCurrentProfile,
): string {
  if (section === "activite" && current.activite) {
    return [current.activite.activity_type, current.activite.audience, current.activite.description].filter(Boolean).join(" · ");
  }
  if (section === "zone") return current.zone?.text ?? "Aucune donnée";
  if (section === "ton") return current.ton?.text ?? "Aucune donnée";
  if (section === "canaux") return current.canaux?.list.join(", ") ?? "Aucune donnée";
  if (section === "offres") return current.offres?.items.map((offer) => offer.name).join(", ") ?? "Aucune donnée";
  return current.presence?.list.join(" · ") ?? "Aucune donnée";
}

export function WebsitePreviewReviewSection({
  section,
  title,
  selected,
  current,
  onToggle,
  children,
}: {
  section: WebsitePreviewMemorySection;
  title: string;
  selected: boolean;
  current: string;
  onToggle: (section: WebsitePreviewMemorySection) => void;
  children: React.ReactNode;
}) {
  const hasCurrent = current !== "Aucune donnée" && current.trim().length > 0;
  return (
    <section className={`rounded-[11px] border px-3.5 py-3 ${selected ? "border-violet bg-tint-soft" : "border-line-soft bg-white"}`}>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-[12.5px] font-semibold text-ink">
          <input type="checkbox" checked={selected} onChange={() => onToggle(section)} className="accent-violet" />
          {title}
          <span className="sr-only">Appliquer cette section</span>
        </label>
        <span className="rounded-full bg-white px-2 py-1 text-[10.5px] font-semibold text-muted">{hasCurrent ? "rempli → remplacé" : "vide → proposé"}</span>
      </div>
      <details className="mt-2 text-[11.5px] text-muted">
        <summary className="cursor-pointer font-semibold">Comparer et corriger</summary>
        <p className="mt-2 leading-relaxed"><b>Fiche actuelle :</b> {current}</p>
        <p className="mt-2 font-semibold uppercase tracking-wide">Proposition à relire</p>
        {children}
      </details>
    </section>
  );
}
