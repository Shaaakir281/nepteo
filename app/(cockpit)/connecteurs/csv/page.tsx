import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  CSV_IMPORT_MAX_BYTES,
  CSV_IMPORT_MAX_ROWS,
} from "@/lib/connectors/csv";
import { readDemoModeMarkers } from "@/lib/demo/isolation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearCsvProspects, importCsvProspects } from "./actions";

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CsvConnectorPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}) {
  const params = await searchParams;
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const admin = createAdminClient();
  const connectorResult = membership.canViewFinancials
    ? await admin
        .from("connectors")
        .select("id, status, config")
        .eq("organization_id", membership.organizationId)
        .eq("provider", "csv")
        .maybeSingle()
    : await supabase
        .from("connectors")
        .select("id, status")
        .eq("organization_id", membership.organizationId)
        .eq("provider", "csv")
        .maybeSingle();
  const connector = connectorResult.data;
  const prospectCount = connector?.id
    ? (
        await supabase
          .from("prospects")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", membership.organizationId)
          .eq("connector_id", connector.id)
      ).count ?? 0
    : 0;
  const demo = await readDemoModeMarkers(admin, membership.organizationId);
  const config =
    connector &&
    "config" in connector &&
    connector.config &&
    typeof connector.config === "object" &&
    !Array.isArray(connector.config)
      ? (connector.config as Record<string, unknown>)
      : {};
  const fileName =
    typeof config.file_name === "string" ? config.file_name : undefined;
  const imported = one(params.imported);
  const ignored = Number(one(params.ignored) ?? "0");
  const cleared = one(params.cleared) === "1";
  const error = one(params.error);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/entreprise?onglet=connecteurs"
        className="text-[12.5px] font-semibold text-violet hover:underline"
      >
        ← Retour aux connecteurs
      </Link>

      <div className="mt-4 rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[21px] font-semibold text-ink">
              Importer les prospects du testeur
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Le CSV est une source fournie par le testeur. Ses lignes peuvent
              être réelles ou synthétiques ; Nepteo indique leur provenance
              sans la déduire automatiquement.
            </p>
          </div>
          {connector?.status === "connected" && (
            <span className="rounded-full bg-green-tint px-3 py-1 text-[11.5px] font-semibold text-green">
              {prospectCount} contact{prospectCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && (
          <p className="mt-5 rounded-[10px] bg-red-tint px-4 py-3 text-[12.5px] font-medium text-red">
            {error}
          </p>
        )}
        {imported && (
          <p className="mt-5 rounded-[10px] bg-green-tint px-4 py-3 text-[12.5px] font-medium text-green">
            {imported} contact{Number(imported) > 1 ? "s" : ""} importé
            {Number(imported) > 1 ? "s" : ""}
            {ignored > 0
              ? ` — ${ignored} ligne${ignored > 1 ? "s" : ""} sans nom ni email ignorée${ignored > 1 ? "s" : ""}.`
              : "."}
          </p>
        )}
        {cleared && (
          <p className="mt-5 rounded-[10px] bg-green-tint px-4 py-3 text-[12.5px] font-medium text-green">
            Import CSV retiré. Un scénario Nepteo peut maintenant être chargé
            si l&apos;espace ne contient aucune autre donnée ou outil à
            préserver.
          </p>
        )}
        {demo.active && (
          <p className="mt-5 rounded-[10px] bg-amber-tint px-4 py-3 text-[12.5px] leading-relaxed text-body">
            <b>Scénario Nepteo actif.</b> Retirez-le avant l&apos;import pour
            éviter tout mélange avec les données apportées par le testeur.
          </p>
        )}

        {fileName && (
          <div className="mt-5 rounded-[12px] border border-line-soft bg-tint-soft px-4 py-3 text-[12.5px] text-body">
            Import actuel : <b>{fileName}</b>. Un nouveau fichier remplacera
            uniquement cet import CSV ; les autres connecteurs ne seront pas
            modifiés.
          </div>
        )}

        <form action={importCsvProspects} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="csv"
              className="mb-2 block text-[13px] font-semibold text-ink"
            >
              Fichier CSV UTF-8
            </label>
            <input
              id="csv"
              name="csv"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={!membership.canEdit || demo.active}
              className="block w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-[12.5px] text-body file:mr-3 file:rounded-[7px] file:border-0 file:bg-tint file:px-3 file:py-1.5 file:font-semibold file:text-violet disabled:opacity-50"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              Jusqu&apos;à {CSV_IMPORT_MAX_ROWS.toLocaleString("fr-FR")} lignes
              et {Math.floor(CSV_IMPORT_MAX_BYTES / 1_000)} Ko. Virgule,
              point-virgule ou tabulation. En-têtes reconnus : nom, email,
              entreprise, statut, notes et dernier contact.
              Les autres colonnes sont ignorées et ne sont pas stockées.
            </p>
          </div>

          <label className="flex items-start gap-2.5 rounded-[10px] border border-line-soft bg-tint-soft px-3.5 py-3 text-[12px] leading-relaxed text-body">
            <input
              type="checkbox"
              name="data_authorized"
              required
              disabled={!membership.canEdit || demo.active}
              className="mt-0.5"
            />
            <span>
              Je confirme que ces données sont autorisées pour ce test et que
              le fichier ne contient que les colonnes utiles à l&apos;évaluation
              de Nepteo. Les six champs reconnus peuvent alimenter les analyses ;
              le nom, l&apos;entreprise, le statut et les notes peuvent aussi
              alimenter les brouillons générés avec le fournisseur d&apos;IA
              configuré. L&apos;email et les en-têtes du CSV ne sont pas copiés
              dans le contexte libre envoyé au modèle.
            </span>
          </label>

          {membership.canEdit ? (
            <button
              type="submit"
              disabled={demo.active}
              className="rounded-[9px] bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {fileName ? "Remplacer l'import CSV" : "Importer et analyser ensuite"}
            </button>
          ) : (
            <p className="text-[12.5px] text-muted">
              Votre rôle permet de consulter les prospects, pas de les importer.
            </p>
          )}
        </form>

        {connector?.id && membership.canEdit && (
          <form
            action={clearCsvProspects}
            className="mt-7 border-t border-line-soft pt-5"
          >
            <p className="max-w-2xl text-[11.5px] leading-relaxed text-faint">
              Le retrait supprime les contacts CSV, les propositions encore
              rattachées à cette source et le briefing courant. Le journal
              append-only ainsi que les recherches d&apos;entreprise déjà
              demandées restent des traces d&apos;audit/cache ; ce bouton
              n&apos;est donc pas un effacement RGPD complet de l&apos;organisation.
            </p>
            <label className="mt-3 flex max-w-2xl items-start gap-2 text-[11.5px] leading-relaxed text-body">
              <input
                type="checkbox"
                name="confirm_clear"
                required
                className="mt-0.5"
              />
              <span>
                Je confirme le retrait des contacts CSV et des contenus
                supprimables qui en dépendent.
              </span>
            </label>
            <button
              type="submit"
              className="mt-3 text-[12px] font-semibold text-red hover:underline"
            >
              Retirer l&apos;import CSV
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
