// Droits des personnes, présence, réglages et journal d'audit, via les dépôts (le chemin réel de l'application).
import { beforeEach, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  getRepositories,
  InvalidOperationError,
  NotFoundError,
} from "@/lib/db";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
  // Le jeu de données commun contient déjà une demande et une présence : on repart d'une base propre
  await testRawPrisma.privacyRequest.deleteMany();
  await testRawPrisma.presenceStatus.deleteMany();
});

const repos = (fixture: FullFixture, who: "admin" | "manager" | "employee") =>
  getRepositories(fixture.accounts[who].context);
const auditCount = (orgId: string, action: string) =>
  testRawPrisma.auditLog.count({ where: { organizationId: orgId, action } });

describe("« Mes données » : consultation et export", () => {
  it("ne montre que les données de la personne connectée", async () => {
    const data = (await repos(a, "employee").privacy.getMyData())!;
    expect(data.person).toMatchObject({
      firstName: "Sophie",
      lastName: "Bernard",
      jobTitle: "Développeuse",
    });
    expect(data.account?.email).toBe(a.accounts.employee.email);
    expect(data.assets.map((asset) => asset.serialNumber)).toEqual([
      `SN-${a.organizationId}`,
    ]);
    expect(data.workstations.length).toBeGreaterThan(0);
  });

  it("exporte un JSON lisible, complet pour soi et sans aucune donnée d'autrui", async () => {
    const exported = await repos(a, "employee").privacy.exportMyData();
    expect(exported).toMatchObject({
      format: "gestion-entreprise/mes-donnees",
      version: 1,
      organization: a.name,
    });
    expect(exported.person).toEqual({
      firstName: "Sophie",
      lastName: "Bernard",
      workEmail: "sophie.bernard@atelier-lumiere.example",
      jobTitle: "Développeuse",
      team: "Technique",
      status: "ACTIVE",
    });
    expect(exported.account).toEqual({
      email: a.accounts.employee.email,
      role: "EMPLOYEE",
    });
    expect(exported.assetHistory.length).toBeGreaterThan(0);
    const json = JSON.stringify(exported).toLowerCase();
    // Aucun autre collaborateur, aucun compte voisin, aucune donnée de l'autre entreprise
    for (const other of [
      "camille",
      "durand",
      "julien",
      "moreau",
      "lucas",
      "petit",
      "emma",
      "roux",
      "leroy",
      "fournier",
      "admin@",
      "manager@",
    ]) {
      expect(json).not.toContain(other);
    }
    expect(JSON.parse(JSON.stringify(exported))).toEqual(
      JSON.parse(JSON.stringify(exported)),
    ); // sérialisable tel quel
  });

  it("journalise la consultation et l'export, sans donnée personnelle dans le journal", async () => {
    await repos(a, "employee").privacy.getMyData();
    await repos(a, "employee").privacy.exportMyData();
    expect(await auditCount(a.organizationId, "privacy.view")).toBe(1);
    expect(await auditCount(a.organizationId, "privacy.export")).toBe(1);
    const rows = await testRawPrisma.auditLog.findMany({
      where: {
        organizationId: a.organizationId,
        action: { startsWith: "privacy." },
      },
    });
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "action",
        "actorId",
        "createdAt",
        "id",
        "organizationId",
        "resourceId",
        "resourceType",
      ]);
      expect(JSON.stringify(row).toLowerCase()).not.toMatch(/sophie|bernard/);
    }
  });

  it("refuse l'export d'un compte sans collaborateur rattaché", async () => {
    const orphan = getRepositories({
      ...a.accounts.employee.context,
      personId: null,
    }).privacy;
    await expect(orphan.exportMyData()).rejects.toThrow(NotFoundError);
    expect(await orphan.getMyData()).toBeNull();
  });
});

describe("demandes d'exercice des droits", () => {
  it("crée une demande de rectification avec précision, une seule ouverte par type", async () => {
    const employee = repos(a, "employee").privacy;
    const { id } = await employee.createRequest({
      type: "RECTIFICATION",
      details: "  Mon intitulé de poste est inexact.  ",
    });
    const mine = await employee.listMyRequests();
    expect(mine.find((request) => request.id === id)).toMatchObject({
      type: "RECTIFICATION",
      status: "OPEN",
      details: "Mon intitulé de poste est inexact.",
    });
    await expect(
      employee.createRequest({ type: "RECTIFICATION", details: "" }),
    ).rejects.toThrow(InvalidOperationError);
    await expect(
      employee.createRequest({ type: "ERASURE", details: "" }),
    ).resolves.toBeDefined(); // autre type : permis
  });

  it("refuse une précision trop longue ou un type inconnu", async () => {
    const employee = repos(a, "employee").privacy;
    await expect(
      employee.createRequest({ type: "ACCESS", details: "x".repeat(501) }),
    ).rejects.toThrow();
    await expect(
      employee.createRequest({ type: "AUTRE" as never, details: "" }),
    ).rejects.toThrow();
  });

  it("chacun ne voit que ses propres demandes ; seul l'administrateur voit celles de son entreprise", async () => {
    await repos(a, "employee").privacy.createRequest({
      type: "ACCESS",
      details: "",
    });
    await repos(a, "manager").privacy.createRequest({
      type: "ERASURE",
      details: "",
    });
    expect(
      (await repos(a, "manager").privacy.listMyRequests()).every(
        (request) => request.type !== "ACCESS",
      ),
    ).toBe(true);
    await expect(repos(a, "employee").privacy.listRequests()).rejects.toThrow(
      ForbiddenError,
    );
    await expect(repos(a, "manager").privacy.listRequests()).rejects.toThrow(
      ForbiddenError,
    );
    const all = await repos(a, "admin").privacy.listRequests();
    expect(all.map((request) => request.requesterName)).toEqual(
      expect.arrayContaining(["Sophie Bernard", "Julien Moreau"]),
    );
    // Rien de l'autre entreprise
    await repos(b, "employee").privacy.createRequest({
      type: "ACCESS",
      details: "",
    });
    expect(
      (await repos(a, "admin").privacy.listRequests()).every(
        (request) =>
          !["Nathan Girard", "Léa Fournier"].includes(request.requesterName),
      ),
    ).toBe(true);
    expect(await auditCount(a.organizationId, "privacy.request.list")).toBe(2);
  });

  it("suit les statuts avec des transitions valides, et fixe la date de clôture", async () => {
    const admin = repos(a, "admin").privacy;
    const { id } = await repos(a, "employee").privacy.createRequest({
      type: "ACCESS",
      details: "",
    });
    await admin.updateRequestStatus(id, "IN_PROGRESS");
    expect(
      (await testRawPrisma.privacyRequest.findUniqueOrThrow({ where: { id } }))
        .resolvedAt,
    ).toBeNull();
    await admin.updateRequestStatus(id, "DONE");
    const done = await testRawPrisma.privacyRequest.findUniqueOrThrow({
      where: { id },
    });
    expect(done.status).toBe("DONE");
    expect(done.resolvedAt).not.toBeNull();
    await expect(admin.updateRequestStatus(id, "OPEN")).rejects.toThrow(
      InvalidOperationError,
    ); // une demande close ne se rouvre pas
    await expect(admin.updateRequestStatus(id, "IN_PROGRESS")).rejects.toThrow(
      InvalidOperationError,
    );
    await expect(
      admin.updateRequestStatus(id, "N_IMPORTE_QUOI" as never),
    ).rejects.toThrow();
    await expect(
      repos(a, "manager").privacy.updateRequestStatus(id, "REJECTED"),
    ).rejects.toThrow(ForbiddenError);
  });

  it("exécute une demande d'effacement : la personne est anonymisée, la demande close", async () => {
    const { id } = await repos(a, "employee").privacy.createRequest({
      type: "ERASURE",
      details: "Je quitte l'entreprise.",
    });
    await repos(a, "admin").privacy.executeErasure(id);
    const person = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: a.accounts.employee.personId },
    });
    expect(person).toMatchObject({
      firstName: "Ancien",
      lastName: "Collaborateur",
    });
    const request = await testRawPrisma.privacyRequest.findUniqueOrThrow({
      where: { id },
    });
    expect(request).toMatchObject({ status: "DONE", details: "" });
    expect(await auditCount(a.organizationId, "person.anonymize")).toBe(1);
    await expect(repos(a, "admin").privacy.executeErasure(id)).rejects.toThrow(
      InvalidOperationError,
    ); // déjà close
  });

  it("n'exécute l'effacement que sur une demande d'effacement", async () => {
    const { id } = await repos(a, "employee").privacy.createRequest({
      type: "RECTIFICATION",
      details: "",
    });
    await expect(repos(a, "admin").privacy.executeErasure(id)).rejects.toThrow(
      InvalidOperationError,
    );
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: a.accounts.employee.personId },
        })
      ).firstName,
    ).toBe("Sophie");
  });

  it("l'administrateur d'une entreprise ne touche jamais aux demandes d'une autre", async () => {
    const { id } = await repos(b, "employee").privacy.createRequest({
      type: "ERASURE",
      details: "",
    });
    await expect(
      repos(a, "admin").privacy.updateRequestStatus(id, "DONE"),
    ).rejects.toThrow(NotFoundError);
    await expect(repos(a, "admin").privacy.executeErasure(id)).rejects.toThrow(
      NotFoundError,
    );
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: b.accounts.employee.personId },
        })
      ).anonymizedAt,
    ).toBeNull();
    expect(
      (await testRawPrisma.privacyRequest.findUniqueOrThrow({ where: { id } }))
        .status,
    ).toBe("OPEN");
  });
});

describe("présence déclarative", () => {
  const enable = (fixture: FullFixture, value = true) =>
    testRawPrisma.organization.update({
      where: { id: fixture.organizationId },
      data: { presenceEnabled: value },
    });

  it("est désactivée par défaut : aucune déclaration possible", async () => {
    expect(await repos(a, "employee").presence.getMine()).toEqual({
      enabled: false,
      status: null,
    });
    await expect(
      repos(a, "employee").presence.setMine("OFFICE"),
    ).rejects.toThrow(InvalidOperationError);
    expect(await repos(a, "employee").presence.todayCounts()).toBeNull();
  });

  it("se déclare soi-même, se corrige le même jour, s'efface", async () => {
    await enable(a);
    const employee = repos(a, "employee").presence;
    await employee.setMine("OFFICE");
    expect(await employee.getMine()).toEqual({
      enabled: true,
      status: "OFFICE",
    });
    await employee.setMine("REMOTE");
    expect(await employee.getMine()).toEqual({
      enabled: true,
      status: "REMOTE",
    });
    expect(
      await testRawPrisma.presenceStatus.count({
        where: { personId: a.accounts.employee.personId },
      }),
    ).toBe(1); // jamais d'historique
    await employee.clearMine();
    expect((await employee.getMine()).status).toBeNull();
    await expect(employee.setMine("AU_BUREAU" as never)).rejects.toThrow();
  });

  it("ne peut s'écrire que pour la personne connectée, jamais pour un autre", async () => {
    await enable(a);
    await repos(a, "manager").presence.setMine("ABSENT");
    expect(
      await testRawPrisma.presenceStatus.findMany({
        where: { organizationId: a.organizationId },
      }),
    ).toEqual([
      expect.objectContaining({
        personId: a.accounts.manager.personId,
        status: "ABSENT",
      }),
    ]);
    expect((await repos(a, "employee").presence.getMine()).status).toBeNull(); // le manager n'a rien déclaré pour l'employé
  });

  it("n'expose que des totaux du jour, sans nom, et seulement pour sa propre entreprise", async () => {
    await enable(a);
    await enable(b);
    await repos(a, "employee").presence.setMine("OFFICE");
    await repos(a, "manager").presence.setMine("OFFICE");
    await repos(a, "admin").presence.setMine("REMOTE");
    await repos(b, "employee").presence.setMine("ABSENT");
    expect(await repos(a, "employee").presence.todayCounts()).toEqual({
      office: 2,
      remote: 1,
      absent: 0,
    });
    expect(await repos(b, "manager").presence.todayCounts()).toEqual({
      office: 0,
      remote: 0,
      absent: 1,
    });
    expect((await repos(a, "manager").dashboard.get()).presence).toEqual({
      office: 2,
      remote: 1,
      absent: 0,
    });
  });

  it("n'est JAMAIS journalisée (un journal des déclarations serait un historique de présence)", async () => {
    await enable(a);
    const before = await testRawPrisma.auditLog.count({
      where: { organizationId: a.organizationId },
    });
    await repos(a, "employee").presence.setMine("OFFICE");
    await repos(a, "employee").presence.getMine();
    await repos(a, "employee").presence.todayCounts();
    await repos(a, "employee").presence.clearMine();
    expect(
      await testRawPrisma.auditLog.count({
        where: { organizationId: a.organizationId },
      }),
    ).toBe(before);
  });

  it("refuse un compte sans collaborateur rattaché", async () => {
    await enable(a);
    await testRawPrisma.user.update({
      where: { id: a.accounts.employee.userId },
      data: { personId: null },
    });
    const context = { ...a.accounts.employee.context, personId: null };
    await expect(
      getRepositories(context).presence.setMine("OFFICE"),
    ).rejects.toThrow(InvalidOperationError);
  });
});

describe("réglages de l'entreprise", () => {
  const valid = {
    presenceEnabled: true,
    auditRetentionDays: 200,
    privacyRequestRetentionDays: 800,
    departedPersonRetentionDays: 10,
  };

  it("sont réservés à l'administrateur", async () => {
    await expect(repos(a, "manager").settings.get()).rejects.toThrow(
      ForbiddenError,
    );
    await expect(repos(a, "employee").settings.update(valid)).rejects.toThrow(
      ForbiddenError,
    );
    expect(await repos(a, "admin").settings.get()).toMatchObject({
      presenceEnabled: false,
      auditRetentionDays: 365,
    });
  });

  it("enregistrent des valeurs valides et les journalisent, sans toucher l'autre entreprise", async () => {
    await repos(a, "admin").settings.update(valid);
    expect(await repos(a, "admin").settings.get()).toEqual(valid);
    expect(await repos(b, "admin").settings.get()).toMatchObject({
      presenceEnabled: false,
      auditRetentionDays: 365,
    });
    expect(await auditCount(a.organizationId, "org.settings.update")).toBe(1);
  });

  it("refusent des valeurs hors bornes", async () => {
    const admin = repos(a, "admin").settings;
    await expect(
      admin.update({ ...valid, auditRetentionDays: 5 }),
    ).rejects.toThrow();
    await expect(
      admin.update({ ...valid, auditRetentionDays: 99_999 }),
    ).rejects.toThrow();
    await expect(
      admin.update({ ...valid, departedPersonRetentionDays: -1 }),
    ).rejects.toThrow();
    await expect(
      admin.update({ ...valid, privacyRequestRetentionDays: 1.5 }),
    ).rejects.toThrow();
    expect((await admin.get()).auditRetentionDays).toBe(365);
  });

  it("désactiver la présence efface immédiatement toutes les déclarations", async () => {
    await repos(a, "admin").settings.update(valid);
    await repos(a, "employee").presence.setMine("OFFICE");
    await repos(a, "manager").presence.setMine("REMOTE");
    await repos(a, "admin").settings.update({
      ...valid,
      presenceEnabled: false,
    });
    expect(
      await testRawPrisma.presenceStatus.count({
        where: { organizationId: a.organizationId },
      }),
    ).toBe(0);
  });
});

describe("consultation du journal d'audit", () => {
  it("est réservée à l'administrateur", async () => {
    await expect(repos(a, "manager").audit.list()).rejects.toThrow(
      ForbiddenError,
    );
    await expect(repos(a, "employee").audit.actions()).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("ne montre que le journal de l'entreprise, avec des rôles et références, jamais de noms", async () => {
    await repos(a, "manager").people.list();
    await repos(b, "manager").people.list();
    const result = await repos(a, "admin").audit.list();
    expect(result.total).toBeGreaterThan(0);
    const ownIds = new Set(
      (
        await testRawPrisma.auditLog.findMany({
          where: { organizationId: a.organizationId },
        })
      ).map((row) => row.id),
    );
    expect(result.rows.every((row) => ownIds.has(row.id))).toBe(true);
    const listed = result.rows.find((row) => row.action === "person.list")!;
    expect(listed).toMatchObject({
      actorRole: "MANAGER",
      resourceType: "Person",
    });
    expect(listed.actorRef).toBe(a.accounts.manager.userId.slice(0, 8));
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(
      /julien|moreau|sophie|bernard|@atelier/,
    );
  });

  it("filtre par action et par période, et pagine", async () => {
    for (let i = 0; i < 60; i++)
      await testRawPrisma.auditLog.create({
        data: {
          organizationId: a.organizationId,
          action: "test.bulk",
          resourceType: "Test",
          actorId: a.accounts.admin.userId,
        },
      });
    await testRawPrisma.auditLog.create({
      data: {
        organizationId: a.organizationId,
        action: "test.old",
        resourceType: "Test",
        createdAt: new Date("2020-01-02T10:00:00Z"),
      },
    });
    const admin = repos(a, "admin").audit;
    const page1 = await admin.list({ action: "test.bulk" });
    expect(page1).toMatchObject({ total: 60, page: 1, pageCount: 2 });
    expect(page1.rows).toHaveLength(50);
    expect(
      (await admin.list({ action: "test.bulk", page: 2 })).rows,
    ).toHaveLength(10);
    const old = await admin.list({
      from: new Date("2020-01-02"),
      to: new Date("2020-01-02"),
    });
    expect(old.rows.map((row) => row.action)).toEqual(["test.old"]);
    expect(
      (await admin.list({ action: "test.bulk", page: -3 as never })).page,
    ).toBe(1);
    expect(await admin.actions()).toEqual(
      expect.arrayContaining(["test.bulk", "test.old"]),
    );
  });
});
