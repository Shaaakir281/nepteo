import type { WalkthroughScenario } from "@/lib/onboarding/walkthrough";

export interface ScenarioChoice {
  id: WalkthroughScenario;
  label: string;
  pitch: string;
  orgName: string;
  identity: { label: string; value: string }[];
}
