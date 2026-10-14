// Jeton de licence de l'application de bureau : identifie un compte client, signé par le serveur (HMAC-SHA256).
// Il ne donne aucun droit à lui seul : le serveur revérifie l'abonnement à chaque contrôle. Code pur, testé.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface LicencePayload {
  /** Utilisateur (administrateur du compte client) et entreprise. */
  userId: string;
  organizationId: string;
  /** Date d'émission (secondes). */
  issuedAt: number;
}

function key(secret: string): Buffer {
  // Clé dédiée, dérivée du secret du serveur : un jeton de licence ne vaut jamais comme cookie de session
  return createHash("sha256").update(`spacora-licence:${secret}`).digest();
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", key(secret)).update(body).digest("base64url");
}

export function signLicence(payload: LicencePayload, secret: string): string {
  const body = Buffer.from(
    JSON.stringify({
      v: 1,
      u: payload.userId,
      o: payload.organizationId,
      i: payload.issuedAt,
    }),
  ).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

/** Contenu du jeton s'il est intact et signé par ce serveur, sinon null. */
export function verifyLicence(
  token: string,
  secret: string,
): LicencePayload | null {
  if (token.length > 1000) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(signature(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null;
  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      data.v !== 1 ||
      typeof data.u !== "string" ||
      typeof data.o !== "string" ||
      typeof data.i !== "number"
    )
      return null;
    return { userId: data.u, organizationId: data.o, issuedAt: data.i };
  } catch {
    return null;
  }
}
