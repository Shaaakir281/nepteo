import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dedupeByEmail } from "@/lib/dedupe-prospects";
import {
  ProspectsBoard,
  type BoardProspect,
  type StageGroup,
} from "./_components/prospects-board";

const NO_STAGE = "Sans statut";

export default async function ProspectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, count } = await supabase
    .from("prospects")
    .select("id, name, email, company, stage", { count: "exact" })
    .order("synced_at", { ascending: false })
    .limit(500);
  // Dédup à l'affichage : une même personne lue par deux connecteurs (ex. Sheets
  // + Notion) ne doit pas compter double. Lecture seule, rien n'est écrit en base.
  const rawRows = (data ?? []) as BoardProspect[];
  const prospects = dedupeByEmail(rawRows);
  const maskedDupes = rawRows.length - prospects.length;

  // Regroupement par statut, colonnes ordonnées par effectif décroissant.
  const byStage = new Map<string, BoardProspect[]>();
  for (const p of prospects) {
    const s = (p.stage ?? "").trim() || NO_STAGE;
    let list = byStage.get(s);
    if (!list) {
      list = [];
      byStage.set(s, list);
    }
    list.push(p);
  }
  const groups: StageGroup[] = [...byStage.entries()]
    .map(([stage, list]) => ({ stage, prospects: list }))
    .sort((a, b) => b.prospects.length - a.prospects.length);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Prospects</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Vos contacts regroupés par statut, en lecture seule depuis vos outils
          connectés.
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
          <ProspectsBoard groups={groups} total={prospects.length} />
          <p className="mt-3 text-[12px] text-faint">
            {prospects.length} prospect{prospects.length > 1 ? "s" : ""} au total
            {maskedDupes > 0 &&
              ` · ${maskedDupes} doublon${maskedDupes > 1 ? "s" : ""} d'email masqué${maskedDupes > 1 ? "s" : ""}`}
            {(count ?? 0) > 500 && " · 500 lignes brutes affichées"}.
          </p>
        </>
      )}
    </>
  );
}
