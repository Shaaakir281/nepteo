import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { readDemoPresentation } from "@/lib/demo/presentation";
import { walkthroughContextCompletion } from "@/lib/memory-completion";
import { readMemory } from "@/lib/memory-store";
import {
  isWalkthroughPath,
  isWalkthroughScenario,
} from "@/lib/onboarding/walkthrough";
import { WalkthroughCenter } from "./_components/walkthrough-center";

export default async function WalkthroughPage({
  searchParams,
}: {
  searchParams: Promise<{ depart?: string; scenario?: string }>;
}) {
  const { depart, scenario } = await searchParams;
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const [demo, memory] = await Promise.all([
    readDemoPresentation(membership.organizationId),
    readMemory(supabase, ["activite", "zone", "ton", "philosophie"]),
  ]);

  return (
    <WalkthroughCenter
      initialPath={isWalkthroughPath(depart) ? depart : undefined}
      initialScenario={
        isWalkthroughScenario(scenario) ? scenario : undefined
      }
      demoPresentation={demo.presentation}
      organizationName={membership.organizationName ?? "Mon entreprise"}
      canManageDemo={membership.role === "admin"}
      contextCompletion={walkthroughContextCompletion(memory)}
    />
  );
}
