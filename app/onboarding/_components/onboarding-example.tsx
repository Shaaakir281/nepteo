"use client";

import type { ReactNode } from "react";
import { useRef, useState, useTransition } from "react";
import { icons } from "@/components/icons";
import type { StartExampleResult } from "../example-actions";
import { DemoIdentityProgress } from "./demo-identity-progress";
import { OnboardingBackButton } from "./onboarding-back-button";
import type { ScenarioChoice } from "./onboarding-types";

const SCENARIO_VIEW: Record<
  ScenarioChoice["id"],
  { context: string; icon: ReactNode }
> = {
  artisan: {
    context: "Artisan · particuliers · bouche-à-oreille",
    icon: icons.house,
  },
  agence: {
    context: "Agence B2B · cycle long · relances",
    icon: icons.people,
  },
  ecommerce: {
    context: "E-commerce · gros volume · publicité",
    icon: icons.send,
  },
};

function failureMessage(result: Extract<StartExampleResult, { ok: false }>) {
  if (result.reason === "already_configured") {
    return "Un espace existe déjà pour ce compte.";
  }
  if (result.reason === "busy") {
    return "Une autre opération est en cours. Réessayez dans un instant.";
  }
  if (result.reason === "unsafe_existing_data") {
    return "Nepteo a bloqué le chargement pour protéger les données présentes.";
  }
  return result.organizationCreated
    ? "Nepteo n’a pas pu confirmer la fin du chargement."
    : "Le scénario n’a pas pu démarrer. Réessayez.";
}

export function OnboardingExample({
  action,
  onBack,
  scenarios,
}: {
  action: (scenarioId: string) => Promise<StartExampleResult>;
  onBack: () => void;
  scenarios: ScenarioChoice[];
}) {
  const [selected, setSelected] = useState<ScenarioChoice | null>(null);
  const [result, setResult] = useState<StartExampleResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const launchStarted = useRef(false);

  function launch(scenario: ScenarioChoice) {
    if (launchStarted.current) return;
    launchStarted.current = true;
    setSelected(scenario);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await action(scenario.id));
      } catch {
        // Une coupure réseau peut masquer un succès serveur : on ne relance
        // jamais à l'aveugle et on conduit vers l'espace protégé.
        setResult({
          ok: false,
          reason: "load_failed",
          organizationCreated: true,
        });
      }
    });
  }

  if (selected) {
    const failed = result && !result.ok ? result : null;
    return (
      <DemoIdentityProgress
        scenario={selected}
        status={isPending || !result ? "loading" : result.ok ? "loaded" : "error"}
        error={failed ? failureMessage(failed) : undefined}
        organizationCreated={failed?.organizationCreated ?? false}
        onBack={() => {
          launchStarted.current = false;
          setSelected(null);
        }}
      />
    );
  }

  return (
    <div>
      <OnboardingBackButton onClick={onBack} />
      <h1 className="text-[21px] font-normal leading-[1.3] tracking-tight">
        Quelle entreprise voulez-vous explorer ?
      </h1>
      <p className="mt-2 text-[12px] text-muted">
        Un clic lance la démonstration fictive, sans utiliser vos données.
      </p>

      <div className="mt-5 space-y-2" aria-label="Scénarios de démonstration">
        {scenarios.map((item) => {
          const view = SCENARIO_VIEW[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => launch(item)}
              className="flex w-full items-center gap-3.5 rounded-[13px] border border-line bg-white px-4 py-3.5 text-left transition hover:border-violet hover:ring-[3px] hover:ring-violet/10"
            >
              <span
                aria-hidden="true"
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-tint text-violet"
              >
                {view.icon}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[14px] font-semibold text-ink">
                  {item.orgName}
                </b>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {view.context}
                </span>
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-violet">
                Explorer →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
