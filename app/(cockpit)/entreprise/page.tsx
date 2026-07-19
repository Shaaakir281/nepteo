import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { icons } from "@/components/icons";
import { EDIT_ROLES, type MemoryContent } from "@/lib/memory";
import { IdentityCard } from "./_components/identity-card";
import { OffersCard } from "./_components/offers-card";
import { DocumentsCard, LearningsCard } from "./_components/side-cards";

export default async function EntreprisePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
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

  const { data: rows } = await supabase
    .from("company_memory")
    .select("section, content");
  const mem: Partial<MemoryContent> = {};
  for (const r of rows ?? []) {
    (mem as Record<string, unknown>)[r.section] = r.content ?? {};
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Votre entreprise
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          C&apos;est la <b className="text-ink">mémoire de Nepteo</b> : tout ce
          qu&apos;il sait pour personnaliser ses recommandations. Plus elle est
          juste, meilleures sont les propositions — chaque élément est
          modifiable et s&apos;applique immédiatement.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-[18px] border border-line bg-gradient-to-b from-[#fbfbff] to-[#f4f3fc] px-5 py-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-line bg-white text-violet">
          {icons.bulb}
        </span>
        <div>
          <h4 className="font-display text-[13.5px] font-semibold">
            Remplissez ce que vous savez, comme vous le diriez à un client
          </h4>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">
            Pas besoin des bons termes marketing. Nepteo enrichira ensuite
            cette mémoire avec ce qu&apos;il observe dans vos données — et vous
            garderez le dernier mot sur chaque apprentissage.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}
      {!canEdit && (
        <p className="mb-4 rounded-[10px] bg-tint-soft px-4 py-2.5 text-[13px] text-muted">
          Lecture seule — votre rôle ne permet pas la modification.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <IdentityCard mem={mem} canEdit={canEdit} saved={saved} />
          <OffersCard
            offers={mem.offres?.items ?? []}
            canEdit={canEdit}
            saved={saved === "offres"}
          />
        </div>
        <div className="space-y-4">
          <DocumentsCard />
          <LearningsCard />
        </div>
      </div>
    </>
  );
}
