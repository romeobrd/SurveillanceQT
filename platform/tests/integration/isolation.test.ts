// Test d'isolation multi-tenant obligatoire (SPEC §3) : l'entreprise A ne lit ni ne modifie jamais les données de B.
import { beforeAll, describe, expect, it } from "vitest";
import { TENANT_MODELS, TenantViolationError } from "@/lib/db/scope";
import { createTenantDb, type TenantDb } from "@/lib/db/tenant";
import { testRawPrisma } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";
import type { FullFixture } from "@/lib/db/testing";

type Row = { id: string; organizationId?: string };
type Delegate = Record<string, (args?: unknown) => Promise<unknown>>;

// Une modification anodine par modèle (les valeurs n'ont pas besoin d'être réalistes : elles ne doivent jamais être écrites)
const TOUCH: Record<string, Record<string, unknown>> = {
  User: { passwordHash: "piratage" },
  Team: { name: "piratage" },
  Person: { jobTitle: "piratage" },
  Layout: { isActive: false },
  Zone: { name: "piratage" },
  Workstation: { elementKey: "piratage" },
  StockItem: { name: "piratage" },
  StockMovement: { reason: "piratage" },
  Asset: { brand: "piratage" },
  Project: { name: "piratage" },
  ProjectStep: { name: "piratage" },
  PresenceStatus: { status: "ABSENT" },
  AuditLog: { action: "piratage" },
  PrivacyRequest: { status: "DONE" },
};

const delegateName = (model: string) =>
  model.charAt(0).toLowerCase() + model.slice(1);
const rawDelegate = (model: string) =>
  (testRawPrisma as unknown as Record<string, Delegate>)[delegateName(model)];

let a: FullFixture;
let b: FullFixture;
let dbA: TenantDb;
const tenantDelegate = (model: string) =>
  (dbA as unknown as Record<string, Delegate>)[delegateName(model)];

beforeAll(async () => {
  ({ a, b } = await prepareTwoOrganizations());
  dbA = createTenantDb(a.organizationId);
});

describe("couverture", () => {
  it("chaque modèle métier est testé ci-dessous", () => {
    expect(Object.keys(TOUCH).sort()).toEqual([...TENANT_MODELS].sort());
  });

  it("le jeu de données contient une ligne dans chaque table, pour A et pour B", () => {
    expect(Object.keys(a.ids).sort()).toEqual(
      [...TENANT_MODELS, "Organization"].sort(),
    );
    expect(Object.keys(b.ids).sort()).toEqual(Object.keys(a.ids).sort());
  });

  it("l'accès ne donne pas de SQL brut", () => {
    expect("$queryRaw" in dbA).toBe(false);
    expect("$executeRaw" in dbA).toBe(false);
    expect("$queryRawUnsafe" in dbA).toBe(false);
  });
});

describe.each([...TENANT_MODELS])("isolation A/B : %s", (model) => {
  it("findMany ne retourne que les lignes de A", async () => {
    const rows = (await tenantDelegate(model).findMany()) as Row[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.organizationId === a.organizationId)).toBe(
      true,
    );
    expect(rows.map((row) => row.id)).toContain(a.ids[model]);
    expect(rows.map((row) => row.id)).not.toContain(b.ids[model]);
  });

  it("n'atteint pas une ligne de B par son identifiant (même avec un filtre organizationId explicite)", async () => {
    const delegate = tenantDelegate(model);
    expect(
      await delegate.findUnique({ where: { id: b.ids[model] } }),
    ).toBeNull();
    expect(
      await delegate.findFirst({ where: { id: b.ids[model] } }),
    ).toBeNull();
    expect(
      await delegate.findFirst({
        where: { id: b.ids[model], organizationId: b.organizationId },
      }),
    ).toBeNull();
    expect(
      await delegate.findMany({ where: { organizationId: b.organizationId } }),
    ).toEqual([]);
    expect(
      await delegate.count({ where: { organizationId: b.organizationId } }),
    ).toBe(0);
  });

  it("count correspond aux seules lignes de A", async () => {
    const expected = await rawDelegate(model).count({
      where: { organizationId: a.organizationId },
    });
    expect(await tenantDelegate(model).count()).toBe(expected);
  });

  it("ne modifie jamais une ligne de B", async () => {
    const before = await rawDelegate(model).findUnique({
      where: { id: b.ids[model] },
    });
    const delegate = tenantDelegate(model);
    await expect(
      delegate.update({ where: { id: b.ids[model] }, data: TOUCH[model] }),
    ).rejects.toThrow();
    expect(
      await delegate.updateMany({
        where: { id: b.ids[model] },
        data: TOUCH[model],
      }),
    ).toEqual({ count: 0 });
    expect(
      await rawDelegate(model).findUnique({ where: { id: b.ids[model] } }),
    ).toEqual(before);
  });

  it("ne supprime jamais une ligne de B", async () => {
    const delegate = tenantDelegate(model);
    await expect(
      delegate.delete({ where: { id: b.ids[model] } }),
    ).rejects.toThrow();
    expect(await delegate.deleteMany({ where: { id: b.ids[model] } })).toEqual({
      count: 0,
    });
    expect(
      await rawDelegate(model).findUnique({ where: { id: b.ids[model] } }),
    ).not.toBeNull();
  });

  it("refuse de créer ou déplacer une ligne vers B", async () => {
    const delegate = tenantDelegate(model);
    await expect(
      delegate.create({ data: { organizationId: b.organizationId } }),
    ).rejects.toThrow(TenantViolationError);
    await expect(
      delegate.createMany({ data: [{ organizationId: b.organizationId }] }),
    ).rejects.toThrow(TenantViolationError);
    await expect(
      delegate.update({
        where: { id: a.ids[model] },
        data: { organizationId: b.organizationId },
      }),
    ).rejects.toThrow(TenantViolationError);
    await expect(
      delegate.upsert({
        where: { id: b.ids[model] },
        create: { organizationId: b.organizationId },
        update: TOUCH[model],
      }),
    ).rejects.toThrow(TenantViolationError);
  });
});

describe("isolation A/B : Organization", () => {
  it("ne montre que sa propre entreprise", async () => {
    const rows = (await dbA.organization.findMany()) as Row[];
    expect(rows.map((row) => row.id)).toEqual([a.organizationId]);
    expect(
      await dbA.organization.findUnique({ where: { id: b.organizationId } }),
    ).toBeNull();
  });

  it("ne modifie, ne crée ni ne supprime une autre entreprise", async () => {
    await expect(
      dbA.organization.update({
        where: { id: b.organizationId },
        data: { name: "piratage" },
      }),
    ).rejects.toThrow();
    await expect(
      dbA.organization.create({ data: { name: "x", sector: "x" } }),
    ).rejects.toThrow(TenantViolationError);
    await expect(
      dbA.organization.delete({ where: { id: a.organizationId } }),
    ).rejects.toThrow(TenantViolationError);
    await expect(dbA.organization.deleteMany({})).rejects.toThrow(
      TenantViolationError,
    );
    const orgB = await testRawPrisma.organization.findUniqueOrThrow({
      where: { id: b.organizationId },
    });
    expect(orgB.name).toBe(b.name);
  });
});

describe("références entre entreprises refusées par la base elle-même", () => {
  it("un poste de A ne peut pas être attribué à une personne de B (clé étrangère composite)", async () => {
    await expect(
      testRawPrisma.workstation.update({
        where: { id: a.ids.Workstation },
        data: { personId: b.ids.Person },
      }),
    ).rejects.toThrow();
  });

  it("un article de stock de A ne peut pas être rangé dans une zone de B", async () => {
    await expect(
      testRawPrisma.stockItem.update({
        where: { id: a.ids.StockItem },
        data: { zoneId: b.ids.Zone },
      }),
    ).rejects.toThrow();
  });

  it("une seule carte active par entreprise", async () => {
    await expect(
      testRawPrisma.layout.create({
        data: {
          organizationId: a.organizationId,
          version: 99,
          data: {},
          isActive: true,
        },
      }),
    ).rejects.toThrow();
  });
});
