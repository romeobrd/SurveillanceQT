// Authentification de la tâche planifiée : secret partagé, comparaison à temps constant.
import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_CRON_SECRET_LENGTH = 32;

export type CronAuthResult = "ok" | "unauthorized" | "not_configured";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Vérifie l'en-tête `Authorization: Bearer <secret>`. Sans secret solide configuré, la route est fermée. */
export function checkCronAuthorization(
  header: string | null,
  secret: string | undefined,
): CronAuthResult {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH)
    return "not_configured";
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) return "unauthorized";
  // Comparaison des empreintes : durée indépendante du contenu et de la longueur fournie
  return timingSafeEqual(digest(header.slice(prefix.length)), digest(secret))
    ? "ok"
    : "unauthorized";
}
