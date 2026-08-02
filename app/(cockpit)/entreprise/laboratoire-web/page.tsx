import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { isDemoModeOrMutationActive } from "@/lib/demo/isolation";
import { researchConfigured } from "@/lib/research/provider";
import { readResearchQuota } from "@/lib/research/research";
import {
  WEBSITE_PREVIEW_MEMORY_SECTIONS,
  readWebsitePreviewCurrentProfile,
} from "@/lib/research/website-preview-apply-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { WebsitePreviewLab } from "./_components/website-preview-lab";

async function readApplicationContext(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
) {
  const [initialQuota, memoryResult, scenarioState] = await Promise.all([
    readResearchQuota(admin, organizationId),
    admin
      .from("company_memory")
      .select("section, content")
      .eq("organization_id", organizationId)
      .in("section", [...WEBSITE_PREVIEW_MEMORY_SECTIONS]),
    isDemoModeOrMutationActive(admin, organizationId).catch(() => null),
  ]);
  return {
    initialQuota,
    currentProfile: readWebsitePreviewCurrentProfile(
      memoryResult.data
        ? Object.fromEntries(
            memoryResult.data.map((row) => [row.section, row.content]),
          )
        : {},
    ),
    applicationBlocked: scenarioState === true,
    applicationContextAvailable:
      !memoryResult.error && scenarioState !== null,
  };
}

export default async function WebsitePreviewPage() {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const researchEnabled = researchConfigured();
  const admin = membership.canEdit ? createAdminClient() : null;
  const applicationContext = admin
    ? await readApplicationContext(admin, membership.organizationId)
    : {
        initialQuota: null,
        currentProfile: {},
        applicationBlocked: false,
        applicationContextAvailable: false,
      };

  return (
    <>
      <Link
        href="/entreprise?onglet=identite"
        className="text-[12.5px] font-semibold text-violet hover:underline"
      >
        ← Retour à Mon entreprise
      </Link>
      <div className="mt-4 max-w-3xl">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Laboratoire d&apos;enrichissement web
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Testez votre site ou un autre site public, un domaine à la fois. Le
          résultat reste une analyse de test séparée de la fiche entreprise.
        </p>
      </div>

      <div className="mt-5 rounded-[13px] border border-violet/20 bg-tint px-4 py-3 text-[12.5px] leading-relaxed text-body">
        <b>L&apos;analyse seule reste sans effet sur la mémoire.</b> Après le
        résultat, une application séparée exige une revue section par section
        et reste bloquée pendant un scénario d&apos;exemple. Aucun envoi, aucune
        campagne et aucun déploiement ne sont déclenchés ici.
      </div>

      <WebsitePreviewLab
        canEdit={membership.canEdit}
        researchEnabled={researchEnabled}
        initialQuota={applicationContext.initialQuota}
        currentProfile={applicationContext.currentProfile}
        applicationBlocked={applicationContext.applicationBlocked}
        applicationContextAvailable={applicationContext.applicationContextAvailable}
      />
    </>
  );
}
