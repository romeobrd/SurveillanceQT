import { beforeAll, describe, expect, it } from "vitest";
import { attemptKey, LOCK_MINUTES, MAX_FAILURES } from "@/lib/auth/rate-limit";
import {
  clearAttempts,
  findAccessContext,
  findUserForLogin,
  getAttemptState,
  registerFailure,
} from "@/lib/db/auth-store";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeAll(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

describe("comptes", () => {
  it("retrouve un compte par e-mail sans tenir compte de la casse", async () => {
    const user = await findUserForLogin(a.accounts.admin.email.toUpperCase());
    expect(user?.id).toBe(a.accounts.admin.userId);
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("ne retrouve pas un compte inconnu", async () => {
    expect(await findUserForLogin("inconnu@exemple.example")).toBeNull();
  });

  it("relit rôle et entreprise en base (jamais depuis le jeton)", async () => {
    const context = await findAccessContext(b.accounts.manager.userId);
    expect(context).toMatchObject({
      userId: b.accounts.manager.userId,
      organizationId: b.organizationId,
      role: "MANAGER",
      organizationName: b.name,
    });
    await testRawPrisma.user.update({
      where: { id: b.accounts.manager.userId },
      data: { role: "EMPLOYEE" },
    });
    expect((await findAccessContext(b.accounts.manager.userId))?.role).toBe(
      "EMPLOYEE",
    );
    expect(await findAccessContext("compte-supprime")).toBeNull();
  });
});

describe("verrouillage de connexion", () => {
  const key = attemptKey("cible@exemple.example");
  const now = new Date("2026-03-01T08:00:00Z");

  it("verrouille après MAX_FAILURES échecs, puis se déverrouille à l'échéance", async () => {
    for (let i = 1; i < MAX_FAILURES; i++)
      expect((await registerFailure(key, now)).lockedUntil).toBeNull();
    const locked = await registerFailure(key, now);
    expect(locked.lockedUntil?.getTime()).toBe(
      now.getTime() + LOCK_MINUTES * 60_000,
    );
    expect((await getAttemptState(key))?.failures).toBe(MAX_FAILURES);

    const later = new Date(now.getTime() + (LOCK_MINUTES + 1) * 60_000);
    expect(await registerFailure(key, later)).toEqual({
      failures: 1,
      lockedUntil: null,
    });
  });

  it("une connexion réussie remet le compteur à zéro", async () => {
    await registerFailure(key, now);
    await clearAttempts(key);
    expect(await getAttemptState(key)).toBeNull();
  });

  it("ne stocke ni l'e-mail ni aucune adresse IP", async () => {
    await registerFailure(key, now);
    const rows = await testRawPrisma.loginAttempt.findMany();
    expect(Object.keys(rows[0]).sort()).toEqual([
      "emailKey",
      "failures",
      "lockedUntil",
      "updatedAt",
    ]);
    expect(JSON.stringify(rows)).not.toContain("cible@");
  });
});
