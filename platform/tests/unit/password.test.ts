import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("mots de passe", () => {
  it("utilise argon2id", async () => {
    expect(await hashPassword("un-mot-de-passe-solide")).toMatch(
      /^\$argon2id\$/,
    );
  });

  it("vérifie le bon mot de passe et refuse les autres", async () => {
    const hash = await hashPassword("un-mot-de-passe-solide");
    expect(await verifyPassword(hash, "un-mot-de-passe-solide")).toBe(true);
    expect(await verifyPassword(hash, "un-autre-mot-de-passe")).toBe(false);
  });

  it("produit des hash différents (sel aléatoire) pour le même mot de passe", async () => {
    expect(await hashPassword("même-mot-de-passe")).not.toBe(
      await hashPassword("même-mot-de-passe"),
    );
  });

  it("refuse sans lever d'erreur un hash invalide", async () => {
    expect(await verifyPassword("pas-un-hash", "x")).toBe(false);
  });
});
