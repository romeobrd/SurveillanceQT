// Limitation des tentatives de connexion (SPEC §8.8). Logique pure ; le stockage est dans lib/db (compteur par
// compte) et en mémoire (par adresse IP, jamais enregistrée).
// Un inconnu ne doit pas pouvoir bloquer le compte d'un client : 5 erreurs bloquent seulement le couple
// « adresse IP + compte » ; le compte lui-même n'est bloqué qu'après une attaque massive (50 erreurs en 15 min,
// depuis de nombreuses adresses).
import { createHmac } from "node:crypto";
import type { LimitRule } from "./memory-limiter";

/** Compteur par compte (en base) : seuil d'attaque massive. */
export const MAX_FAILURES = 50;
export const LOCK_MINUTES = 15;
/** Les échecs plus anciens que cette fenêtre ne comptent plus. */
export const WINDOW_MINUTES = 15;

/** Couple adresse IP + compte : les fautes de frappe d'une personne. */
export const PAIR_RULE: LimitRule = {
  max: 5,
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
};
/** Adresse IP : essais sur de nombreux comptes (bureau partagé : plusieurs personnes derrière la même adresse). */
export const IP_RULE: LimitRule = {
  max: 30,
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
};

export interface AttemptState {
  failures: number;
  lockedUntil: Date | null;
  /** Dernier échec enregistré (fenêtre de comptage). */
  updatedAt?: Date;
}

/** Clé de compteur : empreinte de l'e-mail, avec le secret du serveur (aucune adresse e-mail conservée). */
export function attemptKey(email: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "spacora")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export function isLocked(state: AttemptState | null, now: Date): boolean {
  return state?.lockedUntil != null && state.lockedUntil > now;
}

/** État après un échec : le compteur repart de zéro après un verrouillage expiré ou une fenêtre écoulée. */
export function stateAfterFailure(
  state: AttemptState | null,
  now: Date,
): AttemptState {
  const expired = state?.lockedUntil != null && state.lockedUntil <= now;
  const stale =
    state?.lockedUntil == null &&
    state?.updatedAt !== undefined &&
    now.getTime() - state.updatedAt.getTime() >= WINDOW_MINUTES * 60_000;
  const failures = (expired || stale || !state ? 0 : state.failures) + 1;
  return {
    failures,
    lockedUntil:
      failures >= MAX_FAILURES
        ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
        : null,
  };
}
