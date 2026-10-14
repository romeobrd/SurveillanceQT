// Attestation de licence signée par le site (Ed25519) : seule la clé privée du site peut en produire une.
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  privateKeyFrom,
  publicKeyFrom,
  signGrant,
  verifyGrant,
  type LicenceGrant,
} from "@/lib/desktop/licence-grant";

const pair = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey: privateKeyFrom(
      privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    ),
    publicKey: publicKeyFrom(
      publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    ),
  };
};
const site = pair();
const grant: LicenceGrant = {
  userId: "user-1",
  issuedAt: 1_760_000_000_000,
  expiresAt: 1_760_000_000_000 + 14 * 86_400_000,
  licence: {
    organizationId: "org-1",
    organizationName: "Cabinet Martin",
    plan: "pro",
    planName: "Pro",
    maxPeople: 50,
    validUntil: null,
    admin: { email: "a@b.fr", firstName: "A", lastName: "B" },
  },
};

describe("attestation de licence", () => {
  it("est vérifiée avec la clé publique du site", () => {
    expect(
      verifyGrant(signGrant(grant, site.privateKey), site.publicKey),
    ).toEqual(grant);
  });

  it("refuse une attestation modifiée (offre, date) ou signée par une autre clé", () => {
    const token = signGrant(grant, site.privateKey);
    const [body, signature] = token.split(".");
    const tampered = Buffer.from(
      Buffer.from(body, "base64url")
        .toString("utf8")
        .replace('"plan":"pro"', '"plan":"business"'),
    ).toString("base64url");
    expect(verifyGrant(`${tampered}.${signature}`, site.publicKey)).toBeNull();
    const longer = { ...grant, expiresAt: grant.expiresAt + 365 * 86_400_000 };
    const forged = signGrant(longer, pair().privateKey);
    expect(verifyGrant(forged, site.publicKey)).toBeNull();
  });

  it("refuse les formats inattendus", () => {
    const token = signGrant(grant, site.privateKey);
    expect(verifyGrant(`${token}.x`, site.publicKey)).toBeNull();
    expect(verifyGrant(token.split(".")[0], site.publicKey)).toBeNull();
    expect(verifyGrant("n'importe quoi", site.publicKey)).toBeNull();
    expect(verifyGrant("x".repeat(5000), site.publicKey)).toBeNull();
  });
});
