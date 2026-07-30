import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson } from "@/lib/crypto";
import type { FieldMapping } from "@/lib/connectors/common";
import {
  autoDetectNotionMapping,
  listNotionProperties,
  notionListDatabases,
  type NotionCreds,
} from "@/lib/connectors/notion";
import {
  autoDetectSheetMapping,
  googleFreshToken,
  listSheetColumns,
  type GoogleCreds,
} from "@/lib/connectors/google-sheets";
import {
  remoteListError,
  remoteListState,
  type NotionDatabaseOption,
  type RemoteColumn,
  type RemoteListState,
} from "./detail-rules";

const DATABASE_LOAD_ERROR =
  "Impossible de charger les bases Notion. Vérifiez l'accès puis rechargez.";
const COLUMN_LOAD_ERROR =
  "Impossible de charger les colonnes. Vérifiez l'accès puis rechargez.";

export interface RemoteMetadata {
  databases: RemoteListState<NotionDatabaseOption> | null;
  columns: RemoteListState<RemoteColumn> | null;
  mapping: FieldMapping;
}

interface LoadRemoteMetadataInput {
  provider: "google_sheets" | "notion";
  connectorId: string;
  connected: boolean;
  configured: boolean;
  canEdit: boolean;
  config: Record<string, unknown>;
}

const emptyMetadata = (): RemoteMetadata => ({
  databases: null,
  columns: null,
  mapping: {},
});

/**
 * Charge les métadonnées distantes de la fiche connecteur.
 *
 * Les credentials sont lus et déchiffrés une seule fois. Chaque appel distant
 * garde ensuite son propre état : une panne de la liste des bases n'empêche pas
 * d'afficher les colonnes déjà configurées, et inversement.
 */
export async function loadRemoteMetadata({
  provider,
  connectorId,
  connected,
  configured,
  canEdit,
  config,
}: LoadRemoteMetadataInput): Promise<RemoteMetadata> {
  const result = emptyMetadata();
  if (!connected || !canEdit) return result;

  const needsDatabases = provider === "notion";
  const needsColumns = configured;
  if (!needsDatabases && !needsColumns) return result;

  const admin = createAdminClient();
  const { data: connector, error } = await admin
    .from("connectors")
    .select("encrypted_credentials")
    .eq("id", connectorId)
    .single();

  if (error || !connector?.encrypted_credentials) {
    if (needsDatabases) {
      result.databases = remoteListError(DATABASE_LOAD_ERROR);
    }
    if (needsColumns) {
      result.columns = remoteListError(COLUMN_LOAD_ERROR);
    }
    return result;
  }

  const storedMapping = config.field_mapping as FieldMapping | undefined;

  if (provider === "notion") {
    let credentials: NotionCreds;
    try {
      credentials = decryptJson<NotionCreds>(connector.encrypted_credentials);
    } catch {
      if (needsDatabases) {
        result.databases = remoteListError(DATABASE_LOAD_ERROR);
      }
      if (needsColumns) {
        result.columns = remoteListError(COLUMN_LOAD_ERROR);
      }
      return result;
    }

    try {
      result.databases = remoteListState(
        await notionListDatabases(credentials.access_token),
      );
    } catch {
      result.databases = remoteListError(DATABASE_LOAD_ERROR);
    }

    if (needsColumns) {
      try {
        const properties = await listNotionProperties(
          credentials.access_token,
          config.database_id as string,
        );
        const columns = properties.map((property) => ({
          value: property.key,
          label: `${property.key} · ${property.type}`,
        }));
        result.columns = remoteListState(columns);
        result.mapping = storedMapping ?? autoDetectNotionMapping(properties);
      } catch {
        result.columns = remoteListError(COLUMN_LOAD_ERROR);
      }
    }

    return result;
  }

  try {
    const credentials = decryptJson<GoogleCreds>(
      connector.encrypted_credentials,
    );
    const { token } = await googleFreshToken(credentials);
    const headers = await listSheetColumns(
      token,
      config.spreadsheet_id as string,
    );
    result.columns = remoteListState(
      headers.map((header) => ({ value: header, label: header })),
    );
    result.mapping = storedMapping ?? autoDetectSheetMapping(headers);
  } catch {
    result.columns = remoteListError(COLUMN_LOAD_ERROR);
  }

  return result;
}
