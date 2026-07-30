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
import { CoachBubble } from "@/components/ui/coach-bubble";

/** Chaque onglet garde l'introduction de l'écran dont il vient. */
const INTRO: Record<TabId, string> = {
  identite:
    "C'est la mémoire de Nepteo : tout ce qu'il sait pour personnaliser ses recommandations. Plus elle est juste, meilleures sont les propositions — chaque élément est modifiable et s'applique immédiatement.",
  connecteurs:
    "Nepteo lit vos outils pour comprendre, et n'écrira que ce que vous validez. Chaque accès est tracé dans le journal et révocable à tout moment.",
  agent:
    "Vous gardez la main. L'agent ne fait rien que vous n'ayez autorisé, et rien ne part à l'extérieur en mode sûr.",
};

export default async function EntreprisePage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; saved?: string; error?: string }>;
}) {
  const { onglet, saved, error } = await searchParams;
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  const canEdit = membership.canEdit;
  const canManageDemo = membership.role === "admin";

  const tab = resolveTab(onglet);

  return (
    <>
      {/* La bulle suit l'onglet : celle de l'agent parlait des garde-fous. */}
      <CoachBubble id={tab === "agent" ? "agent" : "entreprise"} />
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Mon entreprise
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          {INTRO[tab]}
        </p>
      </div>

      <EntrepriseTabs active={tab} />

      {error && (
        <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}

      {tab === "identite" && <IdentityPanel canEdit={canEdit} saved={saved} />}
      {tab === "connecteurs" && (
        <ConnectorsPanel
          canEdit={canEdit}
          canViewConnectorConfig={membership.canViewFinancials}
          canManageDemo={canManageDemo}
          orgId={membership.organizationId}
          saved={saved}
        />
      )}
      {tab === "agent" && <AgentPanel canEdit={canEdit} />}
    </>
  );
}
