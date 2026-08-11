"use client";

import { useState } from "react";
import type { StartExampleResult } from "../example-actions";
import { OnboardingChoice } from "./onboarding-choice";
import { OnboardingExample } from "./onboarding-example";
import { OnboardingReal } from "./onboarding-real";
import type { ScenarioChoice } from "./onboarding-types";

export function GuidedOnboarding({
  action,
  exampleAction,
  error,
  philosophyMax,
  scenarios,
}: {
  action: (formData: FormData) => Promise<void>;
  exampleAction: (scenarioId: string) => Promise<StartExampleResult>;
  error?: string;
  philosophyMax: number;
  scenarios: ScenarioChoice[];
}) {
  const [screen, setScreen] = useState<"choice" | "example" | "real">(
    error ? "real" : "choice",
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
        action={exampleAction}
        onBack={() => setScreen("choice")}
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
