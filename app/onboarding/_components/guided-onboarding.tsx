"use client";

import { useState } from "react";
import type { WalkthroughScenario } from "@/lib/onboarding/walkthrough";
import { OnboardingChoice } from "./onboarding-choice";
import { OnboardingExample } from "./onboarding-example";
import { OnboardingReal } from "./onboarding-real";
import type { ScenarioChoice } from "./onboarding-types";

export function GuidedOnboarding({
  action,
  error,
  philosophyMax,
  scenarios,
}: {
  action: (formData: FormData) => Promise<void>;
  error?: string;
  philosophyMax: number;
  scenarios: ScenarioChoice[];
}) {
  const [screen, setScreen] = useState<"choice" | "example" | "real">(
    error ? "real" : "choice",
  );
  const [scenario, setScenario] = useState<WalkthroughScenario>(
    scenarios[0]?.id ?? "artisan",
  );

  if (screen === "choice") {
    return (
      <OnboardingChoice
        onChooseExample={() => setScreen("example")}
        onChooseReal={() => setScreen("real")}
      />
    );
  }

  if (screen === "example") {
    return (
      <OnboardingExample
        action={action}
        onBack={() => setScreen("choice")}
        onScenarioChange={setScenario}
        scenario={scenario}
        scenarios={scenarios}
      />
    );
  }

  return (
    <OnboardingReal
      action={action}
      error={error}
      onBack={() => setScreen("choice")}
      philosophyMax={philosophyMax}
    />
  );
}
