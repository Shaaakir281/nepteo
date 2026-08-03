import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { readDemoPresentation } from "@/lib/demo/presentation";
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
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const demo = await readDemoPresentation(membership.organizationId);

  return (
    <WalkthroughCenter
      initialPath={isWalkthroughPath(depart) ? depart : undefined}
      initialScenario={
        isWalkthroughScenario(scenario) ? scenario : undefined
      }
      demoPresentation={demo.presentation}
      organizationName={membership.organizationName ?? "Mon entreprise"}
      canManageDemo={membership.role === "admin"}
    />
  );
}
