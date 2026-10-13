// Durées de conservation et dates de purge (SPEC §8.2 et §8.6) : fonctions pures, testées.
import { z } from "zod";

/** Bornes et valeurs par défaut des durées de conservation, en jours. */
export const RETENTION = {
  auditRetentionDays: { min: 30, max: 1825, default: 365 },
  privacyRequestRetentionDays: { min: 90, max: 3650, default: 1095 },
  /** Délai entre le départ et l'anonymisation automatique (0 = immédiat). */
  departedPersonRetentionDays: { min: 0, max: 365, default: 30 },
} as const;

const days = (key: keyof typeof RETENTION) =>
  z.coerce.number().int().min(RETENTION[key].min).max(RETENTION[key].max);

export const OrganizationSettingsSchema = z.object({
  presenceEnabled: z.preprocess(
    (value) => value === true || value === "on" || value === "true",
    z.boolean(),
  ),
  auditRetentionDays: days("auditRetentionDays"),
  privacyRequestRetentionDays: days("privacyRequestRetentionDays"),
  departedPersonRetentionDays: days("departedPersonRetentionDays"),
});
export type OrganizationSettings = z.infer<typeof OrganizationSettingsSchema>;

const DAY_MS = 86_400_000;

/** Date limite : tout ce qui est plus ancien que `retentionDays` jours avant `now` doit être purgé. */
export function retentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

/**
 * « Aujourd'hui » en Europe/Paris, représenté par minuit UTC de ce jour (colonne SQL DATE).
 * Une présence déclarée est valable pour cette date et purgée dès le lendemain, quel que soit le fuseau du serveur.
 */
export function todayInParis(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // AAAA-MM-JJ
  return new Date(`${parts}T00:00:00.000Z`);
}
