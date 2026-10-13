// Limitation des tentatives de connexion (SPEC §8.8). Logique pure ; le stockage est dans lib/db.
import { createHash } from "node:crypto";

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

export interface AttemptState {
  failures: number;
  lockedUntil: Date | null;
}

/** Clé de compteur : empreinte de l'e-mail (aucune adresse e-mail ni IP n'est conservée). */
export function attemptKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function isLocked(state: AttemptState | null, now: Date): boolean {
  return state?.lockedUntil != null && state.lockedUntil > now;
}

/** État après un échec : le compteur repart de zéro une fois le verrouillage expiré. */
export function stateAfterFailure(
  state: AttemptState | null,
  now: Date,
): AttemptState {
  const expired = state?.lockedUntil != null && state.lockedUntil <= now;
  const failures = (expired || !state ? 0 : state.failures) + 1;
  return {
    failures,
    lockedUntil:
      failures >= MAX_FAILURES
        ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
        : null,
  };
}
