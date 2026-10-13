import { z } from "zod";
import { emptyToUndefined, text } from "../list-query";

export const ProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teamId: z.preprocess(
    emptyToUndefined,
    z.string().min(1).nullable().optional(),
  ),
  description: z.string().trim().max(500).default(""),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const StepNameSchema = z.string().trim().min(1).max(120);
export const StepStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);

export const ProjectQuerySchema = z.object({
  search: text(),
  teamId: text(60),
  state: z.enum(["ALL", "NOT_STARTED", "IN_PROGRESS", "DONE"]).catch("ALL"),
});
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
