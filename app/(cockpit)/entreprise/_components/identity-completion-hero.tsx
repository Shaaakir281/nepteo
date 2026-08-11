import Link from "next/link";
import { icons } from "@/components/icons";

export function IdentityCompletionHero({
  completed,
  canAnalyzeWebsite,
  researchEnabled,
  exampleMode,
  guided,
}: {
  completed: number;
  canAnalyzeWebsite: boolean;
  researchEnabled: boolean;
  exampleMode: boolean;
  guided: boolean;
}) {
  const percent = Math.round((completed / 8) * 100);

  return (
    <section className="mb-5 flex flex-wrap items-center gap-5 rounded-[18px] border border-line-soft bg-white px-5 py-5 shadow-card sm:px-6">
      <div
        role="progressbar"
        aria-label={`Fiche entreprise : ${completed} champs sur 8`}
        aria-valuemin={0}
        aria-valuemax={8}
        aria-valuenow={completed}
        className="grid h-[74px] w-[74px] flex-none place-items-center rounded-full"
        style={{
          background: `radial-gradient(circle, white 62%, transparent 64%), conic-gradient(var(--violet) ${percent}%, var(--tint) 0)`,
        }}
      >
        <b className="font-display text-[16px] font-semibold text-ink">
          {completed}/8
        </b>
      </div>
      <div className="min-w-[220px] flex-1">
        <h2 className="font-display text-[20px] font-medium text-ink">
          {exampleMode
            ? "Fiche d'exemple complète."
            : completed === 8
              ? "Votre fiche est complète."
              : "Complétez votre fiche."}
        </h2>
        {exampleMode ? (
          <>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-muted">
              Le scénario a rempli ces 8 éléments. Pour votre entreprise,
              saisissez simplement l&apos;adresse du site : Nepteo propose la
              fiche et vous validez avant de l&apos;appliquer.
            </p>
            {guided && (
              <Link
                href="/prise-en-main"
                className="mt-3 inline-flex items-center rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep"
              >
                Continuer la prise en main
              </Link>
            )}
          </>
        ) : canAnalyzeWebsite ? (
          <Link
            href="/onboarding/identite"
            className="mt-3 inline-flex items-center gap-2 rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep"
          >
            {icons.search}
            Remplir depuis mon site
          </Link>
        ) : !researchEnabled ? (
          <p className="mt-2 text-[11.5px] text-muted">
            L’analyse de site n’est pas configurée.
          </p>
        ) : null}
      </div>
    </section>
  );
}
