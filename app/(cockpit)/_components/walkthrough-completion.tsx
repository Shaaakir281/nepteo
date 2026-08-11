"use client";

import { useEffect } from "react";
import { completeWalkthroughMissions } from "@/lib/onboarding/walkthrough-client";

export function WalkthroughCompletion({ missions }: { missions: string[] }) {
  useEffect(() => {
    completeWalkthroughMissions(missions);
  }, [missions]);

  return null;
}
