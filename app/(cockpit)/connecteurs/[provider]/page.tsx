import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson } from "@/lib/crypto";
import { findTool } from "@/lib/connectors";
import { isOauthProvider } from "@/lib/connectors/common";
import { notionListDatabases, type NotionCreds } from "@/lib/connectors/notion";
import { EDIT_ROLES } from "@/lib/memory";
import { FIELD, SAVE_BTN } from "@/components/ui/styles";
import {
  disconnectConnector,
  saveNotionDatabase,
  saveSheetConfig,
  syncNow,
} from "./actions";

const fmtDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ saved?: string; synced?: string; error?: string }>;
}) {
  const { provider } = await params;
  const { saved, synced, error } = await searchParams;
  if (!isOauthProvider(provider)) notFound();
  const tool = findTool(provider)!;

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

  const { data: connector } = await supabase
    .from("connectors")
    .select("id, status, config")
    .eq("provider", provider)
    .maybeSingle();
  const config = (connector?.config ?? {}) as Record<string, unknown>;
  const connected = connector?.status === "connected";
  const configured = provider === "google_sheets"
    ? Boolean(config.spreadsheet_id)
    : Boolean(config.database_id);

  let prospectCount = 0;
  let preview: { name: string | null; email: string | null; company: string | null }[] = [];
  if (connector) {
    const { count } = await supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("connector_id", connector.id);
    prospectCount = count ?? 0;
    const { data: rows } = await supabase
      .from("prospects")
      .select("name, email, company")
      .eq("connector_id", connector.id)
      .order("synced_at", { ascending: false })
      .limit(5);
    preview = rows ?? [];
  }

  // Notion : lister les bases accessibles (déchiffrement serveur uniquement)
  let databases: { id: string; title: string }[] = [];
  if (provider === "notion" && connected && canEdit) {
    try {
      const admin = createAdminClient();
      const { data: full } = await admin
        .from("connectors")
        .select("encrypted_credentials")
        .eq("id", connector!.id)
        .single();
      if (full?.encrypted_credentials) {
        const creds = decryptJson<NotionCreds>(full.encrypted_credentials);
        databases = await notionListDatabases(creds.access_token);
      }
    } catch {
      databases = [];
    }
  }

  return (
    <>
      <Link href="/connecteurs" className="text-[13px] text-muted hover:text-ink">
        ← Tous les connecteurs
      </Link>
      <div className="mt-3 mb-5 flex items-center gap-3.5">
        <span
          className="grid h-11 w-11 flex-none place-items-center rounded-[11px] text-[15px] font-bold"
          style={{ background: tool.color, color: tool.darkText ? "#1a1a2e" : "#fff" }}
        >
          {tool.letter}
        </span>
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">{tool.name}</h1>
          <p className="text-[12.5px] text-muted">
            {connected ? (
              <>
                <span className="font-semibold text-green">Connecté</span>
                {typeof config.workspace_name === "string" && ` · ${config.workspace_name}`}
                {typeof config.last_synced_at === "string" &&
                  ` · synchronisé le ${fmtDate.format(new Date(config.last_synced_at))}`}
              </>
            ) : (
              "Non connecté"
            )}
          </p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-[10px] bg-red-tint px-4 py-2.5 text-[13px] font-medium text-red">{error}</p>}
      {saved && <p className="mb-4 rounded-[10px] bg-green-tint px-4 py-2.5 text-[13px] font-medium text-green">Configuration enregistrée ✓</p>}
      {synced && <p className="mb-4 rounded-[10px] bg-green-tint px-4 py-2.5 text-[13px] font-medium text-green">Synchronisation terminée — {synced} prospect{Number(synced) > 1 ? "s" : ""} lu{Number(synced) > 1 ? "s" : ""} ✓</p>}

      {!connected ? (
        <div className="rounded-[18px] border border-line-soft bg-white p-6 shadow-card">
          <p className="text-[13.5px] text-body">
            Autorisez Nepteo à lire vos données — lecture seule, jetons chiffrés,
            accès révocable ici à tout moment.
          </p>
          {canEdit && (
            <a
              href={`/api/connectors/${provider}/authorize`}
              className="mt-4 inline-block rounded-[10px] bg-violet px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep"
            >
              Connecter {tool.name}
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Configuration */}
          <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
            <div className="border-b border-line-soft px-[22px] py-4">
              <h3 className="font-display text-[15px] font-semibold">
                {provider === "google_sheets" ? "Classeur à lire" : "Base de données à lire"}
              </h3>
            </div>
            <div className="p-[22px]">
              {provider === "google_sheets" ? (
                <form action={saveSheetConfig}>
                  <p className="mb-2 text-[12.5px] text-muted">
                    Collez l&apos;URL de votre feuille de contacts. Première ligne
                    = en-têtes (nom, email, entreprise, statut — détectés
                    automatiquement).
                  </p>
                  <input
                    name="url"
                    required
                    defaultValue={(config.spreadsheet_id as string) ?? ""}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className={FIELD}
                  />
                  {canEdit && (
                    <button type="submit" className={`${SAVE_BTN} mt-3`}>
                      Enregistrer
                    </button>
                  )}
                </form>
              ) : (
                <form action={saveNotionDatabase}>
                  <p className="mb-2 text-[12.5px] text-muted">
                    Choisissez la base partagée avec Nepteo qui contient vos
                    contacts.
                  </p>
                  {databases.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      Aucune base visible — partagez une base avec
                      l&apos;intégration Nepteo dans Notion, puis rechargez.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {databases.map((db) => (
                        <label
                          key={db.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] font-medium text-ink has-[:checked]:border-violet has-[:checked]:bg-tint-soft"
                        >
                          <input
                            type="radio"
                            name="database_id"
                            value={db.id}
                            defaultChecked={config.database_id === db.id}
                            required
                            className="accent-violet"
                          />
                          {db.title}
                          <input type="hidden" name="database_title" value={db.title} />
                        </label>
                      ))}
                    </div>
                  )}
                  {canEdit && databases.length > 0 && (
                    <button type="submit" className={`${SAVE_BTN} mt-3`}>
                      Enregistrer
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Synchronisation */}
          <div className="rounded-[18px] border border-line-soft bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-line-soft px-[22px] py-4">
              <h3 className="font-display text-[15px] font-semibold">Synchronisation</h3>
              <span className="text-[12px] text-muted">
                {prospectCount} prospect{prospectCount > 1 ? "s" : ""} en mémoire
              </span>
            </div>
            <div className="p-[22px]">
              {preview.length > 0 && (
                <ul className="mb-4 space-y-1.5">
                  {preview.map((p, i) => (
                    <li key={i} className="text-[13px] text-ink">
                      <b className="font-semibold">{p.name ?? "—"}</b>
                      {p.email && <span className="text-muted"> · {p.email}</span>}
                      {p.company && <span className="text-muted"> · {p.company}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <div className="flex items-center gap-3">
                  <form action={syncNow}>
                    <input type="hidden" name="provider" value={provider} />
                    <button
                      type="submit"
                      disabled={!configured}
                      className={`${SAVE_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      Synchroniser maintenant
                    </button>
                  </form>
                  {!configured && (
                    <span className="text-[12.5px] text-muted">
                      Configurez d&apos;abord la source ci-dessus.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {canEdit && (
            <form action={disconnectConnector}>
              <input type="hidden" name="provider" value={provider} />
              <button type="submit" className="text-[12.5px] font-semibold text-red hover:underline">
                Déconnecter et supprimer les jetons d&apos;accès
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
