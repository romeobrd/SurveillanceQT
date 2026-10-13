// Droits par rôle et isolation vérifiés au niveau des dépôts de données (le chemin réellement utilisé par l'application).
import { beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError, getRepositories } from "@/lib/db";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeAll(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const repos = (fixture: FullFixture, who: "admin" | "manager" | "employee") =>
  getRepositories(fixture.accounts[who].context);

describe("employé", () => {
  it("ne peut ni aménager, ni attribuer un poste, ni créer un collaborateur", async () => {
    const employee = repos(a, "employee");
    const layout = (await employee.layouts.getActive())!.layout;
    await expect(employee.layouts.saveNewVersion(layout)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      employee.workstations.assign({
        workstationId: a.ids.Workstation,
        personId: null,
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      employee.people.create({
        firstName: "A",
        lastName: "B",
        workEmail: "a.b@x.example",
        jobTitle: "x",
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(employee.teams.create("Nouvelle équipe")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("voit l'annuaire minimal, sans adresse e-mail", async () => {
    const directory = await repos(a, "employee").people.listDirectory();
    expect(directory.length).toBeGreaterThan(0);
    for (const entry of directory) {
      expect(Object.keys(entry).sort()).toEqual([
        "firstName",
        "id",
        "jobTitle",
        "lastName",
        "teamId",
        "teamName",
        "zoneKey",
      ]);
    }
  });

  it("peut consulter la carte active", async () => {
    const active = await repos(a, "employee").layouts.getActive();
    expect(active?.layout.zones.length).toBeGreaterThan(0);
  });
});

describe("manager", () => {
  it("voit les adresses e-mail professionnelles", async () => {
    const directory = await repos(a, "manager").people.listDirectory();
    expect(
      directory.every((entry) => typeof entry.workEmail === "string"),
    ).toBe(true);
  });

  it("aménage les locaux et attribue les postes", async () => {
    const manager = repos(a, "manager");
    const layout = (await manager.layouts.getActive())!.layout;
    await expect(manager.layouts.saveNewVersion(layout)).resolves.toMatchObject(
      { version: 2 },
    );
    await expect(
      manager.workstations.assign({
        workstationId: a.ids.Workstation,
        personId: a.accounts.manager.personId,
      }),
    ).resolves.toBeUndefined();
  });

  it("ne crée pas de collaborateur (réservé à l'admin)", async () => {
    await expect(
      repos(a, "manager").people.create({
        firstName: "A",
        lastName: "B",
        workEmail: "a.b@x.example",
        jobTitle: "x",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("admin", () => {
  it("crée et modifie un collaborateur, avec validation des entrées", async () => {
    const admin = repos(a, "admin");
    const { id } = await admin.people.create({
      firstName: "  Alice ",
      lastName: "Martin",
      workEmail: "ALICE.MARTIN@atelier-lumiere.example",
      jobTitle: "Comptable",
    });
    const created = await testRawPrisma.person.findUniqueOrThrow({
      where: { id },
    });
    expect(created).toMatchObject({
      firstName: "Alice",
      workEmail: "alice.martin@atelier-lumiere.example",
      organizationId: a.organizationId,
    });
    await admin.people.update(id, {
      firstName: "Alice",
      lastName: "Martin",
      workEmail: "alice@atelier-lumiere.example",
      jobTitle: "Directrice financière",
    });
    expect((await admin.people.getById(id))?.jobTitle).toBe(
      "Directrice financière",
    );
  });

  it("refuse des entrées invalides", async () => {
    const admin = repos(a, "admin");
    await expect(
      admin.people.create({
        firstName: "",
        lastName: "B",
        workEmail: "pas-un-email",
        jobTitle: "x",
      }),
    ).rejects.toThrow();
    await expect(
      admin.workstations.assign({ workstationId: "", personId: null }),
    ).rejects.toThrow();
  });
});

describe("isolation au niveau des dépôts", () => {
  it("l'annuaire de A ne contient aucune personne de B", async () => {
    const ids = (await repos(a, "admin").people.listDirectory()).map(
      (entry) => entry.id,
    );
    expect(ids).toContain(a.ids.Person);
    expect(ids).not.toContain(b.ids.Person);
    expect(await repos(a, "admin").people.getById(b.ids.Person)).toBeNull();
  });

  it("A ne peut ni modifier une personne de B, ni attribuer un poste de B", async () => {
    const admin = repos(a, "admin");
    await expect(
      admin.people.update(b.ids.Person, {
        firstName: "X",
        lastName: "Y",
        workEmail: "x.y@z.example",
        jobTitle: "piratage",
      }),
    ).rejects.toThrow();
    await expect(
      admin.workstations.assign({
        workstationId: b.ids.Workstation,
        personId: null,
      }),
    ).rejects.toThrow();
    const person = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: b.ids.Person },
    });
    expect(person.jobTitle).not.toBe("piratage");
  });

  it("A ne peut pas attribuer à un de ses postes une personne de B", async () => {
    await expect(
      repos(a, "admin").workstations.assign({
        workstationId: a.ids.Workstation,
        personId: b.ids.Person,
      }),
    ).rejects.toThrow();
  });

  it("les postes et zones listés appartiennent à A", async () => {
    const list = await repos(a, "manager").workstations.list();
    const ownIds = new Set(
      (
        await testRawPrisma.workstation.findMany({
          where: { organizationId: a.organizationId },
        })
      ).map((w) => w.id),
    );
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((w) => ownIds.has(w.id))).toBe(true);
  });

  it("la carte active de A n'est pas celle de B", async () => {
    const activeA = await repos(a, "admin").layouts.getActive();
    const activeB = await repos(b, "admin").layouts.getActive();
    expect(activeA?.layout.seed).toBe(2024);
    expect(activeB?.layout.seed).toBe(77);
  });
});

describe("journal d'audit", () => {
  it("enregistre les accès aux données de personnes, sans aucune donnée personnelle", async () => {
    const before = await testRawPrisma.auditLog.count({
      where: { organizationId: a.organizationId, action: "person.list" },
    });
    await repos(a, "employee").people.listDirectory();
    const rows = await testRawPrisma.auditLog.findMany({
      where: { organizationId: a.organizationId, action: "person.list" },
      orderBy: { createdAt: "desc" },
    });
    expect(rows.length).toBe(before + 1);
    expect(rows[0]).toMatchObject({
      actorId: a.accounts.employee.userId,
      resourceType: "Person",
    });
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "action",
        "actorId",
        "createdAt",
        "id",
        "organizationId",
        "resourceId",
        "resourceType",
      ].sort(),
    );
  });

  it("trace modifications de personnes, attributions de postes et aménagements", async () => {
    const actions = (
      await testRawPrisma.auditLog.findMany({
        where: { organizationId: a.organizationId },
      })
    ).map((row) => row.action);
    for (const action of [
      "person.create",
      "person.update",
      "person.read",
      "workstation.assign",
      "layout.save",
    ]) {
      expect(actions).toContain(action);
    }
  });
});
