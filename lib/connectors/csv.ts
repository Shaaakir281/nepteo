import { createHash } from "node:crypto";
import {
  autoDetectTabularMapping,
  type FieldMapping,
  type NormalizedProspect,
} from "./common.ts";
import { normalizeContactDate } from "./date-rules.ts";

export const CSV_IMPORT_MAX_BYTES = 900_000;
export const CSV_IMPORT_MAX_ROWS = 5_000;
export const CSV_IMPORT_MAX_COLUMNS = 100;

export class CsvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportError";
  }
}

export interface ParsedCsvProspects {
  delimiter: "," | ";" | "\t";
  headers: string[];
  mapping: FieldMapping;
  prospects: NormalizedProspect[];
  ignoredRows: number;
}

function separatorCounts(text: string): Map<"," | ";" | "\t", number[]> {
  const records = new Map<"," | ";" | "\t", number[]>([
    [",", []],
    [";", []],
    ["\t", []],
  ]);
  const current = new Map<"," | ";" | "\t", number>([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ]);
  let quoted = false;
  let hasContent = false;
  let recordCount = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (hasContent) {
        for (const delimiter of [",", ";", "\t"] as const) {
          records.get(delimiter)!.push(current.get(delimiter) ?? 0);
          current.set(delimiter, 0);
        }
        recordCount += 1;
        if (recordCount >= 20) break;
      }
      hasContent = false;
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      continue;
    }
    if (!quoted && current.has(char as "," | ";" | "\t")) {
      const delimiter = char as "," | ";" | "\t";
      current.set(delimiter, (current.get(delimiter) ?? 0) + 1);
    }
    if (!quoted && !/\s/.test(char)) hasContent = true;
  }

  if (recordCount < 20 && hasContent) {
    for (const delimiter of [",", ";", "\t"] as const) {
      records.get(delimiter)!.push(current.get(delimiter) ?? 0);
    }
  }
  return records;
}

function delimiterOf(text: string): "," | ";" | "\t" {
  const candidates = [...separatorCounts(text).entries()]
    .filter(([, counts]) => {
      if ((counts[0] ?? 0) === 0) return false;
      return (
        counts.length > 1 &&
        counts.slice(1).every((count) => count <= (counts[0] ?? 0))
      );
    })
    .sort((left, right) => (right[1][0] ?? 0) - (left[1][0] ?? 0));

  if (candidates.length === 0) {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    if (/[;,\t]/.test(firstLine)) {
      throw new CsvImportError(
        "Le nombre de colonnes du CSV est incohérent entre les lignes.",
      );
    }
    return ",";
  }
  if (
    candidates.length > 1 &&
    candidates[0][1][0] === candidates[1][1][0]
  ) {
    throw new CsvImportError(
      "Le séparateur du CSV est ambigu. Réexportez-le avec un seul séparateur (virgule ou point-virgule).",
    );
  }
  return candidates[0][0];
}

function parseRows(
  input: string,
  delimiter: "," | ";" | "\t",
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
    afterQuote = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
    if (rows.length > CSV_IMPORT_MAX_ROWS + 1) {
      throw new CsvImportError(
        `Le fichier dépasse ${CSV_IMPORT_MAX_ROWS.toLocaleString("fr-FR")} lignes de données.`,
      );
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += char;
      }
      continue;
    }

    if (afterQuote) {
      if (char === delimiter) {
        pushCell();
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && input[index + 1] === "\n") index += 1;
        pushRow();
      } else if (char !== " " && char !== "\t") {
        throw new CsvImportError(
          "Le CSV contient un caractère inattendu après une valeur entre guillemets.",
        );
      }
      continue;
    }

    if (char === '"') {
      if (cell.length > 0) {
        throw new CsvImportError(
          "Le CSV contient un guillemet inattendu dans une valeur.",
        );
      }
      quoted = true;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += char;
    }
  }

  if (quoted) {
    throw new CsvImportError("Le CSV contient une valeur entre guillemets non fermée.");
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
}

function normalizeTable(rows: string[][]): {
  headers: string[];
  dataRows: string[][];
} {
  if (rows.length < 2) {
    throw new CsvImportError(
      "Le fichier doit contenir une ligne d'en-têtes et au moins un contact.",
    );
  }

  const headers = [...rows[0]];
  while (headers.at(-1) === "") headers.pop();
  if (headers.length === 0) {
    throw new CsvImportError("La ligne d'en-têtes est vide.");
  }
  if (headers.length > CSV_IMPORT_MAX_COLUMNS) {
    throw new CsvImportError(
      `Le fichier dépasse la limite de ${CSV_IMPORT_MAX_COLUMNS} colonnes.`,
    );
  }

  const seen = new Set<string>();
  for (const header of headers) {
    if (!header) continue;
    const key = header.toLocaleLowerCase("fr-FR");
    if (seen.has(key)) {
      throw new CsvImportError(`L'en-tête « ${header} » apparaît plusieurs fois.`);
    }
    seen.add(key);
  }

  const dataRows = rows.slice(1).map((source, index) => {
    const overflow = source.slice(headers.length).some((value) => value.length > 0);
    if (overflow) {
      throw new CsvImportError(
        `La ligne ${index + 2} contient plus de colonnes que les en-têtes.`,
      );
    }
    return Array.from(
      { length: headers.length },
      (_, column) => source[column] ?? "",
    );
  });

  return { headers, dataRows };
}

export function fingerprintCsv(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 24);
}

/**
 * Parse et normalise un export CSV sans écrire en base.
 *
 * Chaque ligne garde un identifiant stable pour un fichier identique et les
 * doublons restent distincts : l'agent peut donc justement les détecter.
 */
export function parseCsvProspects(
  text: string,
): ParsedCsvProspects {
  let withoutBom = text.replace(/^\uFEFF/, "");
  if (withoutBom.includes("\0")) {
    throw new CsvImportError("Le fichier contient des données binaires inattendues.");
  }

  const separatorDirective = withoutBom.match(/^sep=([,;\t])\r?\n/i);
  const delimiter = separatorDirective
    ? (separatorDirective[1] as "," | ";" | "\t")
    : delimiterOf(withoutBom);
  if (separatorDirective) {
    withoutBom = withoutBom.slice(separatorDirective[0].length);
  }
  const { headers, dataRows } = normalizeTable(parseRows(withoutBom, delimiter));
  const mapping = autoDetectTabularMapping(headers);
  if (!mapping.name && !mapping.email) {
    throw new CsvImportError(
      "Aucune colonne « Nom » ou « Email » n'a été reconnue dans les en-têtes.",
    );
  }

  const indexOf = (header: string | null | undefined) =>
    header ? headers.indexOf(header) : -1;
  const indexes = {
    name: indexOf(mapping.name),
    email: indexOf(mapping.email),
    company: indexOf(mapping.company),
    stage: indexOf(mapping.stage),
    notes: indexOf(mapping.notes),
    last_contact_at: indexOf(mapping.last_contact_at),
  };
  const prospects: NormalizedProspect[] = [];
  const identityOccurrences = new Map<string, number>();
  const normalizeIdentityPart = (value: string | null) =>
    (value ?? "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("fr-FR")
      .replace(/\s+/g, " ");
  let ignoredRows = 0;

  dataRows.forEach((row, rowIndex) => {
    const cell = (index: number) => (index >= 0 ? row[index] || null : null);
    const bounded = (
      value: string | null,
      label: string,
      maxLength: number,
    ): string | null => {
      if (value && value.length > maxLength) {
        throw new CsvImportError(
          `La ligne ${rowIndex + 2} dépasse ${maxLength} caractères pour « ${label} ».`,
        );
      }
      return value;
    };
    const name = bounded(cell(indexes.name), "Nom", 200);
    const email = bounded(cell(indexes.email), "Email", 320);
    if (!name && !email) {
      ignoredRows += 1;
      return;
    }

    const company = bounded(cell(indexes.company), "Entreprise", 200);
    const stage = bounded(cell(indexes.stage), "Statut", 120);
    const notes = bounded(cell(indexes.notes), "Notes", 2_000);
    const lastContact = bounded(
      cell(indexes.last_contact_at),
      "Dernier contact",
      64,
    );
    const normalizedEmail = normalizeIdentityPart(email);
    const normalizedName = normalizeIdentityPart(name);
    const normalizedCompany = normalizeIdentityPart(company);
    // Une boîte générique d'entreprise peut être partagée. La clé inclut donc
    // toujours nom + entreprise, sans dépendre du nombre de lignes du lot :
    // l'ajout ou le retrait d'un homonyme ne change pas l'identité des autres.
    const identitySource = normalizedEmail
      ? `email:${normalizedEmail}|name:${normalizedName}|company:${normalizedCompany}`
      : `name:${normalizedName}|company:${normalizedCompany}`;
    const identityHash = createHash("sha256")
      .update(identitySource)
      .digest("hex")
      .slice(0, 24);
    const occurrence = (identityOccurrences.get(identityHash) ?? 0) + 1;
    identityOccurrences.set(identityHash, occurrence);
    prospects.push({
      external_id: `csv:${identityHash}:${occurrence}`,
      name,
      email,
      company,
      stage,
      notes,
      last_contact_at: normalizeContactDate(lastContact),
      // Tous les champs utiles ont leur colonne normalisée. Ne rien recopier
      // dans `raw` évite d'envoyer l'email ou un en-tête contrôlé par le fichier
      // dans les prompts de brouillon.
      raw: {},
    });
  });

  if (prospects.length === 0) {
    throw new CsvImportError(
      "Aucun contact exploitable : chaque ligne doit avoir un nom ou un email.",
    );
  }

  return { delimiter, headers, mapping, prospects, ignoredRows };
}
