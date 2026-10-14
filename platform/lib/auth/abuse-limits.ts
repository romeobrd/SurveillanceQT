// Limites contre les envois d'e-mails en masse (hameçonnage au nom de Spacora, test d'adresses en série).
// Compteurs en mémoire : aucune adresse IP n'est enregistrée.
import "server-only";
import { MemoryLimiter } from "./memory-limiter";

const HOUR = 3_600_000;

/** Inscriptions depuis une même adresse IP : 5 par heure. */
const signups = new MemoryLimiter({ max: 5, windowMs: HOUR, blockMs: HOUR });
/** « Mot de passe oublié » depuis une même adresse IP : 10 par heure. */
const resetRequests = new MemoryLimiter({
  max: 10,
  windowMs: HOUR,
  blockMs: HOUR,
});
/** Invitations et liens de réinitialisation envoyés par une entreprise : 30 par jour. */
const companyEmails = new MemoryLimiter({
  max: 30,
  windowMs: 24 * HOUR,
  blockMs: 24 * HOUR,
});

/** Chaque fonction compte un essai et renvoie vrai si la limite est dépassée (essai refusé). */
export function signupRefused(ip: string, now = Date.now()): boolean {
  if (signups.isBlocked(ip, now)) return true;
  signups.hit(ip, now);
  return false;
}

export function resetRequestRefused(ip: string, now = Date.now()): boolean {
  if (resetRequests.isBlocked(ip, now)) return true;
  resetRequests.hit(ip, now);
  return false;
}

export function companyEmailRefused(
  organizationId: string,
  now = Date.now(),
): boolean {
  if (companyEmails.isBlocked(organizationId, now)) return true;
  companyEmails.hit(organizationId, now);
  return false;
}
