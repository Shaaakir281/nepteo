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
        <h1 className="text-[22px] font-semibold tracking-tight">Que dit ce site de l&apos;entreprise ?</h1>
      </div>

      <details className="mt-3 max-w-3xl text-[11.5px] text-muted">
        <summary className="cursor-pointer font-semibold text-body">Coût, usage et conservation</summary>
        <p className="mt-2 leading-relaxed">La recherche exige une confirmation, journalise l’usage et ses sources, puis conserve le résultat au plus 30 jours. L’analyse reste séparée de la fiche jusqu’à une application explicite, section par section. Aucun envoi, campagne ou déploiement n’est déclenché ici.</p>
      </details>

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
