// Jeton de licence de l'application de bureau : signé, infalsifiable, lié au secret du serveur.
import { describe, expect, it } from "vitest";
import { signLicence, verifyLicence } from "@/lib/desktop/licence-token";

const secret = "un-secret-de-test-suffisamment-long-0123456789";
const payload = { userId: "u1", organizationId: "o1", issuedAt: 1_800_000_000 };

describe("jeton de licence", () => {
  it("se vérifie avec le secret qui l'a signé", () => {
    expect(verifyLicence(signLicence(payload, secret), secret)).toEqual(
      payload,
    );
  });

  it("refuse un jeton modifié, d'un autre serveur ou mal formé", () => {
    const token = signLicence(payload, secret);
    const [body, mac] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ v: 1, u: "u1", o: "autre", i: 1 }),
    ).toString("base64url");
    expect(verifyLicence(`${forged}.${mac}`, secret)).toBeNull();
    expect(verifyLicence(token, "autre-secret")).toBeNull();
    expect(verifyLicence(`${body}.`, secret)).toBeNull();
    expect(verifyLicence(`${token}.x`, secret)).toBeNull();
    expect(verifyLicence("n'importe quoi", secret)).toBeNull();
    expect(verifyLicence("x".repeat(2000), secret)).toBeNull();
  });
});
