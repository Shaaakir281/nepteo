import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { researchConfigured } from "@/lib/research/provider";
import { readResearchQuota } from "@/lib/research/research";
import { createAdminClient } from "@/lib/supabase/admin";
import { WebsitePreviewLab } from "./_components/website-preview-lab";

export default async function WebsitePreviewPage() {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const researchEnabled = researchConfigured();
  const initialQuota = membership.canEdit
    ? await readResearchQuota(createAdminClient(), membership.organizationId)
    : null;

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
        <b>Zone sans effet sur la mémoire.</b> Rien n&apos;est appliqué à votre
        fiche, même pendant un scénario d&apos;exemple. Aucun envoi, aucune
        campagne et aucun déploiement ne sont déclenchés ici.
      </div>

      <WebsitePreviewLab
        canEdit={membership.canEdit}
        researchEnabled={researchEnabled}
        initialQuota={initialQuota}
      />
    </>
  );
}
