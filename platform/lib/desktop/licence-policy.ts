// Règles de licence de l'application de bureau : code pur, testé.
// Contrôle auprès du serveur toutes les 12 h ; sans Internet, l'application reste utilisable jusqu'à la fin
// de validité de l'attestation signée (14 jours après le dernier contrôle réussi) ; un abonnement arrêté
// bloque l'application dès le contrôle suivant ; une horloge du PC remise en arrière est refusée.
import type { LicenceGrant } from "./licence-grant";
import type { StoredLicence } from "./licence-types";

export const REVERIFY_AFTER_MS = 12 * 3_600_000;
/** Écarts d'horloge tolérés : léger décalage avec le serveur, réglage de l'heure du PC. */
export const CLOCK_SKEW_MS = 5 * 60_000;
export const CLOCK_BACKWARD_MS = 3_600_000;

export type LicenceState =
  | { state: "valid"; stored: StoredLicence; grant: LicenceGrant }
  | { state: "missing" }
  /** Aucune clé de vérification dans ce logiciel : activation impossible. */
  | { state: "unconfigured" }
  /** Fichier de licence modifié, d'un ancien format ou signé par un autre serveur. */
  | { state: "invalid" }
  | { state: "inactive"; reason: "no_subscription" | "revoked" }
  | { state: "clock" }
  | { state: "offline_expired"; stored: StoredLicence; grant: LicenceGrant };

/** Faut-il recontacter le serveur ? */
export function needsVerification(grant: LicenceGrant, now: Date): boolean {
  return now.getTime() - grant.issuedAt >= REVERIFY_AFTER_MS;
}

/** L'horloge du PC a-t-elle été remise avant l'émission de la licence ou avant une date déjà constatée ? */
export function clockMovedBack(
  stored: StoredLicence,
  grant: LicenceGrant,
  now: Date,
): boolean {
  const time = now.getTime();
  const seen = Date.parse(stored.seenAt);
  return (
    time < grant.issuedAt - CLOCK_SKEW_MS ||
    (Number.isFinite(seen) && time < seen - CLOCK_BACKWARD_MS)
  );
}

/**
 * État de la licence sans nouveau contrôle.
 * @param grant attestation du fichier, déjà vérifiée (null si la signature est absente ou fausse)
 */
export function licenceState(
  stored: StoredLicence | null,
  grant: LicenceGrant | null,
  now: Date,
): LicenceState {
  if (!stored) return { state: "missing" };
  if (!grant) return { state: "invalid" };
  if (stored.status !== "active")
    return { state: "inactive", reason: stored.status };
  if (clockMovedBack(stored, grant, now)) return { state: "clock" };
  if (now.getTime() >= grant.expiresAt)
    return { state: "offline_expired", stored, grant };
  return { state: "valid", stored, grant };
}

/** Nouvelle date constatée à enregistrer, ou null si inutile (écriture au plus une fois par heure). */
export function nextSeenAt(stored: StoredLicence, now: Date): string | null {
  const seen = Date.parse(stored.seenAt);
  if (Number.isFinite(seen) && now.getTime() < seen + 3_600_000) return null;
  return now.toISOString();
}

/** Jours restants avant blocage faute de contrôle (pour prévenir l'utilisateur). */
export function offlineDaysLeft(grant: LicenceGrant, now: Date): number {
  return Math.max(0, Math.ceil((grant.expiresAt - now.getTime()) / 86_400_000));
}
