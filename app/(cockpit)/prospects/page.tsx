import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findTool } from "@/lib/connectors";

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export default async function ProspectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, count } = await supabase
    .from("prospects")
    .select("id, name, email, company, stage, source, synced_at", {
      count: "exact",
    })
    .order("synced_at", { ascending: false })
    .limit(200);
  const prospects = data ?? [];

  const byStage = new Map<string, number>();
  for (const p of prospects) {
    const s = (p.stage ?? "").trim() || "Sans statut";
    byStage.set(s, (byStage.get(s) ?? 0) + 1);
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Prospects</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Vos contacts lus depuis les outils connectés — un{" "}
          <b className="text-ink">prospect</b> est une personne intéressée mais
          pas encore cliente. Lecture seule : la source reste votre outil.
        </p>
      </div>

      {prospects.length === 0 ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-8 text-center shadow-card">
          <p className="text-[13.5px] font-medium text-ink">
            Aucun prospect pour l&apos;instant
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
            Connectez Google Sheets ou Notion puis lancez une synchronisation —
            vos contacts apparaîtront ici.
          </p>
          <Link
            href="/connecteurs"
            className="mt-4 inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
          >
            Ouvrir les connecteurs
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {[...byStage.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([stage, n]) => (
                <span
                  key={stage}
                  className="rounded-full bg-tint px-3.5 py-1.5 text-[12.5px] font-semibold text-violet-ink"
                >
                  {stage} · {n}
                </span>
              ))}
          </div>

          <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
              <h3 className="font-display text-[15px] font-semibold">
                Tous les prospects
              </h3>
              <span className="text-[12px] text-muted">
                {count ?? prospects.length} au total
                {(count ?? 0) > 200 && " · 200 affichés"}
              </span>
            </div>
            {prospects.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 border-t border-line-soft px-[22px] py-3 first:border-t-0"
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-tint font-display text-[11.5px] font-semibold text-violet-ink">
                  {(p.name ?? p.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {p.name ?? "—"}
                    {p.company && (
                      <span className="font-normal text-muted"> · {p.company}</span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {p.email ?? "email manquant"}
                  </span>
                </span>
                {p.stage && (
                  <span className="flex-none rounded-full bg-tint-soft px-2.5 py-1 text-[11.5px] font-semibold text-body">
                    {p.stage}
                  </span>
                )}
                <span className="hidden flex-none text-[11.5px] text-faint sm:block">
                  {findTool(p.source)?.name ?? p.source} ·{" "}
                  {fmt.format(new Date(p.synced_at))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
