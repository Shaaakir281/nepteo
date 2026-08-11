import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import { CSV_IMPORT_MAX_BYTES } from "@/lib/connectors/csv";
import { readDemoModeMarkers } from "@/lib/demo/isolation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CsvImportStepper } from "./_components/csv-import-stepper";

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CsvConnectorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const admin = createAdminClient();
  const connectorResult = membership.canViewFinancials
    ? await admin.from("connectors").select("id, status, config").eq("organization_id", membership.organizationId).eq("provider", "csv").maybeSingle()
    : await supabase.from("connectors").select("id, status").eq("organization_id", membership.organizationId).eq("provider", "csv").maybeSingle();
  const connector = connectorResult.data;
  const prospectCount = connector?.id
    ? (await supabase.from("prospects").select("id", { count: "exact", head: true }).eq("organization_id", membership.organizationId).eq("connector_id", connector.id)).count ?? 0
    : 0;
  const demo = await readDemoModeMarkers(admin, membership.organizationId);
  const config = connector && "config" in connector && connector.config && typeof connector.config === "object" && !Array.isArray(connector.config)
    ? connector.config as Record<string, unknown>
    : {};
  const fileName = typeof config.file_name === "string" ? config.file_name : undefined;
  const imported = one(params.imported);
  const ignored = Number(one(params.ignored) ?? "0");
  const cleared = one(params.cleared) === "1";
  const error = one(params.error);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/entreprise?onglet=connecteurs" className="text-[12.5px] font-semibold text-violet hover:underline">
        ← Retour aux connecteurs
      </Link>
      <div className="mt-4 rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fichier CSV</p>
            <h1 className="font-display text-[21px] font-semibold text-ink">Importer les prospects du testeur</h1>
          </div>
          {connector?.status === "connected" && (
            <span className="rounded-full bg-green-tint px-3 py-1 text-[11.5px] font-semibold text-green">{prospectCount} contact{prospectCount > 1 ? "s" : ""}</span>
          )}
        </div>

        {error && <p role="alert" className="mt-5 rounded-[10px] bg-red-tint px-4 py-3 text-[12.5px] font-medium text-red">{error}</p>}
        {imported && (
          <p className="mt-5 rounded-[10px] bg-green-tint px-4 py-3 text-[12.5px] font-medium text-green">
            {imported} contact{Number(imported) > 1 ? "s" : ""} importé{Number(imported) > 1 ? "s" : ""}{ignored > 0 ? ` — ${ignored} ligne${ignored > 1 ? "s" : ""} sans nom ni email ignorée${ignored > 1 ? "s" : ""}.` : "."}
          </p>
        )}
        {cleared && <p className="mt-5 rounded-[10px] bg-green-tint px-4 py-3 text-[12.5px] font-medium text-green">Import CSV retiré. Un scénario Nepteo peut maintenant être chargé si l&apos;espace est vide.</p>}

        <CsvImportStepper
          canEdit={membership.canEdit}
          demoActive={demo.active}
          fileName={fileName}
          hasImport={Boolean(connector?.id)}
          maxBytes={CSV_IMPORT_MAX_BYTES}
        />
      </div>
    </div>
  );
}
