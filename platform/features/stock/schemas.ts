import { z } from "zod";
import { emptyToUndefined, sortDir, text } from "../list-query";

export const StockItemInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  reference: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(20),
  threshold: z.coerce.number().int().min(0).max(1_000_000),
  zoneId: z.preprocess(
    emptyToUndefined,
    z.string().min(1).nullable().optional(),
  ),
});
export type StockItemInput = z.infer<typeof StockItemInputSchema>;

export const MovementInputSchema = z.object({
  stockItemId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  // Motif lié au stock : ne pas y saisir de donnée personnelle
  reason: z.string().trim().min(1).max(200),
});
export type MovementInput = z.infer<typeof MovementInputSchema>;

export const StockQuerySchema = z.object({
  search: text(),
  zoneId: text(60),
  alert: z.enum(["all", "low"]).catch("all"),
  sort: z.enum(["name", "reference", "quantity"]).catch("name"),
  dir: sortDir,
});
export type StockQuery = z.infer<typeof StockQuerySchema>;
