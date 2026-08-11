import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { EVENT_LABELS, type JournalEntry } from "@/lib/journal";
import { JournalRow } from "./_components/journal-row";
import { PreparedOutbox } from "./_components/prepared-outbox";

const PAGE_SIZE = 50;

type ActorFilter = "user" | "agent" | undefined;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function journalHref({
  actor,
  event,
  page,
}: {
  actor?: ActorFilter;
  event?: string;
  page?: number;
}): string {
  const query = new URLSearchParams();
  if (actor) query.set("actor", actor);
  if (event) query.set("event", event);
  if (page && page > 1) query.set("page", String(page));
  const value = query.toString();
  return `/journal${value ? `?${value}` : ""}`;
}

function ActorFilters({ actor, event }: { actor: ActorFilter; event?: string }) {
  const filters: Array<{ value: ActorFilter; label: string }> = [
    { value: undefined, label: "Tout" },
    { value: "user", label: "Vous" },
    { value: "agent", label: "Agent" },
  ];
  return (
    <nav aria-label="Filtrer le journal par acteur" className="flex flex-wrap gap-1.5">
      {filters.map((filter) => {
        const selected = actor === filter.value;
        return (
          <Link
            key={filter.label}
            href={journalHref({ actor: filter.value, event })}
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

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; event?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor: ActorFilter =
    params.actor === "user" || params.actor === "agent" ? params.actor : undefined;
  const event = params.event && EVENT_LABELS[params.event] ? params.event : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (membership.role === "commercial") redirect("/");

  let query = supabase
    .from("journal")
    .select("id, event, actor, actor_id, payload, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (actor) query = query.eq("actor", actor);
  if (event) query = query.eq("event", event);

  const { data, count } = await query;
  const entries = (data ?? []) as JournalEntry[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const days: Array<{ label: string; items: JournalEntry[] }> = [];
  for (const entry of entries) {
    const label = dayLabel(entry.created_at);
    const last = days.at(-1);
    if (last?.label === label) last.items.push(entry);
    else days.push({ label, items: [entry] });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Journal</h1>
        <ActorFilters actor={actor} event={event} />
      </div>

      <details className="mb-4 rounded-[13px] border border-line-soft bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[12px] font-semibold text-body marker:content-none">
          <span>Filtrer par type d&apos;événement</span>
          <span className="text-faint">{event ? EVENT_LABELS[event] : "tous"}</span>
        </summary>
        <form method="GET" className="flex flex-wrap items-center gap-2 border-t border-line-soft px-4 py-3">
          {actor && <input type="hidden" name="actor" value={actor} />}
          <select
            name="event"
            defaultValue={event ?? ""}
            aria-label="Type d’événement"
            className="min-w-56 rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] text-ink focus:border-violet focus:outline-none"
          >
            <option value="">Tous les événements</option>
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12px] font-semibold text-body hover:bg-tint-soft">
            Appliquer
          </button>
          {event && (
            <Link href={journalHref({ actor })} className="text-[12px] font-medium text-muted hover:text-ink">
              Réinitialiser
            </Link>
          )}
        </form>
      </details>

      <PreparedOutbox />

      <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3 sm:px-[22px]">
          <h2 className="font-display text-[14px] font-semibold">Événements</h2>
          <span className="text-[12px] tabular-nums text-muted">
            {(count ?? 0).toLocaleString("fr-FR")}
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">
            Aucun événement ne correspond à ces filtres.
          </p>
        ) : (
          days.map((day) => (
            <section key={day.label}>
              <h3 className="border-t border-line-soft bg-tint-soft px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint first:border-t-0 sm:px-[22px]">
                {day.label}
              </h3>
              {day.items.map((entry) => <JournalRow key={entry.id} entry={entry} />)}
            </section>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          {page > 1 ? (
            <Link href={journalHref({ actor, event, page: page - 1 })} className="font-semibold text-violet hover:underline">← Plus récents</Link>
          ) : <span />}
          <span className="text-muted">Page {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={journalHref({ actor, event, page: page + 1 })} className="font-semibold text-violet hover:underline">Plus anciens →</Link>
          ) : <span />}
        </div>
      )}

      <p className="mt-3 text-[11px] text-faint">Rien n&apos;est effacé de ce journal.</p>
    </>
  );
}
