import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EVENT_LABELS, type JournalEntry } from "@/lib/journal";
import { JournalRow } from "./_components/journal-row";

const PAGE_SIZE = 50;

const SELECT =
  "rounded-[10px] border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-violet focus:outline-none";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; event?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = params.actor === "user" || params.actor === "agent" ? params.actor : undefined;
  const event = params.event && EVENT_LABELS[params.event] ? params.event : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("journal")
    .select("id, event, actor, actor_id, payload, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (actor) query = query.eq("actor", actor);
  if (event) query = query.eq("event", event);

  const { data, count } = await query;
  const entries = (data ?? []) as JournalEntry[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Regroupement par jour
  const days: { label: string; items: JournalEntry[] }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.created_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(e);
    else days.push({ label, items: [e] });
  }

  const pageLink = (p: number) => {
    const q = new URLSearchParams();
    if (actor) q.set("actor", actor);
    if (event) q.set("event", event);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/journal${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Journal</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Chaque lecture, décision et action — de l&apos;agent comme de votre
          équipe — est enregistrée ici. Rien ne s&apos;efface, rien ne se
          modifie : c&apos;est votre trace de confiance.
        </p>
      </div>

      {/* Filtres */}
      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2.5">
        <select name="actor" defaultValue={actor ?? ""} className={SELECT}>
          <option value="">Tous les acteurs</option>
          <option value="user">Vous et votre équipe</option>
          <option value="agent">Agent Nepteo</option>
        </select>
        <select name="event" defaultValue={event ?? ""} className={SELECT}>
          <option value="">Tous les événements</option>
          {Object.entries(EVENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[10px] bg-tint px-4 py-2 text-[13px] font-semibold text-violet transition hover:bg-violet hover:text-white"
        >
          Filtrer
        </button>
        {(actor || event) && (
          <Link
            href="/journal"
            className="text-[12.5px] font-medium text-muted hover:text-ink"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
          <h3 className="font-display text-[15px] font-semibold">
            Journal de l&apos;agent
          </h3>
          <span className="text-[12px] text-muted">
            {count ?? 0} événement{(count ?? 0) > 1 ? "s" : ""}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="px-[22px] py-10 text-center text-[13px] text-muted">
            Aucun événement ne correspond à ces filtres.
          </div>
        ) : (
          days.map((day) => (
            <div key={day.label}>
              <div className="border-t border-line-soft bg-tint-soft px-[22px] py-2 text-[11px] font-semibold uppercase tracking-[.08em] text-faint first:border-t-0">
                {day.label}
              </div>
              {day.items.map((e) => (
                <JournalRow key={e.id} entry={e} />
              ))}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="font-semibold text-violet hover:underline">
              ← Plus récents
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageLink(page + 1)} className="font-semibold text-violet hover:underline">
              Plus anciens →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </>
  );
}
