import Link from "next/link";

export type ProspectView = "all" | "relaunchable" | "dormant";

const FILTERS: Array<{ value: ProspectView; label: string; title?: string }> = [
  { value: "all", label: "Tous" },
  { value: "relaunchable", label: "Relançables" },
  { value: "dormant", label: "Dormants", title: "Silence d’au moins 30 jours" },
];

export function ProspectFilters({ active }: { active: ProspectView }) {
  return (
    <nav aria-label="Filtrer les prospects" className="flex flex-wrap gap-1.5">
      {FILTERS.map((filter) => {
        const selected = active === filter.value;
        const href = filter.value === "all" ? "/prospects" : `/prospects?view=${filter.value}`;
        return (
          <Link
            key={filter.value}
            href={href}
            title={filter.title}
            aria-current={selected ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
              selected
                ? "border-violet bg-tint text-violet-ink"
                : "border-line bg-white text-muted hover:bg-tint-soft hover:text-ink"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
}
