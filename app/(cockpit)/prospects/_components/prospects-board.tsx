/** Vue Prospects — funnel + kanban par statut, fidèle à docs/maquettes/. */
import { prospectPriority, type PriorityTier } from "@/lib/analysis-rules";

export interface BoardProspect {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  stage: string | null;
}

export interface StageGroup {
  stage: string;
  prospects: BoardProspect[];
}

const CARDS_PER_COLUMN = 8;

/** Repère de priorité — même définition que le moteur d'analyse (données réelles). */
const TIER_BADGE: Record<PriorityTier, string> = {
  priority: "bg-tint text-violet-ink",
  incomplete: "bg-amber-tint text-amber",
  paused: "bg-tint-soft text-muted",
};
const TIER_LABEL: Record<PriorityTier, string> = {
  priority: "À relancer en priorité",
  incomplete: "Fiche à compléter",
  paused: "En veille",
};
const TIER_RANK: Record<PriorityTier, number> = {
  priority: 0,
  incomplete: 1,
  paused: 2,
};

function initials(p: BoardProspect): string {
  const base = (p.name ?? p.email ?? "?").trim();
  const words = base.split(/\s+/).filter(Boolean);
  const raw =
    words.length >= 2 ? words[0][0] + words[1][0] : base.slice(0, 2);
  return raw.toUpperCase();
}

export function ProspectsBoard({
  groups,
  total,
}: {
  groups: StageGroup[];
  total: number;
}) {
  // Résumé de priorité, calculé sur toute la base (statut + complétude).
  const tierCounts: Record<PriorityTier, number> = {
    priority: 0,
    incomplete: 0,
    paused: 0,
  };
  for (const g of groups)
    for (const p of g.prospects) tierCounts[prospectPriority(p).tier]++;

  return (
    <>
      {/* Résumé de priorité — signal transparent, tous statuts confondus */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["priority", "incomplete", "paused"] as PriorityTier[]).map((t) => (
          <span
            key={t}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold ${TIER_BADGE[t]}`}
          >
            {TIER_LABEL[t]}
            <span className="tabular-nums">{tierCounts[t]}</span>
          </span>
        ))}
      </div>

      {/* Funnel — répartition réelle par statut */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const share =
            total > 0 ? Math.round((g.prospects.length / total) * 100) : 0;
          return (
            <div
              key={g.stage}
              className="relative min-w-[130px] flex-1 rounded-[13px] border border-line-soft bg-white px-3.5 py-3"
            >
              <div className="font-display text-[20px] font-semibold leading-none text-ink">
                {g.prospects.length}
              </div>
              <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-faint">
                {g.stage}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {share} % de la base
              </div>
            </div>
          );
        })}
      </div>

      {/* Board — une colonne par statut, cartes prioritaires en tête */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {groups.map((g) => {
          const ordered = [...g.prospects].sort(
            (a, b) =>
              TIER_RANK[prospectPriority(a).tier] -
              TIER_RANK[prospectPriority(b).tier],
          );
          return (
            <div
              key={g.stage}
              className="w-[260px] flex-none rounded-[13px] border border-line-soft bg-[#f0eff8] p-2.5"
            >
              <div className="flex items-center justify-between px-2 pb-2.5 pt-1 text-[12px] font-semibold text-body">
                <span>{g.stage}</span>
                <span className="grid h-5 min-w-[20px] place-items-center rounded-full border border-line bg-white px-1.5 text-[11px] font-semibold text-muted">
                  {g.prospects.length}
                </span>
              </div>
              <div className="space-y-2">
                {ordered.slice(0, CARDS_PER_COLUMN).map((p) => {
                  const pr = prospectPriority(p);
                  return (
                    <div
                      key={p.id}
                      className="rounded-[10px] border border-line bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(25,23,49,.04)]"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-tint font-display text-[10.5px] font-semibold text-violet-ink">
                          {initials(p)}
                        </span>
                        <h5 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                          {p.name ?? "—"}
                        </h5>
                      </div>
                      <div className="text-[11.5px] leading-relaxed text-muted">
                        {p.company ? `${p.company} · ` : ""}
                        {p.email ?? (
                          <span className="text-red">email manquant</span>
                        )}
                      </div>
                      <div className="mt-2">
                        <span
                          title={pr.reason}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TIER_BADGE[pr.tier]}`}
                        >
                          {pr.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {g.prospects.length > CARDS_PER_COLUMN && (
                  <p className="px-1 pt-0.5 text-[11.5px] text-muted">
                    + {g.prospects.length - CARDS_PER_COLUMN} autre
                    {g.prospects.length - CARDS_PER_COLUMN > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 max-w-2xl text-[11.5px] leading-relaxed text-faint">
        « À relancer en priorité » se calcule à partir du statut et de la
        complétude de la fiche (email, entreprise) — aucun score, uniquement vos
        données.
      </p>
    </>
  );
}
