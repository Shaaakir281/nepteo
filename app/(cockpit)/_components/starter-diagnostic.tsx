import Link from "next/link";
import type { StarterDiagnostic } from "@/lib/diagnostic";

/**
 * Le diagnostic de départ — la première expertise de l'agent, avant tout
 * connecteur. Rendu partagé par l'accueil (`/`, base vide) et « Plan du mois »
 * (`/plan`, tant qu'aucune donnée n'est branchée) : un seul rendu, donc les
 * deux écrans ne peuvent pas diverger.
 *
 * Composant SERVEUR (aucun état, aucun effet) — ne pas y ajouter "use client".
 * L'en-tête de page reste à l'appelant : les deux écrans n'ont pas le même titre.
 */
export function StarterDiagnosticCard({
  diagnostic,
}: {
  diagnostic: StarterDiagnostic;
}) {
  return (
    <>
      <div className="mb-4 rounded-[18px] border border-line-soft bg-gradient-to-br from-tint-soft to-white p-5 shadow-card">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-violet text-[12px] font-bold text-white">
            N
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-violet-ink">
            Diagnostic de départ
          </span>
        </div>
        <p className="text-[14px] leading-relaxed text-ink">{diagnostic.intro}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          {diagnostic.basis}
        </p>
      </div>

      <div className="space-y-3">
        {diagnostic.channels.map((c, i) => (
          <div
            key={c.channel}
            className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card"
          >
            <div className="flex items-start gap-3.5">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-tint font-display text-[13px] font-bold text-violet-ink">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-[14.5px] font-semibold text-ink">
                    {c.channel}
                  </h3>
                  {c.alreadyDoing && (
                    <span className="rounded-full bg-green-tint px-2.5 py-0.5 text-[11px] font-semibold text-green">
                      Vous le faites déjà
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-body">
                  {c.why}
                </p>
                <p className="mt-2 rounded-[10px] bg-tint-soft px-3.5 py-2 text-[12.5px] leading-relaxed text-ink">
                  <b>Premier geste :</b> {c.firstStep}
                </p>
                <p className="mt-1.5 text-[11.5px] text-faint">
                  Effort {c.effort.toLowerCase()} · {c.cost}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card">
          <h3 className="font-display text-[14px] font-semibold text-ink">
            Cette semaine
          </h3>
          <ol className="mt-2 space-y-1.5">
            {diagnostic.firstWeek.map((step) => (
              <li
                key={step}
                className="flex gap-2 text-[12.5px] leading-relaxed text-body"
              >
                <span className="text-violet">→</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[16px] border border-line-soft bg-white p-4 shadow-card">
          <h3 className="font-display text-[14px] font-semibold text-ink">
            Ce qu&apos;il vaut mieux éviter pour l&apos;instant
          </h3>
          <ul className="mt-2 space-y-1.5">
            {diagnostic.avoid.map((a) => (
              <li
                key={a}
                className="flex gap-2 text-[12.5px] leading-relaxed text-body"
              >
                <span className="text-red">×</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line-soft bg-tint-soft/50 px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-body">
          Ce diagnostic vient de votre fiche entreprise. Corrigez-la et il
          change ; branchez vos outils et il devient un plan chiffré.
        </p>
        <div className="flex flex-none gap-2">
          <Link
            href="/entreprise"
            className="rounded-[9px] bg-tint px-3 py-1.5 text-[12px] font-semibold text-violet transition hover:bg-violet hover:text-white"
          >
            Corriger ma fiche
          </Link>
          <Link
            href="/entreprise?onglet=connecteurs"
            className="rounded-[9px] bg-violet px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep"
          >
            Brancher mes outils
          </Link>
        </div>
      </div>
    </>
  );
}
