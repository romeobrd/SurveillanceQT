// Import CSV : lecture du fichier et validation ligne par ligne. Code pur, testé.
// Les règles sont celles des formulaires (mêmes schémas zod) : un import ne contourne aucune validation.
import { z } from "zod";
import { AssetInputSchema } from "@/features/assets/schemas";
import { PersonInputSchema } from "@/features/people/schemas";
import { StockItemInputSchema } from "@/features/stock/schemas";

export const IMPORT_KINDS = ["collaborateurs", "materiel", "stock"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_IMPORT_ROWS = 2_000;

/** Lecture CSV (RFC 4180) : séparateur « ; » ou « , » détecté sur l'en-tête, guillemets, BOM, fins de ligne Windows. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Lignes entièrement vides ignorées
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** En-tête normalisé : minuscules, sans accents, mots séparés par « _ ». */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

interface ColumnSpec {
  key: string;
  /** Intitulés acceptés (normalisés). Le premier est celui du modèle de fichier. */
  headers: readonly string[];
  required: boolean;
  label: string;
}

const COLUMNS: Record<ImportKind, readonly ColumnSpec[]> = {
  collaborateurs: [
    {
      key: "firstName",
      headers: ["prenom", "first_name"],
      required: true,
      label: "Prénom",
    },
    {
      key: "lastName",
      headers: ["nom", "last_name"],
      required: true,
      label: "Nom",
    },
    {
      key: "workEmail",
      headers: [
        "email",
        "e_mail",
        "email_professionnel",
        "e_mail_professionnel",
      ],
      required: true,
      label: "E-mail",
    },
    {
      key: "jobTitle",
      headers: ["poste", "intitule_de_poste", "fonction"],
      required: true,
      label: "Poste",
    },
    {
      key: "team",
      headers: ["equipe", "service"],
      required: false,
      label: "Équipe",
    },
  ],
  materiel: [
    { key: "type", headers: ["type"], required: true, label: "Type" },
    { key: "brand", headers: ["marque"], required: true, label: "Marque" },
    { key: "model", headers: ["modele"], required: true, label: "Modèle" },
    {
      key: "serialNumber",
      headers: ["numero_de_serie", "n_de_serie", "serie"],
      required: true,
      label: "Numéro de série",
    },
    { key: "state", headers: ["etat"], required: false, label: "État" },
    {
      key: "purchaseDate",
      headers: ["date_d_achat", "date_achat"],
      required: false,
      label: "Date d'achat",
    },
  ],
  stock: [
    {
      key: "name",
      headers: ["article", "nom"],
      required: true,
      label: "Article",
    },
    {
      key: "reference",
      headers: ["reference", "ref"],
      required: true,
      label: "Référence",
    },
    { key: "unit", headers: ["unite"], required: true, label: "Unité" },
    {
      key: "threshold",
      headers: ["seuil", "seuil_d_alerte"],
      required: false,
      label: "Seuil d'alerte",
    },
    {
      key: "quantity",
      headers: ["quantite", "quantite_initiale"],
      required: false,
      label: "Quantité initiale",
    },
  ],
};

/** Colonnes affichées sur la page d'import (intitulé du modèle, caractère obligatoire). */
export function importColumns(
  kind: ImportKind,
): Array<{ label: string; required: boolean }> {
  return COLUMNS[kind].map(({ label, required }) => ({ label, required }));
}

/**
 * Décode le fichier envoyé : UTF-8, sinon Windows-1252 (CSV enregistré par un ancien Excel français).
 * Renvoie null pour un fichier binaire.
 */
export function decodeCsv(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.includes("\0") ? null : text;
}

/** Modèle de fichier (en-tête + une ligne d'exemple fictive). */
export function templateCsv(kind: ImportKind): string {
  const examples: Record<ImportKind, string[]> = {
    collaborateurs: [
      "Camille",
      "Durand",
      "camille.durand@exemple.fr",
      "Chargée de projet",
      "Marketing",
    ],
    materiel: [
      "Ordinateur portable",
      "Dell",
      "Latitude 5440",
      "DL-0001",
      "En service",
      "15/03/2024",
    ],
    stock: ["Ramettes de papier A4", "PAP-A4", "ramettes", "10", "25"],
  };
  const header = COLUMNS[kind].map((column) => column.label);
  return `﻿${header.join(";")}\r\n${examples[kind].join(";")}\r\n`;
}

const ASSET_STATE_LABELS: Record<string, string> = {
  en_service: "IN_SERVICE",
  in_service: "IN_SERVICE",
  en_panne: "BROKEN",
  panne: "BROKEN",
  broken: "BROKEN",
  a_renouveler: "TO_RENEW",
  to_renew: "TO_RENEW",
  reforme: "RETIRED",
  retired: "RETIRED",
};

/** Date « JJ/MM/AAAA » ou « AAAA-MM-JJ » → ISO, ou la valeur telle quelle (le schéma la refusera). */
function toIsoDate(value: string): string {
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  return value.trim();
}

const PeopleRowSchema = PersonInputSchema.omit({ teamId: true }).extend({
  team: z.string().trim().max(80).optional().default(""),
});
const AssetRowSchema = AssetInputSchema.pick({
  type: true,
  brand: true,
  model: true,
  serialNumber: true,
  state: true,
  purchaseDate: true,
}).extend({
  purchaseDate: AssetInputSchema.shape.purchaseDate.refine(
    (date) => date === null || !Number.isNaN(date.getTime()),
  ),
});
const StockRowSchema = StockItemInputSchema.omit({ zoneId: true }).extend({
  quantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export type PeopleRow = z.infer<typeof PeopleRowSchema>;
export type AssetRow = z.infer<typeof AssetRowSchema>;
export type StockRow = z.infer<typeof StockRowSchema>;
export type ImportRow = PeopleRow | AssetRow | StockRow;

export interface ImportLine<T> {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  line: number;
  data: T | null;
  errors: string[];
}

export interface ParsedImport<T> {
  /** Erreurs bloquantes (fichier vide, colonne obligatoire absente, trop de lignes). */
  fileErrors: string[];
  lines: ImportLine<T>[];
}

const ISSUE_LABELS: Record<string, string> = {
  too_small: "valeur manquante ou trop petite",
  too_big: "valeur trop longue ou trop grande",
  invalid_format: "format invalide",
  invalid_type: "valeur invalide",
  invalid_value: "valeur non reconnue",
  custom: "valeur invalide",
};

function parseWith<T>(
  kind: ImportKind,
  schema: z.ZodType<T>,
  csv: string,
  prepare: (record: Record<string, string>) => Record<string, unknown>,
  uniqueKey: (data: T) => string,
): ParsedImport<T> {
  const rows = parseCsv(csv);
  if (rows.length < 2)
    return {
      fileErrors: ["Le fichier ne contient aucune ligne à importer."],
      lines: [],
    };
  if (rows.length - 1 > MAX_IMPORT_ROWS)
    return {
      fileErrors: [
        `Trop de lignes : ${MAX_IMPORT_ROWS} au maximum par fichier.`,
      ],
      lines: [],
    };
  const headers = rows[0].map(normalizeHeader);
  const columns = COLUMNS[kind];
  const indexOf = new Map<string, number>();
  const fileErrors: string[] = [];
  for (const column of columns) {
    const index = headers.findIndex((header) =>
      column.headers.includes(header),
    );
    if (index >= 0) indexOf.set(column.key, index);
    else if (column.required)
      fileErrors.push(`Colonne obligatoire absente : « ${column.label} ».`);
  }
  if (fileErrors.length) return { fileErrors, lines: [] };

  const seen = new Set<string>();
  const lines = rows.slice(1).map((cells, offset): ImportLine<T> => {
    const record: Record<string, string> = {};
    for (const [key, index] of indexOf)
      record[key] = (cells[index] ?? "").trim();
    const result = schema.safeParse(prepare(record));
    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const column = columns.find(
          (candidate) => candidate.key === issue.path[0],
        );
        return `${column?.label ?? "Ligne"} : ${ISSUE_LABELS[issue.code] ?? "valeur invalide"}`;
      });
      return { line: offset + 2, data: null, errors: [...new Set(errors)] };
    }
    const key = uniqueKey(result.data);
    if (seen.has(key))
      return {
        line: offset + 2,
        data: null,
        errors: ["Doublon dans le fichier"],
      };
    seen.add(key);
    return { line: offset + 2, data: result.data, errors: [] };
  });
  return { fileErrors: [], lines };
}

export function parsePeopleImport(csv: string): ParsedImport<PeopleRow> {
  return parseWith(
    "collaborateurs",
    PeopleRowSchema,
    csv,
    (record) => record,
    (row) => row.workEmail,
  );
}

export function parseAssetImport(csv: string): ParsedImport<AssetRow> {
  return parseWith(
    "materiel",
    AssetRowSchema,
    csv,
    (record) => ({
      ...record,
      state: record.state
        ? (ASSET_STATE_LABELS[normalizeHeader(record.state)] ?? record.state)
        : "IN_SERVICE",
      purchaseDate: record.purchaseDate ? toIsoDate(record.purchaseDate) : "",
    }),
    (row) => row.serialNumber.toLowerCase(),
  );
}

export function parseStockImport(csv: string): ParsedImport<StockRow> {
  return parseWith(
    "stock",
    StockRowSchema,
    csv,
    (record) => ({
      ...record,
      threshold: record.threshold || "0",
      quantity: record.quantity || "0",
    }),
    (row) => row.reference.toLowerCase(),
  );
}

export function parseImport(
  kind: ImportKind,
  csv: string,
): ParsedImport<ImportRow> {
  switch (kind) {
    case "collaborateurs":
      return parsePeopleImport(csv);
    case "materiel":
      return parseAssetImport(csv);
    case "stock":
      return parseStockImport(csv);
  }
}
