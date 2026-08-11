import type { ReactNode } from "react";
import { icons } from "@/components/icons";
import type { WalkthroughScenario } from "@/lib/onboarding/walkthrough";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingSubmitButton } from "./onboarding-submit-button";
import type { ScenarioChoice } from "./onboarding-types";

const SCENARIO_VIEW: Record<
  WalkthroughScenario,
  { label: string; context: string; icon: ReactNode }
> = {
  artisan: {
    label: "Menuiserie Dubreuil",
    context: "Artisan · particuliers · bouche-à-oreille",
    icon: icons.house,
  },
  agence: {
    label: "Atelier Northwind",
    context: "Agence B2B · cycle long · relances",
    icon: icons.people,
  },
  ecommerce: {
    label: "Racines & Co",
    context: "E-commerce · gros volume · publicité",
    icon: icons.send,
  },
};

export function OnboardingExample({
  action,
  onBack,
  onScenarioChange,
  scenario,
  scenarios,
}: {
  action: (formData: FormData) => Promise<void>;
  onBack: () => void;
  onScenarioChange: (scenario: WalkthroughScenario) => void;
  scenario: WalkthroughScenario;
  scenarios: ScenarioChoice[];
}) {
  return (
    <div>
      <OnboardingBackButton onClick={onBack} />
      <h1 className="text-[21px] font-normal leading-[1.3] tracking-tight">
        Quelle entreprise vous ressemble le plus ?
      </h1>

      <div className="mt-5 space-y-2" role="radiogroup" aria-label="Scénario">
        {scenarios.map((item) => {
          const selected = item.id === scenario;
          const view = SCENARIO_VIEW[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onScenarioChange(item.id)}
              className={`flex w-full items-center gap-3.5 rounded-[13px] border px-4 py-3.5 text-left transition ${
                selected
                  ? "border-violet bg-white ring-[3px] ring-violet/10"
                  : "border-line bg-white hover:border-violet/40"
              }`}
            >
              <span
                aria-hidden="true"
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-tint text-violet"
              >
                {view.icon}
              </span>
              <span className="min-w-0">
                <b className="block text-[14px] font-semibold text-ink">
                  {view.label}
                </b>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {view.context}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <form action={action} className="mt-5">
        <input type="hidden" name="name" value="Espace découverte Nepteo" />
        <input type="hidden" name="onboarding_path" value="example" />
        <input type="hidden" name="scenario" value={scenario} />
        <OnboardingSubmitButton>
          Créer l’espace de découverte
        </OnboardingSubmitButton>
      </form>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        Le scénario ne se charge qu’après une confirmation explicite.
      </p>
    </div>
  );
}
