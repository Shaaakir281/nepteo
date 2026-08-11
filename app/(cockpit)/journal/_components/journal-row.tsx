import {
  entryDetail,
  entrySource,
  journalEventLabel,
  type JournalEntry,
} from "@/lib/journal";

const absoluteTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const relativeTime = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function timeAgo(iso: string): string {
  const elapsedSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1_000);
  if (Math.abs(elapsedSeconds) < 60) return "à l’instant";
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) return relativeTime.format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return relativeTime.format(elapsedHours, "hour");
  return relativeTime.format(Math.round(elapsedHours / 24), "day");
}

export function JournalRow({ entry }: { entry: JournalEntry }) {
  const detail = entryDetail(entry);
  const payload = JSON.stringify(entry.payload ?? {}, null, 2);
  return (
    <details className="group border-t border-line-soft first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:content-none sm:px-[22px]">
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
            entry.actor === "agent"
              ? "bg-tint-soft text-muted"
              : "bg-tint text-violet-ink"
          }`}
        >
          {entry.actor === "agent" ? "Agent" : "Vous"}
        </span>
        <b className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
          {journalEventLabel(entry.event)}
        </b>
        <time
          dateTime={entry.created_at}
          title={absoluteTime.format(new Date(entry.created_at))}
          className="flex-none text-[11px] tabular-nums text-faint"
        >
          {timeAgo(entry.created_at)}
        </time>
      </summary>
      <div className="border-t border-line-soft bg-tint-soft px-4 py-3 text-[11.5px] leading-relaxed text-body sm:px-[22px]">
        <dl className="grid gap-1 sm:grid-cols-[110px_1fr]">
          <dt className="text-faint">Type technique</dt>
          <dd><code>{entry.event}</code></dd>
          <dt className="text-faint">Acteur</dt>
          <dd>{entrySource(entry)}</dd>
          {detail && (
            <>
              <dt className="text-faint">Résumé</dt>
              <dd>{detail}</dd>
            </>
          )}
          <dt className="text-faint">Charge utile</dt>
          <dd className="min-w-0">
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-[8px] border border-line bg-white p-2 font-mono text-[10.5px]">
              {payload}
            </pre>
          </dd>
        </dl>
      </div>
    </details>
  );
}
