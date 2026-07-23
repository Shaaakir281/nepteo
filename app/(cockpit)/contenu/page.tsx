import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EDIT_ROLES } from "@/lib/memory";
import { CreativeWorkspace } from "./_components/creative-workspace";

export default async function ContenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const canEdit = EDIT_ROLES.includes(membership.role);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Contenu</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          L&apos;agent prépare un conseil créatif à partir de votre{" "}
          <Link href="/entreprise" className="font-semibold text-violet hover:underline">
            mémoire d&apos;entreprise
          </Link>{" "}
          : angles, accroches et brief prêts à transmettre. Aucun lancement, aucune
          dépense — juste du contenu que vous validez.
        </p>
      </div>

      <CreativeWorkspace canEdit={canEdit} />
    </>
  );
}
