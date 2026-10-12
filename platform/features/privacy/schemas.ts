import { z } from "zod";
import { emptyToUndefined, text } from "../list-query";

export const PRIVACY_REQUEST_TYPES = [
  "ACCESS",
  "RECTIFICATION",
  "ERASURE",
] as const;
export const PRIVACY_REQUEST_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
] as const;
export const PRESENCE_KINDS = ["OFFICE", "REMOTE", "ABSENT"] as const;

/** Précision libre de la personne sur sa propre demande : 500 caractères, effacée avec la demande. */
export const PrivacyRequestInputSchema = z.object({
  type: z.enum(PRIVACY_REQUEST_TYPES),
  details: z.string().trim().max(500).default(""),
});
export type PrivacyRequestInput = z.infer<typeof PrivacyRequestInputSchema>;

export const RequestStatusSchema = z.enum(PRIVACY_REQUEST_STATUSES);

export const PrivacyRequestQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    RequestStatusSchema.optional().catch(undefined),
  ),
});

/** Transitions autorisées : une demande close ne se rouvre pas. */
export const REQUEST_TRANSITIONS: Record<
  (typeof PRIVACY_REQUEST_STATUSES)[number],
  ReadonlyArray<(typeof PRIVACY_REQUEST_STATUSES)[number]>
> = {
  OPEN: ["IN_PROGRESS", "DONE", "REJECTED"],
  IN_PROGRESS: ["DONE", "REJECTED"],
  DONE: [],
  REJECTED: [],
};

export const PresenceInputSchema = z.enum(PRESENCE_KINDS);

export const AUDIT_PAGE_SIZE = 50;

const dateInput = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.date().optional().catch(undefined),
);

export const AuditQuerySchema = z.object({
  from: dateInput,
  to: dateInput,
  action: text(80),
  resourceType: text(60),
  page: z.coerce.number().int().min(1).max(100_000).catch(1).default(1),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;
