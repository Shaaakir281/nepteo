import {
  entryDetail,
  entrySource,
  entryTitle,
  type JournalEntry,
} from "@/lib/journal";

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Ligne du journal — pattern .jrow des maquettes (heure · point · texte + source). */
export function JournalRow({ entry }: { entry: JournalEntry }) {
  const detail = entryDetail(entry);
  return (
    <div className="flex items-start gap-3 border-t border-line-soft px-[22px] py-3 first:border-t-0">
      <span className="w-[42px] flex-none pt-px text-[12px] tabular-nums text-faint">
        {timeFmt.format(new Date(entry.created_at))}
      </span>
      <span
        className={`mt-[7px] h-[7px] w-[7px] flex-none rounded-full ${
          entry.actor === "agent" ? "bg-faint" : "bg-violet"
        }`}
      />
      <span className="min-w-0 flex-1 text-[13px] leading-[1.55] text-ink">
        <b className="font-semibold">{entryTitle(entry)}</b>
        {detail && <> — {detail}</>}
        <span className="mt-0.5 block text-[11px] text-faint">
          {entrySource(entry)}
        </span>
      </span>
    </div>
  );
}
