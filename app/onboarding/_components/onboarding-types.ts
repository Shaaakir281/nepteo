import type { WalkthroughScenario } from "@/lib/onboarding/walkthrough";

export interface ScenarioChoice {
  id: WalkthroughScenario;
  label: string;
  pitch: string;
}
