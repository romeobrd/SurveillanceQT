import { z } from "zod";
import { emptyToUndefined, sortDir, text } from "../list-query";

export const ASSET_STATES = [
  "IN_SERVICE",
  "BROKEN",
  "TO_RENEW",
  "RETIRED",
] as const;

export const AssetInputSchema = z.object({
  type: z.string().trim().min(1).max(60),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().min(1).max(80),
  state: z.enum(ASSET_STATES),
  purchaseDate: z.preprocess(
    (value) =>
      value === "" || value === undefined || value === null
        ? null
        : new Date(String(value)),
    z.date().nullable(),
  ),
  personId: z.preprocess(
    emptyToUndefined,
    z.string().min(1).nullable().optional(),
  ),
  zoneId: z.preprocess(
    emptyToUndefined,
    z.string().min(1).nullable().optional(),
  ),
});
export type AssetInput = z.infer<typeof AssetInputSchema>;

export const AssetQuerySchema = z.object({
  search: text(),
  state: z.enum(["ALL", ...ASSET_STATES]).catch("ALL"),
  zoneId: text(60),
  personId: text(60),
  sort: z.enum(["type", "brand", "state", "purchaseDate"]).catch("type"),
  dir: sortDir,
});
export type AssetQuery = z.infer<typeof AssetQuerySchema>;
