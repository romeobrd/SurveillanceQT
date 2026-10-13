// Départ, anonymisation (SPEC §8.5) et purge planifiée (SPEC §8.2 et §8.6).
import { beforeEach, describe, expect, it } from "vitest";
import { attemptKey } from "@/lib/auth/rate-limit";
import { findAccessContext, findUserForLogin } from "@/lib/db/auth-store";
import { NotFoundError, InvalidOperationError } from "@/lib/db";
import {
  anonymizePerson,
  departPerson,
  UNUSABLE_PASSWORD_HASH,
} from "@/lib/db/privacy-core";
import { runPurge } from "@/lib/db/purge";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { verifyPassword } from "@/lib/auth/password";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const DAY = 86_400_000;
const daysAgo = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY);

describe("départ d'un collaborateur", () => {
  it("désactive le compte immédiatement : plus de session, plus de connexion", async () => {
    const employee = a.accounts.employee;
    expect(await findAccessContext(employee.userId)).not.toBeNull();
    await departPerson(a.organizationId, employee.personId);
    expect(await findAccessContext(employee.userId)).toBeNull(); // effet immédiat sur les sessions existantes
    const user = await findUserForLogin(employee.email);
    expect(user?.disabledAt).not.toBeNull();
    const person = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: employee.personId },
    });
    expect(person).toMatchObject({ status: "DEPARTED", anonymizedAt: null });
    expect(person.departedAt).not.toBeNull();
    expect(person.firstName).toBe("Sophie"); // les données restent jusqu'à l'anonymisation
  });

  it("libère le poste et le matériel en conservant l'historique", async () => {
    const employee = a.accounts.employee;
    const station = await testRawPrisma.workstation.findFirstOrThrow({
      where: { organizationId: a.organizationId, personId: employee.personId },
    });
    await departPerson(a.organizationId, employee.personId);
    expect(
      (
        await testRawPrisma.workstation.findUniqueOrThrow({
          where: { id: station.id },
        })
      ).personId,
    ).toBeNull();
    expect(
      (
        await testRawPrisma.asset.findUniqueOrThrow({
          where: { id: a.ids.Asset },
        })
      ).personId,
    ).toBeNull();
    const history = await testRawPrisma.assetAssignment.findMany({
      where: { assetId: a.ids.Asset, personId: employee.personId },
    });
    expect(history).toHaveLength(1);
    expect(history[0].releasedAt).not.toBeNull();
  });

  it("refuse un second départ et un collaborateur d'une autre entreprise", async () => {
    await departPerson(a.organizationId, a.accounts.employee.personId);
    await expect(
      departPerson(a.organizationId, a.accounts.employee.personId),
    ).rejects.toThrow(InvalidOperationError);
    await expect(
      departPerson(a.organizationId, b.accounts.employee.personId),
    ).rejects.toThrow(NotFoundError);
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: b.accounts.employee.personId },
        })
      ).status,
    ).toBe("ACTIVE");
    expect(
      (await findUserForLogin(b.accounts.employee.email))?.disabledAt,
    ).toBeNull();
  });
});

describe("anonymisation", () => {
  it("efface toute donnée personnelle et rend le compte inutilisable", async () => {
    const employee = a.accounts.employee;
    await testRawPrisma.presenceStatus.deleteMany({
      where: { organizationId: a.organizationId },
    });
    await testRawPrisma.presenceStatus.create({
      data: {
        organizationId: a.organizationId,
        personId: employee.personId,
        status: "REMOTE",
        date: new Date(),
      },
    });
    await testRawPrisma.privacyRequest.update({
      where: { id: a.ids.PrivacyRequest },
      data: { details: "Mon prénom est mal orthographié (Sophie)" },
    });
    await testRawPrisma.loginAttempt.create({
      data: { emailKey: attemptKey(employee.email), failures: 2 },
    });

    const result = await anonymizePerson(a.organizationId, employee.personId);
    expect(result.alreadyAnonymized).toBe(false);

    const person = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: employee.personId },
    });
    expect(person).toMatchObject({
      firstName: "Ancien",
      lastName: "Collaborateur",
      jobTitle: "Anonymisé",
      status: "DEPARTED",
    });
    expect(person.workEmail).toBe(
      `anonyme-${employee.personId}@anonymise.invalid`,
    );
    expect(person.anonymizedAt).not.toBeNull();

    const user = await testRawPrisma.user.findUniqueOrThrow({
      where: { id: employee.userId },
    });
    expect(user.email).toBe(`anonyme-${employee.userId}@anonymise.invalid`);
    expect(user.passwordHash).toBe(UNUSABLE_PASSWORD_HASH);
    expect(user.disabledAt).not.toBeNull();
    expect(await verifyPassword(user.passwordHash, "Demo-Password-2026!")).toBe(
      false,
    );
    expect(await findUserForLogin(employee.email)).toBeNull(); // l'ancien e-mail n'existe plus
    expect(await findAccessContext(employee.userId)).toBeNull();

    expect(
      await testRawPrisma.presenceStatus.count({
        where: { personId: employee.personId },
      }),
    ).toBe(0);
    expect(
      await testRawPrisma.loginAttempt.count({
        where: { emailKey: attemptKey(employee.email) },
      }),
    ).toBe(0);
    expect(
      (
        await testRawPrisma.privacyRequest.findUniqueOrThrow({
          where: { id: a.ids.PrivacyRequest },
        })
      ).details,
    ).toBe("");
    expect(
      await testRawPrisma.assetAssignment.count({
        where: {
          organizationId: a.organizationId,
          personId: employee.personId,
        },
      }),
    ).toBe(0);
  });

  it("ne laisse plus aucune trace de la personne dans aucune table", async () => {
    const employee = a.accounts.employee;
    await anonymizePerson(a.organizationId, employee.personId);
    const where = { organizationId: a.organizationId };
    const dump = JSON.stringify({
      people: await testRawPrisma.person.findMany({ where }),
      users: await testRawPrisma.user.findMany({ where }),
      requests: await testRawPrisma.privacyRequest.findMany({ where }),
      assignments: await testRawPrisma.assetAssignment.findMany({ where }),
      workstations: await testRawPrisma.workstation.findMany({ where }),
      assets: await testRawPrisma.asset.findMany({ where }),
      movements: await testRawPrisma.stockMovement.findMany({ where }),
      audit: await testRawPrisma.auditLog.findMany({ where }),
      presence: await testRawPrisma.presenceStatus.findMany({ where }),
      attempts: await testRawPrisma.loginAttempt.findMany(),
    }).toLowerCase();
    for (const trace of [
      "sophie",
      "bernard",
      "sophie.bernard",
      "employee@atelier",
    ])
      expect(dump).not.toContain(trace);
  });

  it("conserve l'historique du stock et du matériel sous forme non nominative", async () => {
    const manager = a.accounts.manager;
    const movements = await testRawPrisma.stockMovement.count({
      where: { organizationId: a.organizationId },
    });
    const history = await testRawPrisma.assetAssignment.count({
      where: { organizationId: a.organizationId },
    });
    await anonymizePerson(a.organizationId, manager.personId); // auteur du mouvement de stock de la fixture
    expect(
      await testRawPrisma.stockMovement.count({
        where: { organizationId: a.organizationId },
      }),
    ).toBe(movements);
    expect(
      await testRawPrisma.assetAssignment.count({
        where: { organizationId: a.organizationId },
      }),
    ).toBe(history);
    const movement = await testRawPrisma.stockMovement.findUniqueOrThrow({
      where: { id: a.ids.StockMovement },
    });
    expect(movement.authorId).toBe(manager.userId); // l'auteur reste désigné, mais par un compte désormais anonyme
    expect(
      (
        await testRawPrisma.user.findUniqueOrThrow({
          where: { id: manager.userId },
        })
      ).email,
    ).toContain("anonymise.invalid");
  });

  it("est idempotente, et ne touche jamais une autre entreprise", async () => {
    await anonymizePerson(a.organizationId, a.accounts.employee.personId);
    expect(
      (await anonymizePerson(a.organizationId, a.accounts.employee.personId))
        .alreadyAnonymized,
    ).toBe(true);
    await expect(
      anonymizePerson(a.organizationId, b.accounts.employee.personId),
    ).rejects.toThrow(NotFoundError);
    const other = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: b.accounts.employee.personId },
    });
    expect(other.firstName).not.toBe("Ancien");
    expect(other.anonymizedAt).toBeNull();
  });

  it("anonymise aussi un collaborateur encore actif (demande d'effacement) : il est alors parti", async () => {
    await anonymizePerson(a.organizationId, a.accounts.employee.personId);
    const person = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: a.accounts.employee.personId },
    });
    expect(person.status).toBe("DEPARTED");
    expect(person.departedAt).not.toBeNull();
  });
});

describe("purge planifiée", () => {
  const now = new Date("2026-06-15T10:00:00Z");

  async function audit(orgId: string, createdAt: Date, action = "test.old") {
    return testRawPrisma.auditLog.create({
      data: { organizationId: orgId, action, resourceType: "Test", createdAt },
    });
  }

  it("supprime le journal plus ancien que la durée de conservation de CHAQUE entreprise", async () => {
    await testRawPrisma.auditLog.deleteMany({});
    await testRawPrisma.organization.update({
      where: { id: a.organizationId },
      data: { auditRetentionDays: 100 },
    });
    await testRawPrisma.organization.update({
      where: { id: b.organizationId },
      data: { auditRetentionDays: 1000 },
    });
    const oldA = await audit(a.organizationId, daysAgo(now, 101));
    const freshA = await audit(a.organizationId, daysAgo(now, 99));
    const oldB = await audit(b.organizationId, daysAgo(now, 101)); // trop vieux pour A, pas pour B
    const report = await runPurge(now);
    expect(
      await testRawPrisma.auditLog.findUnique({ where: { id: oldA.id } }),
    ).toBeNull();
    expect(
      await testRawPrisma.auditLog.findUnique({ where: { id: freshA.id } }),
    ).not.toBeNull();
    expect(
      await testRawPrisma.auditLog.findUnique({ where: { id: oldB.id } }),
    ).not.toBeNull();
    expect(
      report.organizations.find((o) => o.organizationId === a.organizationId)
        ?.auditLogs,
    ).toBe(1);
    expect(
      report.organizations.find((o) => o.organizationId === b.organizationId)
        ?.auditLogs,
    ).toBe(0);
  });

  it("supprime les demandes closes anciennes, jamais les demandes ouvertes", async () => {
    await testRawPrisma.privacyRequest.deleteMany({});
    const base = {
      organizationId: a.organizationId,
      requesterId: a.accounts.employee.userId,
      type: "ACCESS" as const,
    };
    const doneOld = await testRawPrisma.privacyRequest.create({
      data: {
        ...base,
        status: "DONE",
        createdAt: daysAgo(now, 2000),
        resolvedAt: daysAgo(now, 1200),
      },
    });
    const doneRecent = await testRawPrisma.privacyRequest.create({
      data: {
        ...base,
        status: "DONE",
        createdAt: daysAgo(now, 2000),
        resolvedAt: daysAgo(now, 100),
      },
    });
    const openOld = await testRawPrisma.privacyRequest.create({
      data: { ...base, status: "OPEN", createdAt: daysAgo(now, 3000) },
    });
    const rejectedNoDate = await testRawPrisma.privacyRequest.create({
      data: { ...base, status: "REJECTED", createdAt: daysAgo(now, 1500) },
    });
    await runPurge(now);
    expect(
      await testRawPrisma.privacyRequest.findUnique({
        where: { id: doneOld.id },
      }),
    ).toBeNull();
    expect(
      await testRawPrisma.privacyRequest.findUnique({
        where: { id: doneRecent.id },
      }),
    ).not.toBeNull();
    expect(
      await testRawPrisma.privacyRequest.findUnique({
        where: { id: openOld.id },
      }),
    ).not.toBeNull();
    expect(
      await testRawPrisma.privacyRequest.findUnique({
        where: { id: rejectedNoDate.id },
      }),
    ).toBeNull();
  });

  it("anonymise les collaborateurs partis depuis plus longtemps que la durée de conservation", async () => {
    await testRawPrisma.organization.update({
      where: { id: a.organizationId },
      data: { departedPersonRetentionDays: 30 },
    });
    const { manager, employee } = a.accounts;
    await departPerson(a.organizationId, employee.personId, daysAgo(now, 31));
    await departPerson(a.organizationId, manager.personId, daysAgo(now, 29));
    const report = await runPurge(now);
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: employee.personId },
        })
      ).anonymizedAt,
    ).not.toBeNull();
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: manager.personId },
        })
      ).anonymizedAt,
    ).toBeNull();
    expect(
      report.organizations.find((o) => o.organizationId === a.organizationId)
        ?.anonymizedPeople,
    ).toBe(1);
    // Aucun effet sur l'autre entreprise
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: b.accounts.employee.personId },
        })
      ).anonymizedAt,
    ).toBeNull();
  });

  it("anonymise tout de suite quand la durée est de 0 jour", async () => {
    await testRawPrisma.organization.update({
      where: { id: a.organizationId },
      data: { departedPersonRetentionDays: 0 },
    });
    await departPerson(a.organizationId, a.accounts.employee.personId, now);
    await runPurge(now);
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: a.accounts.employee.personId },
        })
      ).anonymizedAt,
    ).not.toBeNull();
  });

  it("ne conserve jamais l'historique de présence : tout ce qui précède aujourd'hui disparaît", async () => {
    await testRawPrisma.organization.update({
      where: { id: a.organizationId },
      data: { presenceEnabled: true },
    });
    const person = a.accounts.employee.personId;
    const day = (offset: number) =>
      new Date(`2026-06-${15 + offset}T00:00:00.000Z`);
    const old = await testRawPrisma.presenceStatus.create({
      data: {
        organizationId: a.organizationId,
        personId: person,
        status: "OFFICE",
        date: day(-3),
      },
    });
    const yesterday = await testRawPrisma.presenceStatus.create({
      data: {
        organizationId: a.organizationId,
        personId: a.accounts.manager.personId,
        status: "REMOTE",
        date: day(-1),
      },
    });
    const today = await testRawPrisma.presenceStatus.create({
      data: {
        organizationId: a.organizationId,
        personId: a.accounts.admin.personId,
        status: "ABSENT",
        date: day(0),
      },
    });
    await runPurge(now);
    expect(
      await testRawPrisma.presenceStatus.findUnique({ where: { id: old.id } }),
    ).toBeNull();
    expect(
      await testRawPrisma.presenceStatus.findUnique({
        where: { id: yesterday.id },
      }),
    ).toBeNull();
    expect(
      await testRawPrisma.presenceStatus.findUnique({
        where: { id: today.id },
      }),
    ).not.toBeNull();
    // Passé minuit à Paris, la déclaration du jour est elle aussi purgée
    await runPurge(new Date("2026-06-15T22:30:00Z"));
    expect(
      await testRawPrisma.presenceStatus.findUnique({
        where: { id: today.id },
      }),
    ).toBeNull();
  });

  it("supprime toute présence quand la fonction est désactivée par l'entreprise", async () => {
    const row = await testRawPrisma.presenceStatus.create({
      data: {
        organizationId: b.organizationId,
        personId: b.accounts.employee.personId,
        status: "OFFICE",
        date: new Date("2026-06-15T00:00:00.000Z"),
      },
    });
    expect(
      (
        await testRawPrisma.organization.findUniqueOrThrow({
          where: { id: b.organizationId },
        })
      ).presenceEnabled,
    ).toBe(false);
    await runPurge(now);
    expect(
      await testRawPrisma.presenceStatus.findUnique({ where: { id: row.id } }),
    ).toBeNull();
  });

  it("est idempotente et nettoie les anciens compteurs de connexion", async () => {
    await testRawPrisma.loginAttempt.create({
      data: { emailKey: "ancien", failures: 3, updatedAt: daysAgo(now, 3) },
    });
    await testRawPrisma.loginAttempt.create({
      data: {
        emailKey: "verrouille",
        failures: 5,
        lockedUntil: new Date(now.getTime() + 600_000),
        updatedAt: daysAgo(now, 3),
      },
    });
    await testRawPrisma.auditLog.create({
      data: {
        organizationId: a.organizationId,
        action: "test.old",
        resourceType: "Test",
        createdAt: daysAgo(now, 4000),
      },
    });
    const first = await runPurge(now);
    expect(first.loginAttempts).toBeGreaterThanOrEqual(1);
    expect(
      await testRawPrisma.loginAttempt.findUnique({
        where: { emailKey: "ancien" },
      }),
    ).toBeNull();
    expect(
      await testRawPrisma.loginAttempt.findUnique({
        where: { emailKey: "verrouille" },
      }),
    ).not.toBeNull();
    const second = await runPurge(now);
    expect(second.loginAttempts).toBe(0);
    for (const report of second.organizations) {
      expect([
        report.auditLogs,
        report.privacyRequests,
        report.anonymizedPeople,
        report.presenceStatuses,
      ]).toEqual([0, 0, 0, 0]);
    }
  });

  it("trace son exécution par un identifiant seulement, sans donnée personnelle", async () => {
    await testRawPrisma.auditLog.create({
      data: {
        organizationId: a.organizationId,
        action: "test.old",
        resourceType: "Test",
        createdAt: daysAgo(now, 4000),
      },
    });
    await runPurge(now);
    const trace = await testRawPrisma.auditLog.findFirstOrThrow({
      where: { organizationId: a.organizationId, action: "purge.run" },
    });
    expect(trace).toMatchObject({
      actorId: null,
      resourceType: "Organization",
      resourceId: a.organizationId,
    });
  });
});
