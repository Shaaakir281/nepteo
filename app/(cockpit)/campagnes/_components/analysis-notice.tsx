import Link from "next/link";

export function AnalysisNotice({ proposed }: { proposed?: string }) {
  if (proposed === undefined) return null;
  if (proposed !== "err" && proposed !== "0" && !/^(?:[1-9]|1\d|20)$/.test(proposed)) {
    return null;
  }
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-tint-soft px-4 py-3">
      <span className="text-[13px] text-body">
        Signal de retour d&apos;analyse reçu ({proposed}). Seules les actions et
        leurs journaux enregistrés dans Aujourd&apos;hui font foi.
      </span>
      <Link href="/" className="rounded-[9px] border border-line px-3 py-1.5 text-[12px] font-semibold text-violet">
        Examiner sur Aujourd&apos;hui →
      </Link>
    </div>
  );
}
