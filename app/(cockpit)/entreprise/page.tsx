import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  EntrepriseTabs,
  resolveTab,
  type TabId,
} from "./_components/entreprise-tabs";
import { IdentityPanel } from "./_components/identity-panel";
import { ConnectorsPanel } from "./_components/connectors-panel";
import { AgentPanel } from "./_components/agent-panel";
import { readDemoPresentation } from "@/lib/demo/presentation";
import {
  isWalkthroughScenario,
  type WalkthroughScenario,
} from "@/lib/onboarding/walkthrough";

/** Les onglets secondaires gardent l'introduction de l'écran dont ils viennent. */
const INTRO: Record<Exclude<TabId, "identite">, string> = {
  connecteurs:
    "Nepteo lit vos outils pour comprendre, et n'écrira que ce que vous validez. Chaque accès est tracé dans le journal et révocable à tout moment.",
  agent:
    "Vous gardez la main. L'agent ne fait rien que vous n'ayez autorisé, et rien ne part à l'extérieur en mode sûr.",
};

export default async function EntreprisePage({
  searchParams,
}: {
  searchParams: Promise<{
    onglet?: string;
    saved?: string;
    error?: string;
    prise_en_main?: string;
    scenario?: string;
  }>;
}) {
  const { onglet, saved, error, prise_en_main, scenario } = await searchParams;
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  const canEdit = membership.canEdit;
  const canManageDemo = membership.role === "admin";
  const guidedScenario: WalkthroughScenario | undefined =
    prise_en_main === "1" && isWalkthroughScenario(scenario)
      ? scenario
      : undefined;

  const tab = resolveTab(onglet);
  // `hasDemoMarker` échoue prudemment à vrai si la preuve ne peut pas être
  // lue. Le layout appelle déjà cette primitive mise en cache : aucun second
  // inventaire n'est lancé dans la même requête RSC.
  const identityMutationBlocked =
    tab === "identite"
      ? (await readDemoPresentation(membership.organizationId)).hasDemoMarker
      : false;
  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Mon entreprise
        </h1>
        {tab !== "identite" && (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            {INTRO[tab]}
          </p>
        )}
      </div>

      <EntrepriseTabs active={tab} />

      {error && (
        <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}

      {tab === "identite" && (
        <IdentityPanel
          canEdit={canEdit}
          mutationBlockedByDemo={identityMutationBlocked}
          saved={saved}
        />
      )}
      {tab === "connecteurs" && (
        <ConnectorsPanel
          canEdit={canEdit}
          canViewConnectorConfig={membership.canViewFinancials}
          canManageDemo={canManageDemo}
          orgId={membership.organizationId}
          saved={saved}
          guidedScenario={guidedScenario}
        />
      )}
      {tab === "agent" && <AgentPanel canEdit={canEdit} />}
    </>
  );
}
