// Gestion des comptes : réservée à l'admin, limitée à son entreprise, journalisée, sans jamais perdre le dernier admin.
import { beforeEach, describe, expect, it } from "vitest";
import {
  DuplicateError,
  ForbiddenError,
  getRepositories,
  InvalidOperationError,
  NotFoundError,
  WrongPasswordError,
} from "@/lib/db";
import { findAccessContext, findUserForLogin } from "@/lib/db/auth-store";
import { verifyPassword } from "@/lib/auth/password";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const repos = (fixture: FullFixture, who: "admin" | "manager" | "employee") =>
  getRepositories(fixture.accounts[who].context).accounts;
const auditCount = (orgId: string, action: string) =>
  testRawPrisma.auditLog.count({ where: { organizationId: orgId, action } });

async function freePerson(fixture: FullFixture) {
  const person = await testRawPrisma.person.create({
    data: {
      organizationId: fixture.organizationId,
      firstName: "Nina",
      lastName: "Nouvelle",
      workEmail: "nina@exemple.test",
      jobTitle: "Stagiaire",
    },
  });
  return person.id;
}

describe("comptes : droits et isolation", () => {
  it("seul l'administrateur gère les comptes", async () => {
    await expect(repos(a, "manager").list()).rejects.toThrow(ForbiddenError);
    await expect(
      repos(a, "employee").create({ email: "x@y.test", role: "EMPLOYEE" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("la liste ne montre que les comptes de l'entreprise, et la consultation est journalisée", async () => {
    const list = await repos(a, "admin").list();
    expect(list.map((account) => account.email).sort()).toEqual(
      Object.values(a.accounts)
        .map((account) => account.email)
        .sort(),
    );
    expect(await auditCount(a.organizationId, "user.list")).toBe(1);
  });

  it("un admin ne touche jamais aux comptes d'une autre entreprise", async () => {
    const other = b.accounts.employee.userId;
    await expect(repos(a, "admin").setRole(other, "ADMIN")).rejects.toThrow(
      NotFoundError,
    );
    await expect(repos(a, "admin").setDisabled(other, true)).rejects.toThrow(
      NotFoundError,
    );
    await expect(repos(a, "admin").resetPassword(other)).rejects.toThrow(
      NotFoundError,
    );
    const unchanged = await testRawPrisma.user.findUniqueOrThrow({
      where: { id: other },
    });
    expect(unchanged).toMatchObject({ role: "EMPLOYEE", disabledAt: null });
  });

  it("on ne rattache pas un collaborateur d'une autre entreprise", async () => {
    await expect(
      repos(a, "admin").create({
        email: "intrus@exemple.test",
        role: "EMPLOYEE",
        personId: b.accounts.employee.personId,
      }),
    ).rejects.toThrow();
  });
});

describe("création d'un compte", () => {
  it("crée un compte avec un mot de passe provisoire, à changer à la connexion", async () => {
    const personId = await freePerson(a);
    expect(
      (await repos(a, "admin").linkablePeople()).map((p) => p.id),
    ).toContain(personId);
    const { id, temporaryPassword } = await repos(a, "admin").create({
      email: "  Nina@Exemple.TEST ",
      role: "EMPLOYEE",
      personId,
    });
    expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    const user = await testRawPrisma.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({
      email: "nina@exemple.test",
      role: "EMPLOYEE",
      personId,
      mustChangePassword: true,
      organizationId: a.organizationId,
    });
    expect(user.passwordHash).not.toContain(temporaryPassword); // jamais stocké en clair
    expect(await verifyPassword(user.passwordHash, temporaryPassword!)).toBe(
      true,
    );
    expect((await findAccessContext(id))?.mustChangePassword).toBe(true);
    expect(await auditCount(a.organizationId, "user.create")).toBe(1);
    const log = await testRawPrisma.auditLog.findFirstOrThrow({
      where: { action: "user.create" },
    });
    expect(JSON.stringify(log)).not.toMatch(/nina/i);
  });

  it("refuse un e-mail déjà utilisé, un collaborateur déjà équipé ou parti, un rôle inconnu", async () => {
    const admin = repos(a, "admin");
    await expect(
      admin.create({ email: a.accounts.manager.email, role: "EMPLOYEE" }),
    ).rejects.toThrow(DuplicateError);
    await expect(
      admin.create({
        email: "deja@exemple.test",
        role: "EMPLOYEE",
        personId: a.accounts.employee.personId,
      }),
    ).rejects.toThrow(InvalidOperationError);
    const gone = await freePerson(a);
    await testRawPrisma.person.update({
      where: { id: gone },
      data: { status: "DEPARTED" },
    });
    await expect(
      admin.create({
        email: "parti@exemple.test",
        role: "EMPLOYEE",
        personId: gone,
      }),
    ).rejects.toThrow(InvalidOperationError);
    await expect(
      admin.create({ email: "r@exemple.test", role: "ROOT" }),
    ).rejects.toThrow();
    await expect(
      admin.create({ email: "pas-un-email", role: "EMPLOYEE" }),
    ).rejects.toThrow();
  });
});

describe("rôles et désactivation", () => {
  it("change un rôle, avec effet immédiat sur la session", async () => {
    await repos(a, "admin").setRole(a.accounts.employee.userId, "MANAGER");
    expect((await findAccessContext(a.accounts.employee.userId))?.role).toBe(
      "MANAGER",
    );
    expect(await auditCount(a.organizationId, "user.role")).toBe(1);
  });

  it("un admin ne modifie pas son propre compte ici", async () => {
    const self = a.accounts.admin.userId;
    await expect(repos(a, "admin").setRole(self, "EMPLOYEE")).rejects.toThrow(
      InvalidOperationError,
    );
    await expect(repos(a, "admin").setDisabled(self, true)).rejects.toThrow(
      InvalidOperationError,
    );
  });

  it("garde toujours au moins un administrateur actif", async () => {
    await repos(a, "admin").setRole(a.accounts.manager.userId, "ADMIN");
    const otherAdmin = getRepositories({
      ...a.accounts.manager.context,
      role: "ADMIN",
    }).accounts;
    // Le deuxième admin peut rétrograder le premier tant qu'il en reste un
    await otherAdmin.setRole(a.accounts.admin.userId, "MANAGER");
    await expect(
      getRepositories({
        ...a.accounts.admin.context,
        role: "ADMIN",
      }).accounts.setRole(a.accounts.manager.userId, "EMPLOYEE"),
    ).rejects.toThrow(InvalidOperationError);
  });

  it("désactive (session coupée, connexion refusée) puis réactive", async () => {
    const id = a.accounts.employee.userId;
    await repos(a, "admin").setDisabled(id, true);
    expect(await findAccessContext(id)).toBeNull();
    expect(
      (await findUserForLogin(a.accounts.employee.email))?.disabledAt,
    ).not.toBeNull();
    await repos(a, "admin").setDisabled(id, false);
    expect(await findAccessContext(id)).not.toBeNull();
    expect(await auditCount(a.organizationId, "user.disable")).toBe(1);
    expect(await auditCount(a.organizationId, "user.enable")).toBe(1);
  });

  it("un compte anonymisé ne se réactive pas", async () => {
    const id = a.accounts.employee.userId;
    await testRawPrisma.user.update({
      where: { id },
      data: {
        email: `anonyme-${id}@anonymise.invalid`,
        disabledAt: new Date(),
      },
    });
    await expect(repos(a, "admin").setDisabled(id, false)).rejects.toThrow(
      InvalidOperationError,
    );
  });
});

describe("mots de passe", () => {
  it("l'admin génère un nouveau mot de passe provisoire et lève le verrouillage", async () => {
    const id = a.accounts.employee.userId;
    const { attemptKey } = await import("@/lib/auth/rate-limit");
    await testRawPrisma.loginAttempt.create({
      data: {
        emailKey: attemptKey(a.accounts.employee.email),
        failures: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      },
    });
    const { temporaryPassword } = await repos(a, "admin").resetPassword(id);
    const user = await testRawPrisma.user.findUniqueOrThrow({ where: { id } });
    expect(await verifyPassword(user.passwordHash, temporaryPassword!)).toBe(
      true,
    );
    expect(user.mustChangePassword).toBe(true);
    expect(await testRawPrisma.loginAttempt.count()).toBe(0);
    expect(await auditCount(a.organizationId, "user.password.reset")).toBe(1);
  });

  it("chacun change son mot de passe en donnant l'actuel ; le provisoire est alors levé", async () => {
    const id = a.accounts.employee.userId;
    const { temporaryPassword } = await repos(a, "admin").resetPassword(id);
    const self = repos(a, "employee");
    await expect(
      self.changeOwnPassword({
        current: "faux",
        next: "Une-phrase-assez-longue",
        confirm: "Une-phrase-assez-longue",
      }),
    ).rejects.toThrow(WrongPasswordError);
    await expect(
      self.changeOwnPassword({
        current: temporaryPassword,
        next: "court",
        confirm: "court",
      }),
    ).rejects.toThrow();
    await expect(
      self.changeOwnPassword({
        current: temporaryPassword,
        next: "Une-phrase-assez-longue",
        confirm: "Une-autre-phrase-longue",
      }),
    ).rejects.toThrow();
    await self.changeOwnPassword({
      current: temporaryPassword,
      next: "Une-phrase-assez-longue",
      confirm: "Une-phrase-assez-longue",
    });
    const user = await testRawPrisma.user.findUniqueOrThrow({ where: { id } });
    expect(
      await verifyPassword(user.passwordHash, "Une-phrase-assez-longue"),
    ).toBe(true);
    expect(user.mustChangePassword).toBe(false);
    expect(await auditCount(a.organizationId, "user.password.change")).toBe(1);
  });
});
