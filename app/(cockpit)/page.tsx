import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  entryDetail,
  entryTitle,
  type JournalEntry,
} from "@/lib/journal";
import { EDIT_ROLES } from "@/lib/memory";
import {
  ValidationQueue,
  type QueueAction,
} from "./_components/validation-queue";

const KPIS = [
  { label: "Dépenses", hint: "publicité & campagnes" },
  { label: "Prospects", hint: "nouveaux ce mois-ci" },
  { label: "Ventes", hint: "opportunités gagnées" },
  { label: "Revenu", hint: "attribué au marketing" },
];

export default async function TodayPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal")
    .select("id, event, actor, actor_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  const journal = (data ?? []) as JournalEntry[];

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  const canEdit = EDIT_ROLES.includes(membership?.role ?? "");

  const { data: queueRows } = await supabase
    .from("actions")
    .select(
      "id, title, finding, rationale, data_sources, expected_impact, confidence, risk",
    )
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(5);
  const queue = (queueRows ?? []) as QueueAction[];

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Bonjour</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Nepteo apprend votre entreprise. Complétez la{" "}
          <Link href="/entreprise" className="font-semibold text-violet hover:underline">
            mémoire de l&apos;agent
          </Link>{" "}
          — vos données réelles apparaîtront ici dès le premier connecteur.
        </p>
      </div>

      {/* KPIs — en attente de données */}
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {KPIS.map((k) => (
          <div
            key={k.label}
            className="rounded-[13px] border border-line-soft bg-white p-4 shadow-card"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
              {k.label}
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold text-faint">
              —
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted">{k.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] text-faint">
        En attente d&apos;un premier connecteur — vos chiffres s&apos;afficheront
        automatiquement.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {/* File de validation */}
        <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">
              À valider
            </h3>
            <span className="text-[12px] text-muted">
              L&apos;agent propose, vous décidez
            </span>
          </div>
          <ValidationQueue actions={queue} canEdit={canEdit} />
        </div>

        {/* Journal */}
        <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
            <h3 className="font-display text-[15px] font-semibold">Journal</h3>
            <Link
              href="/journal"
              className="text-[12px] font-semibold text-violet hover:underline"
            >
              Voir tout →
            </Link>
          </div>
          {journal.length > 0 ? (
            <ul>
              {journal.map((j) => (
                <li
                  key={j.id}
                  className="flex items-start gap-3 border-t border-line-soft px-[22px] py-3 first:border-t-0"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                      j.actor === "agent" ? "bg-faint" : "bg-violet"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">
                      {entryTitle(j)}
                      {entryDetail(j) && (
                        <span className="text-muted"> · {entryDetail(j)}</span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-faint">
                      {fmt.format(new Date(j.created_at))} ·{" "}
                      {j.actor === "agent" ? "Agent" : "Vous"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-[22px] py-8 text-center text-[12.5px] text-muted">
              Aucun événement pour l&apos;instant.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
