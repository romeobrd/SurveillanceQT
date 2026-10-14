// Émission des attestations de licence par le site (activation et contrôles de l'application de bureau).
import "server-only";
import type { DesktopLicence } from "./licence-types";
import { GRANT_LIFETIME_MS, signGrant } from "./licence-grant";
import { siteSigningKey } from "./licence-keys";

/** Attestation signée valable 14 jours hors ligne, ou null si la clé du site n'est pas configurée. */
export function issueGrant(
  userId: string,
  licence: DesktopLicence,
  now: Date,
): string | null {
  const key = siteSigningKey();
  if (!key) return null;
  const issuedAt = now.getTime();
  return signGrant(
    { userId, licence, issuedAt, expiresAt: issuedAt + GRANT_LIFETIME_MS },
    key,
  );
}
