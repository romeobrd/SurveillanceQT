"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardedValue } from "@/lib/actions";
import {
  decodeCsv,
  IMPORT_KINDS,
  MAX_IMPORT_BYTES,
  type ImportKind,
} from "@/features/import/csv";
import type { Permission } from "@/lib/auth/permissions";
import type {
  ImportPreview,
  ImportResult,
} from "@/lib/db/repositories/imports";
import { fr } from "@/lib/i18n/fr";

const t = fr.importCsv;
const KindSchema = z.enum(IMPORT_KINDS);
/** Texte renvoyé à la seconde étape : mêmes limites que le fichier (on ré-analyse tout côté serveur). */
const CsvTextSchema = z.string().min(1).max(MAX_IMPORT_BYTES);

const PERMISSION: Record<ImportKind, Permission> = {
  collaborateurs: "people:write",
  materiel: "asset:write",
  stock: "stock:write",
};
const LIST_PATH: Record<ImportKind, string> = {
  collaborateurs: "/collaborateurs",
  materiel: "/materiel",
  stock: "/stock",
};

export type ImportActionState = {
  error: string | null;
  /** Étape 1 : aperçu et contenu du fichier, renvoyé tel quel pour confirmer. */
  preview?: ImportPreview;
  csv?: string;
  /** Étape 2 : résultat. */
  result?: ImportResult;
};

/** Étape 1 : lit le fichier et renvoie l'aperçu, sans rien enregistrer. */
export async function previewImportAction(
  _previous: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const kind = KindSchema.parse(formData.get("kind"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.noFile };
  if (file.size > MAX_IMPORT_BYTES) return { error: t.tooLarge };
  const csv = decodeCsv(new Uint8Array(await file.arrayBuffer()));
  if (csv === null) return { error: t.notText };
  const result = await guardedValue(PERMISSION[kind], (repos) =>
    repos.imports.preview(kind, csv),
  );
  if (result.error || !result.value) return { error: result.error };
  return { error: null, preview: result.value, csv };
}

/** Étape 2 : ré-analyse le même contenu et importe les lignes valides. */
export async function runImportAction(
  _previous: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const kind = KindSchema.parse(formData.get("kind"));
  const csv = CsvTextSchema.safeParse(formData.get("csv"));
  if (!csv.success) return { error: t.noFile };
  const result = await guardedValue(PERMISSION[kind], (repos) =>
    repos.imports.run(kind, csv.data),
  );
  if (result.error || !result.value) return { error: result.error };
  revalidatePath(LIST_PATH[kind]);
  return { error: null, result: result.value };
}
