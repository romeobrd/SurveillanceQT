// Paramètres d'URL des listes (recherche, filtres, tri) : validés avec zod, jamais de confiance aveugle.
import { z } from "zod";

export const text = (max = 100) =>
  z.string().trim().max(max).optional().catch(undefined);

export const sortDir = z.enum(["asc", "desc"]).catch("asc");

/** Une valeur de paramètre d'URL peut être un tableau : on garde la première. */
export function firstValues(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

/** Chaîne vide (filtre « tous ») -> undefined. */
export const emptyToUndefined = (value: unknown) =>
  value === "" ? undefined : value;
