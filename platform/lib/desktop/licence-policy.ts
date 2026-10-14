// Règles de licence de l'application de bureau : code pur, testé.
// Contrôle auprès du serveur toutes les 12 h ; sans Internet, l'application reste utilisable 14 jours
// après le dernier contrôle réussi ; un abonnement arrêté bloque l'application dès le contrôle suivant.
import type { StoredLicence } from "./licence-types";

export const REVERIFY_AFTER_MS = 12 * 3_600_000;
export const OFFLINE_GRACE_MS = 14 * 86_400_000;

export type LicenceState =
  | { state: "valid"; stored: StoredLicence }
  | { state: "missing" }
  | { state: "inactive"; reason: "no_subscription" | "revoked" }
  | { state: "offline_expired"; stored: StoredLicence };

/** Faut-il recontacter le serveur ? */
export function needsVerification(stored: StoredLicence, now: Date): boolean {
  return (
    now.getTime() - new Date(stored.lastVerifiedAt).getTime() >=
    REVERIFY_AFTER_MS
  );
}

/** État de la licence sans nouveau contrôle (dernier état connu, délai hors ligne). */
export function licenceState(
  stored: StoredLicence | null,
  now: Date,
): LicenceState {
  if (!stored) return { state: "missing" };
  if (stored.status !== "active")
    return { state: "inactive", reason: stored.status };
  const age = now.getTime() - new Date(stored.lastVerifiedAt).getTime();
  if (age > OFFLINE_GRACE_MS) return { state: "offline_expired", stored };
  return { state: "valid", stored };
}

/** Jours restants avant blocage faute de contrôle (pour prévenir l'utilisateur). */
export function offlineDaysLeft(stored: StoredLicence, now: Date): number {
  const left =
    OFFLINE_GRACE_MS -
    (now.getTime() - new Date(stored.lastVerifiedAt).getTime());
  return Math.max(0, Math.ceil(left / 86_400_000));
}
