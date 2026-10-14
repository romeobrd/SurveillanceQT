// Licence de l'application de bureau : attestation signée par le site Spacora (Ed25519), vérifiée sur le PC
// avec la clé publique intégrée au logiciel. Personne d'autre que le site ne peut en fabriquer une :
// ni un faux serveur, ni une modification du fichier licence.json. Code pur, testé.
import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { z } from "zod";
import type { DesktopLicence } from "./licence-types";

/** Délai hors ligne : une attestation n'est plus valable 14 jours après son émission par le site. */
export const GRANT_LIFETIME_MS = 14 * 86_400_000;

export interface LicenceGrant {
  /** Compte client (administrateur) et son entreprise sur le site. */
  userId: string;
  licence: DesktopLicence;
  /** Émission et fin de validité hors ligne (millisecondes). */
  issuedAt: number;
  expiresAt: number;
}

const GrantSchema = z.object({
  v: z.literal(2),
  u: z.string().min(1).max(64),
  l: z.object({
    organizationId: z.string().min(1).max(64),
    organizationName: z.string().max(200),
    plan: z.string().max(40),
    planName: z.string().max(80),
    maxPeople: z.number().int().nonnegative(),
    validUntil: z.string().max(40).nullable(),
    admin: z.object({
      email: z.string().max(200),
      firstName: z.string().max(200),
      lastName: z.string().max(200),
    }),
  }),
  i: z.number().int().nonnegative(),
  e: z.number().int().nonnegative(),
});

/** Clé privée du site (variable DESKTOP_LICENCE_PRIVATE_KEY : DER PKCS#8 en base64). */
export function privateKeyFrom(base64: string): KeyObject {
  return createPrivateKey({
    key: Buffer.from(base64.trim(), "base64"),
    format: "der",
    type: "pkcs8",
  });
}

/** Clé publique (DER SPKI en base64), intégrée à l'application de bureau. */
export function publicKeyFrom(base64: string): KeyObject {
  return createPublicKey({
    key: Buffer.from(base64.trim(), "base64"),
    format: "der",
    type: "spki",
  });
}

export function signGrant(grant: LicenceGrant, privateKey: KeyObject): string {
  const body = Buffer.from(
    JSON.stringify({
      v: 2,
      u: grant.userId,
      l: grant.licence,
      i: grant.issuedAt,
      e: grant.expiresAt,
    }),
  ).toString("base64url");
  const signature = sign(null, Buffer.from(body), privateKey);
  return `${body}.${signature.toString("base64url")}`;
}

/** Contenu de l'attestation si elle est intacte et signée par la clé correspondante, sinon null. */
export function verifyGrant(
  token: string,
  publicKey: KeyObject,
): LicenceGrant | null {
  if (token.length > 4000) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    if (
      !verify(
        null,
        Buffer.from(body),
        publicKey,
        Buffer.from(signature, "base64url"),
      )
    )
      return null;
    const parsed = GrantSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.e <= parsed.data.i) return null;
    return {
      userId: parsed.data.u,
      licence: parsed.data.l,
      issuedAt: parsed.data.i,
      expiresAt: parsed.data.e,
    };
  } catch {
    return null;
  }
}
