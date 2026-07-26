import { createClient } from "@/lib/supabase/server";
import { icons } from "@/components/icons";
import { CONNECTOR_CATALOG } from "@/lib/connectors";
import {
  ConnectorCard,
  type ConnectorStatus,
} from "../../connecteurs/_components/connector-card";

/**
 * Onglet « Connecteurs » — repris tel quel de l'ancienne page `/connecteurs`,
 * qui redirige désormais ici. Les fiches de configuration par outil restent sur
 * `/connecteurs/<provider>` : ce sont des sous-écrans, pas une entrée de menu.
 */
export async function ConnectorsPanel({
  canEdit,
  saved,
}: {
  canEdit: boolean;
  saved?: string;
}) {
  const supabase = await createClient();
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
      <div className="mb-5 flex items-start gap-2.5 rounded-[13px] border border-line bg-tint-soft px-4 py-3 text-[12.5px] leading-relaxed text-body">
        <span className="mt-0.5 flex-none">{icons.info}</span>
        <span>
          Les connexions ouvrent <b>progressivement</b>. Cliquez «&nbsp;Connecter&nbsp;»
          sur les outils que vous utilisez : votre demande est enregistrée et
          vous serez prévenu dès que le branchement est prêt — les plus
          demandés arrivent en premier.
        </span>
      </div>

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
