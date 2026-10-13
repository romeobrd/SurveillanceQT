import { beforeAll, describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/map/catalog";
import {
  getRepositories,
  InvalidLayoutError,
  ReassignmentRequiredError,
} from "@/lib/db";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import type { Layout } from "@/lib/map/schema";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;

beforeAll(async () => {
  ({ a } = await prepareTwoOrganizations());
});

const manager = () => getRepositories(a.accounts.manager.context);

describe("versions de carte", () => {
  it("la carte initiale est la version 1, active", async () => {
    const versions = await manager().layouts.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, isActive: true });
  });

  it("une nouvelle version devient seule active, l'historique est conservé", async () => {
    const { layout } = (await manager().layouts.getActive())!;
    const saved = await manager().layouts.saveNewVersion(layout);
    expect(saved.version).toBe(2);
    const versions = await manager().layouts.listVersions();
    expect(versions.map((v) => [v.version, v.isActive])).toEqual([
      [2, true],
      [1, false],
    ]);
  });

  it("zones et postes gardent le même identifiant d'une version à l'autre", async () => {
    const zonesBefore = await testRawPrisma.zone.findMany({
      where: { organizationId: a.organizationId },
      orderBy: { key: "asc" },
    });
    const workstationsBefore = await testRawPrisma.workstation.findMany({
      where: { organizationId: a.organizationId },
      orderBy: { elementKey: "asc" },
    });
    const { layout } = (await manager().layouts.getActive())!;
    await manager().layouts.saveNewVersion({
      ...layout,
      zones: layout.zones.map((zone) => ({
        ...zone,
        name: `${zone.name} (renommée)`,
      })),
    });
    const zonesAfter = await testRawPrisma.zone.findMany({
      where: { organizationId: a.organizationId },
      orderBy: { key: "asc" },
    });
    const workstationsAfter = await testRawPrisma.workstation.findMany({
      where: { organizationId: a.organizationId },
      orderBy: { elementKey: "asc" },
    });
    expect(zonesAfter.map((z) => z.id)).toEqual(zonesBefore.map((z) => z.id));
    expect(zonesAfter.every((z) => z.name.endsWith("(renommée)"))).toBe(true);
    expect(workstationsAfter.map((w) => [w.id, w.personId])).toEqual(
      workstationsBefore.map((w) => [w.id, w.personId]),
    );
  });

  it("refuse une carte incohérente", async () => {
    const { layout } = (await manager().layouts.getActive())!;
    const broken: Layout = {
      ...layout,
      elements: [...layout.elements, { ...layout.elements[0], id: "doublon" }],
    };
    await expect(manager().layouts.saveNewVersion(broken)).rejects.toThrow(
      InvalidLayoutError,
    );
    await expect(
      manager().layouts.saveNewVersion({ version: 1 } as unknown as Layout),
    ).rejects.toThrow();
  });
});

describe("aucune perte silencieuse de données", () => {
  const isWorkstation = (key: string) => CATALOG[key]?.isWorkstation;

  it("refuse de retirer un poste attribué, et ne change rien", async () => {
    const { layout, version } = (await manager().layouts.getActive())!;
    const assigned = await testRawPrisma.workstation.findFirstOrThrow({
      where: { organizationId: a.organizationId, personId: { not: null } },
    });
    const without: Layout = {
      ...layout,
      elements: layout.elements.filter((e) => e.id !== assigned.elementKey),
    };
    await expect(manager().layouts.saveNewVersion(without)).rejects.toThrow(
      ReassignmentRequiredError,
    );
    expect((await manager().layouts.getActive())!.version).toBe(version);
    const still = await testRawPrisma.workstation.findUniqueOrThrow({
      where: { id: assigned.id },
    });
    expect(still.personId).toBe(assigned.personId);
  });

  it("refuse de supprimer une zone qui contient du stock ou du matériel", async () => {
    const { layout } = (await manager().layouts.getActive())!;
    const zone = await testRawPrisma.zone.findUniqueOrThrow({
      where: { id: a.ids.Zone },
    });
    const withoutZone: Layout = {
      ...layout,
      zones: layout.zones.filter((z) => z.id !== zone.key),
      elements: layout.elements.filter((e) => e.zoneId !== zone.key),
    };
    await expect(manager().layouts.saveNewVersion(withoutZone)).rejects.toThrow(
      ReassignmentRequiredError,
    );
    expect(
      await testRawPrisma.stockItem.count({ where: { id: a.ids.StockItem } }),
    ).toBe(1);
  });

  it("accepte de retirer un poste libre", async () => {
    const { layout } = (await manager().layouts.getActive())!;
    const free = await testRawPrisma.workstation.findFirst({
      where: { organizationId: a.organizationId, personId: null },
    });
    if (!free) return; // carte où tous les postes sont attribués : rien à retirer
    expect(
      isWorkstation(
        layout.elements.find((e) => e.id === free.elementKey)!.catalogKey,
      ),
    ).toBe(true);
    const without: Layout = {
      ...layout,
      elements: layout.elements.filter((e) => e.id !== free.elementKey),
    };
    await expect(
      manager().layouts.saveNewVersion(without),
    ).resolves.toBeDefined();
    expect(
      await testRawPrisma.workstation.count({ where: { id: free.id } }),
    ).toBe(0);
  });
});
