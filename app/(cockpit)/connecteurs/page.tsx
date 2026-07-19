import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { icons } from "@/components/icons";
import { CONNECTOR_CATALOG } from "@/lib/connectors";
import { EDIT_ROLES } from "@/lib/memory";
import {
  ConnectorCard,
  type ConnectorStatus,
} from "./_components/connector-card";

export default async function ConnecteursPage({
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
    .from("connectors")
    .select("provider, status, config");

  const statusOf = (provider: string): ConnectorStatus => {
    const row = rows?.find((r) => r.provider === provider);
    if (!row) return "available";
    if (row.status === "connected") return "connected";
    if ((row.config as { requested?: boolean } | null)?.requested)
      return "requested";
    return "available";
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Connecteurs
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Nepteo <b className="text-ink">lit</b> vos outils pour comprendre, et
          n&apos;écrira que ce que vous validez. Chaque accès est tracé dans le
          journal et révocable à tout moment.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-[13px] border border-line bg-tint-soft px-4 py-3 text-[12.5px] leading-relaxed text-body">
        <span className="mt-0.5 flex-none">{icons.info}</span>
        <span>
          Les connexions ouvrent <b>progressivement</b>. Cliquez «&nbsp;Connecter&nbsp;»
          sur les outils que vous utilisez : votre demande est enregistrée et
          vous serez prévenu dès que le branchement est prêt — les plus
          demandés arrivent en premier.
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">
          {error}
        </p>
      )}

      {CONNECTOR_CATALOG.map((group) => (
        <section key={group.title} className="mb-7">
          <div className="mb-3">
            <h3 className="font-display text-[15px] font-semibold">
              {group.title}
            </h3>
            <p className="text-[12.5px] text-muted">{group.sub}</p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => (
              <ConnectorCard
                key={tool.provider}
                tool={tool}
                status={statusOf(tool.provider)}
                canEdit={canEdit}
                justRequested={saved === tool.provider}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
        Vous pouvez utiliser Nepteo sans connexion : le cockpit s&apos;appuie
        d&apos;abord sur votre mémoire d&apos;entreprise. Chaque outil connecté
        enrichira ensuite les recommandations.
      </p>
    </>
  );
}
