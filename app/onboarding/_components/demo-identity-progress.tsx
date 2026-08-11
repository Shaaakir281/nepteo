"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScenarioChoice } from "./onboarding-types";

export function DemoIdentityProgress({
  scenario,
  status,
  error,
  organizationCreated,
  onBack,
}: {
  scenario: ScenarioChoice;
  status: "loading" | "loaded" | "error";
  error?: string;
  organizationCreated: boolean;
  onBack: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (status !== "loaded") return;
    const timers = scenario.identity.map((_, index) =>
      window.setTimeout(() => setVisibleCount(index + 1), 150 * (index + 1)),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [scenario, status]);

  const completed = status === "loaded" ? visibleCount : 0;
  const ready = completed === scenario.identity.length;

  return (
    <section aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet">
            {status === "loading"
              ? "Nepteo analyse"
              : status === "loaded"
                ? `Identité construite · ${completed}/8`
                : "Chargement interrompu"}
          </p>
          <h1 className="mt-1 font-display text-[21px] font-medium text-ink">
            {scenario.orgName}
          </h1>
        </div>
        <span className="rounded-full bg-amber-tint px-2.5 py-1 text-[10.5px] font-semibold text-amber">
          Démonstration fictive · aucun site consulté
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {scenario.identity.map((item, index) => {
          const visible = index < completed;
          return (
            <div
              key={item.label}
              className={`min-w-0 rounded-[11px] border px-3 py-2.5 transition-all duration-300 ${
                visible
                  ? "border-green/20 bg-green-tint"
                  : "border-line-soft bg-tint-soft/45"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
                <span
                  aria-hidden="true"
                  className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${
                    visible
                      ? "bg-green text-white"
                      : status === "loading"
                        ? "animate-pulse bg-line"
                        : "bg-line-soft"
                  }`}
                >
                  {visible ? "✓" : ""}
                </span>
                {item.label}
              </span>
              <p
                className={`mt-1 truncate text-[11.5px] font-medium transition-opacity ${
                  visible ? "text-ink opacity-100" : "text-faint opacity-45"
                }`}
                title={visible ? item.value : undefined}
              >
                {visible ? item.value : "En attente…"}
              </p>
            </div>
          );
        })}
      </div>

      {status === "loading" && (
        <div className="mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-tint">
            <span className="block h-full w-2/3 animate-pulse rounded-full bg-violet" />
          </div>
          <p className="mt-2 text-[11.5px] text-muted">
            Nepteo vérifie l’espace, installe les données d’exemple puis lance
            l’analyse.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-5 rounded-[11px] bg-red-tint px-3.5 py-3 text-[12px] text-red">
          <p className="font-semibold">{error}</p>
          {organizationCreated ? (
            <Link
              href="/entreprise?onglet=connecteurs"
              className="mt-2 inline-flex font-semibold underline underline-offset-4"
            >
              Ouvrir l’espace protégé
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="mt-2 font-semibold underline underline-offset-4"
            >
              Choisir un autre scénario
            </button>
          )}
        </div>
      )}

      {ready && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11.5px] font-medium text-green">
            La fiche est prête. Nepteo peut maintenant expliquer ses priorités.
          </p>
          <Link
            href={`/prise-en-main?depart=example&scenario=${scenario.id}`}
            className="rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep"
          >
            Commencer la prise en main →
          </Link>
        </div>
      )}
    </section>
  );
}
