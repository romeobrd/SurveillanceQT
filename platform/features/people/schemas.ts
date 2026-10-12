import { z } from "zod";
import { emptyToUndefined, sortDir, text } from "../list-query";

export const PersonInputSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  workEmail: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  jobTitle: z.string().trim().min(1).max(120),
  teamId: z.preprocess(
    emptyToUndefined,
    z.string().min(1).nullable().optional(),
  ),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

export const PeopleQuerySchema = z.object({
  search: text(),
  teamId: text(60),
  status: z.enum(["ACTIVE", "DEPARTED", "ALL"]).catch("ACTIVE"),
  sort: z.enum(["lastName", "firstName", "jobTitle"]).catch("lastName"),
  dir: sortDir,
});
export type PeopleQuery = z.infer<typeof PeopleQuerySchema>;

export const TeamNameSchema = z.string().trim().min(1).max(80);

export const WorkstationQuerySchema = z.object({
  search: text(),
  zoneId: text(60),
  status: z.enum(["all", "free", "occupied"]).catch("all"),
});
export type WorkstationQuery = z.infer<typeof WorkstationQuerySchema>;

export const WorkstationAssignmentSchema = z.object({
  workstationId: z.string().min(1),
  personId: z.preprocess(
    emptyToUndefined,
    z.string().min(1).nullable().default(null),
  ),
});
