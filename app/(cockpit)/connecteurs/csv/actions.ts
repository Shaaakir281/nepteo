"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/context";
import {
  CSV_IMPORT_MAX_BYTES,
  CsvImportError,
  fingerprintCsv,
  parseCsvProspects,
} from "@/lib/connectors/csv";
import {
  DemoBusyError,
  DemoDataMutationBlockedError,
  withRealDataMutationLock,
} from "@/lib/demo/lock";
import { createAdminClient } from "@/lib/supabase/admin";

const CSV_PAGE = "/connecteurs/csv";
const DATA_AUTHORIZATION_VERSION = 1;

function fail(message: string): never {
  redirect(`${CSV_PAGE}?error=${encodeURIComponent(message)}`);
}

function safeFileName(name: string): string {
  return name.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 180);
}

function importErrorMessage(error: unknown): string {
  if (error instanceof DemoDataMutationBlockedError) {
    return "Retirez d'abord le scénario fictif Nepteo avant d'importer les données du testeur.";
  }
  if (error instanceof DemoBusyError) {
    return "Une autre opération est en cours. Réessayez dans un instant.";
  }
  if (error instanceof CsvImportError) return error.message;
  return "Import impossible. Le fichier précédent n'a pas été volontairement supprimé ; vérifiez le format et réessayez.";
}

function clearErrorMessage(error: unknown): string {
  if (error instanceof DemoDataMutationBlockedError) {
    return "Le retrait CSV est bloqué tant qu'un scénario Nepteo est actif.";
  }
  if (error instanceof DemoBusyError) {
    return "Une autre opération est en cours. Réessayez dans un instant.";
  }
  return "Retrait impossible. Aucune suppression partielle n'a été validée ; réessayez.";
}

export async function importCsvProspects(formData: FormData): Promise<void> {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canEdit) {
    fail("Votre rôle ne permet pas d'importer des prospects.");
  }
  if (formData.get("data_authorized") !== "on") {
    fail("Confirmez que les données peuvent être utilisées dans cet espace de test.");
  }

  const upload = formData.get("csv");
  if (!(upload instanceof File) || upload.size === 0) {
    fail("Choisissez un fichier CSV non vide.");
  }
  if (upload.size > CSV_IMPORT_MAX_BYTES) {
    fail("Le fichier dépasse la limite de 900 Ko.");
  }

  let bytes: Uint8Array;
  let text: string;
  try {
    bytes = new Uint8Array(await upload.arrayBuffer());
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("Le fichier doit être enregistré au format CSV UTF-8.");
  }

  const fingerprint = fingerprintCsv(bytes!);
  let parsed;
  try {
    parsed = parseCsvProspects(text!);
  } catch (error) {
    fail(importErrorMessage(error));
  }

  const admin = createAdminClient();
  const fileName = safeFileName(upload.name) || "prospects.csv";

  try {
    await withRealDataMutationLock(
      admin,
      membership.organizationId,
      async () => {
        const { error } = await admin.rpc("replace_csv_prospects", {
          p_organization_id: membership.organizationId,
          p_actor_id: user.id,
          p_file_name: fileName,
          p_file_fingerprint: fingerprint,
          p_delimiter:
            parsed!.delimiter === "\t" ? "tabulation" : parsed!.delimiter,
          p_field_mapping: parsed!.mapping,
          p_rows: parsed!.prospects,
          p_ignored_rows: parsed!.ignoredRows,
          p_authorization_version: DATA_AUTHORIZATION_VERSION,
        });
        if (error) throw new Error(error.message);
      },
    );
  } catch (error) {
    fail(importErrorMessage(error));
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/prospects");
  revalidatePath("/entreprise");
  redirect(
    `${CSV_PAGE}?imported=${parsed!.prospects.length}&ignored=${parsed!.ignoredRows}`,
  );
}

export async function clearCsvProspects(formData: FormData): Promise<void> {
  const { user, membership } = await getCurrentAuthContext();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");
  if (!membership.canEdit) {
    fail("Votre rôle ne permet pas de retirer cet import.");
  }
  if (formData.get("confirm_clear") !== "on") {
    fail("Confirmez explicitement le retrait de l'import CSV.");
  }

  const admin = createAdminClient();
  try {
    await withRealDataMutationLock(
      admin,
      membership.organizationId,
      async () => {
        const { error } = await admin.rpc("clear_csv_prospects", {
          p_organization_id: membership.organizationId,
          p_actor_id: user.id,
        });
        if (error) throw new Error(error.message);
      },
    );
  } catch (error) {
    fail(clearErrorMessage(error));
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/prospects");
  revalidatePath("/entreprise");
  redirect(`${CSV_PAGE}?cleared=1`);
}
