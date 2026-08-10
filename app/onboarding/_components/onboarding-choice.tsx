import { icons } from "@/components/icons";
import { ONBOARDING_CHOICE_COPY as copy } from "./onboarding-choice-copy";

export function OnboardingChoice({
  onChooseExample,
  onChooseReal,
}: {
  onChooseExample: () => void;
  onChooseReal: () => void;
}) {
  return (
    <div>
      <h1 className="text-[25px] font-normal leading-[1.3] tracking-tight">
        {copy.title}
      </h1>

      <div className="mt-6 grid gap-2.5">
        <button
          type="button"
          onClick={onChooseExample}
          className="flex w-full items-center gap-4 rounded-[14px] border border-violet/45 bg-gradient-to-b from-white to-tint-soft px-4 py-4 text-left transition hover:border-violet hover:shadow-card"
        >
          <span
            aria-hidden="true"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-tint text-violet"
          >
            {icons.sparkle}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block font-display text-[15.5px] font-semibold text-ink">
              {copy.example.title}
            </b>
            <span className="mt-0.5 block text-[12px] text-muted">
              {copy.example.description}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-tint-soft px-2.5 py-1 text-[11px] font-semibold text-faint">
            {copy.example.duration}
          </span>
        </button>

        <button
          type="button"
          onClick={onChooseReal}
          className="flex w-full items-center gap-4 rounded-[14px] border border-line bg-white px-4 py-4 text-left transition hover:border-violet hover:shadow-card"
        >
          <span
            aria-hidden="true"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-tint text-violet"
          >
            {icons.house}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block font-display text-[15.5px] font-semibold text-ink">
              {copy.real.title}
            </b>
            <span className="mt-0.5 block text-[12px] text-muted">
              {copy.real.description}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-tint-soft px-2.5 py-1 text-[11px] font-semibold text-faint">
            {copy.real.duration}
          </span>
        </button>
      </div>

      <p className="mt-[22px] text-center text-[11.5px] text-faint">
        <b className="font-semibold text-green">✓ {copy.safeLabel}</b> —{" "}
        {copy.safeDetail}
      </p>
    </div>
  );
}
