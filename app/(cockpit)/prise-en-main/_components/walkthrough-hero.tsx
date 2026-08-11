import Link from "next/link";

export function WalkthroughHero({
  stage,
  stageTitle,
  title,
  goal,
  action,
  href,
  canAct,
  unavailableLabel,
  onLaunch,
  onSkip,
}: {
  stage: number;
  stageTitle: string;
  title: string;
  goal: string;
  action: string;
  href: string;
  canAct: boolean;
  unavailableLabel?: string;
  onLaunch: () => void;
  onSkip: () => void;
}) {
  const goalId = "walkthrough-current-goal";

  return (
    <section className="mt-5 rounded-[18px] border border-line-soft bg-white p-5 shadow-card sm:p-7">
      <div
        role="progressbar"
        aria-label={`Étape ${stage} sur 5`}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={stage}
        className="flex gap-1.5"
      >
        {[1, 2, 3, 4, 5].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < stage
                ? "bg-green"
                : index === stage
                  ? "bg-violet"
                  : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[.08em] text-violet-ink">
        Étape {stage} sur 5 · {stageTitle}
      </p>
      <h2
        aria-describedby={goalId}
        className="mt-2 font-display text-[23px] font-medium tracking-tight text-ink sm:text-[28px]"
      >
        {title}
      </h2>
      <p id={goalId} className="sr-only">
        {goal}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {canAct ? (
          <Link
            href={href}
            onClick={onLaunch}
            className="rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep"
          >
            {action}
          </Link>
        ) : (
          <span className="text-[12px] font-semibold text-muted">
            {unavailableLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="text-[12px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Passer
        </button>
      </div>
    </section>
  );
}
