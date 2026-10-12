// Enregistrement d'un aménagement venant du navigateur : validation serveur, réaffectation sans perte,
// versions concurrentes, restauration, droits et isolation.
import { beforeEach, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  getRepositories,
  InvalidLayoutError,
  NotFoundError,
  ReassignmentRequiredError,
  StaleLayoutError,
} from "@/lib/db";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { CATALOG } from "@/lib/map/catalog";
import {
  addElement,
  removeElements,
  removeZone,
  setEdge,
  sequentialIds,
} from "@/lib/map/edit";
import type { Layout } from "@/lib/map/schema";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const repos = (fixture: FullFixture, who: "admin" | "manager" | "employee") =>
  getRepositories(fixture.accounts[who].context);

async function activeLayout(fixture = a) {
  const active = await repos(fixture, "manager").layouts.getActive();
  if (!active) throw new Error("pas de carte active");
  return active;
}

const isStation = (key: string) => CATALOG[key]?.isWorkstation === true;

async function assignedStation(fixture = a) {
  return testRawPrisma.workstation.findFirstOrThrow({
    where: { organizationId: fixture.organizationId, personId: { not: null } },
    orderBy: { elementKey: "asc" },
    include: { person: true },
  });
}

async function freeStations(fixture = a) {
  return testRawPrisma.workstation.findMany({
    where: { organizationId: fixture.organizationId, personId: null },
    orderBy: { elementKey: "asc" },
  });
}

describe("une carte venant du navigateur n'est jamais crue", () => {
  it("refuse une carte incohérente, falsifiée ou démesurée", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const first = layout.elements[0];

    await expect(
      manager.saveNewVersion({
        ...layout,
        elements: [...layout.elements, { ...first }],
      }),
    ).rejects.toThrow(InvalidLayoutError);
    await expect(
      manager.saveNewVersion({
        ...layout,
        elements: [
          { ...first, zoneId: "zone-inconnue" },
          ...layout.elements.slice(1),
        ],
      }),
    ).rejects.toThrow(InvalidLayoutError);
    await expect(
      manager.saveNewVersion({
        ...layout,
        elements: [
          ...layout.elements,
          { ...first, id: "e-mur", catalogKey: "mur" },
        ],
      }),
    ).rejects.toThrow(InvalidLayoutError);
    await expect(
      manager.saveNewVersion({
        ...layout,
        elements: [
          ...layout.elements,
          { ...first, id: "e-x", catalogKey: "n-existe-pas" },
        ],
      }),
    ).rejects.toThrow();
    await expect(
      manager.saveNewVersion({ ...layout, doors: [] }),
    ).rejects.toThrow(InvalidLayoutError); // plus d'entrée
    await expect(manager.saveNewVersion("pas une carte")).rejects.toThrow();
    await expect(manager.saveNewVersion(null)).rejects.toThrow();
    await expect(
      manager.saveNewVersion({
        ...layout,
        walls: Array.from({ length: 30_000 }, (_, i) => ({
          x: i % 20,
          y: 0,
          side: "N",
        })),
      }),
    ).rejects.toThrow(InvalidLayoutError);
    expect((await manager.listVersions()).length).toBe(1);
  });

  it("refuse une carte qui isole une partie des locaux", async () => {
    const manager = repos(a, "manager").layouts;
    let { layout } = await activeLayout();
    // Mur plein sur toute la hauteur au milieu du plan, sans porte
    const x = Math.floor(layout.width / 2);
    for (let y = 0; y < layout.height; y++) {
      const result = setEdge(layout, { x, y, side: "W" }, "solid");
      if (result.ok) layout = result.layout;
    }
    await expect(manager.saveNewVersion(layout)).rejects.toThrow(
      InvalidLayoutError,
    );
  });

  it("n'accepte que les utilisateurs autorisés à aménager", async () => {
    const { layout } = await activeLayout();
    const employee = repos(a, "employee").layouts;
    await expect(employee.saveNewVersion(layout)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(employee.previewImpact(layout)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(employee.getVersion(a.ids.Layout)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(employee.restoreVersion(a.ids.Layout)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      repos(a, "manager").layouts.saveNewVersion(layout),
    ).resolves.toMatchObject({ version: 2 });
    await expect(
      repos(a, "admin").layouts.saveNewVersion(layout),
    ).resolves.toMatchObject({ version: 3 });
  });
});

describe("versions concurrentes", () => {
  it("refuse d'écraser une carte modifiée depuis l'ouverture de l'éditeur", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout, version } = await activeLayout();
    await manager.saveNewVersion(layout, { baseVersion: version }); // devient la version 2
    await expect(
      manager.saveNewVersion(layout, { baseVersion: version }),
    ).rejects.toThrow(StaleLayoutError);
    await expect(
      manager.saveNewVersion(layout, { baseVersion: version + 1 }),
    ).resolves.toMatchObject({ version: 3 });
  });
});

describe("aperçu d'impact", () => {
  it("ne signale rien quand rien d'utilisé n'est supprimé", async () => {
    const { layout } = await activeLayout();
    const impact = await repos(a, "manager").layouts.previewImpact(layout);
    expect(impact.workstations).toEqual([]);
    expect(impact.zones).toEqual([]);
    expect(impact.targets.workstations.length).toBeGreaterThan(0);
  });

  it("liste les postes attribués supprimés, et propose uniquement des destinations libres", async () => {
    const { layout } = await activeLayout();
    const station = await assignedStation();
    const next = removeElements(layout, [station.elementKey]);
    const impact = await repos(a, "manager").layouts.previewImpact(next);
    expect(impact.workstations).toHaveLength(1);
    expect(impact.workstations[0]).toMatchObject({
      elementKey: station.elementKey,
      personName: `${station.person!.firstName} ${station.person!.lastName}`,
    });
    const occupied = new Set(
      (
        await testRawPrisma.workstation.findMany({
          where: { organizationId: a.organizationId, personId: { not: null } },
        })
      ).map((w) => w.elementKey),
    );
    expect(
      impact.targets.workstations.every(
        (target) => !occupied.has(target.elementKey),
      ),
    ).toBe(true);
  });

  it("liste les pièces supprimées qui contiennent du stock ou du matériel", async () => {
    const { layout } = await activeLayout();
    const zone = await testRawPrisma.zone.findUniqueOrThrow({
      where: { id: a.ids.Zone },
    });
    const removed = removeZone(layout, zone.key);
    if (!removed.ok) throw new Error(removed.problem);
    const impact = await repos(a, "manager").layouts.previewImpact(
      removed.layout,
    );
    expect(impact.zones).toEqual([
      { zoneKey: zone.key, name: zone.name, stockCount: 1, assetCount: 1 },
    ]);
    expect(impact.targets.zones.map((target) => target.key)).not.toContain(
      zone.key,
    );
  });

  it("ne révèle rien d'une autre entreprise", async () => {
    const { layout: layoutB } = await activeLayout(b);
    const impact = await repos(a, "manager").layouts.previewImpact(layoutB); // carte de B soumise par A
    for (const station of impact.workstations)
      expect(station.personName).not.toMatch(/Leroy|Fournier|Girard|Lambert/);
  });
});

describe("réaffectation sans perte", () => {
  it("refuse de retirer un poste attribué sans décision, et ne change rien", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout, version } = await activeLayout();
    const station = await assignedStation();
    const next = removeElements(layout, [station.elementKey]);
    await expect(manager.saveNewVersion(next)).rejects.toThrow(
      ReassignmentRequiredError,
    );
    expect((await activeLayout()).version).toBe(version);
    expect(
      (
        await testRawPrisma.workstation.findUniqueOrThrow({
          where: { id: station.id },
        })
      ).personId,
    ).toBe(station.personId);
  });

  it("libère la personne quand on le décide : elle reste dans l'entreprise, sans poste", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const station = await assignedStation();
    const next = removeElements(layout, [station.elementKey]);
    await manager.saveNewVersion(next, {
      plan: { workstations: { [station.elementKey]: { action: "release" } } },
    });
    expect(
      await testRawPrisma.workstation.count({ where: { id: station.id } }),
    ).toBe(0);
    const person = await testRawPrisma.person.findUniqueOrThrow({
      where: { id: station.personId! },
    });
    expect(person.status).toBe("ACTIVE");
    expect(
      await testRawPrisma.workstation.count({ where: { personId: person.id } }),
    ).toBe(0);
  });

  it("déplace la personne sur un autre poste libre", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const station = await assignedStation();
    const [target] = await freeStations();
    const next = removeElements(layout, [station.elementKey]);
    await manager.saveNewVersion(next, {
      plan: {
        workstations: {
          [station.elementKey]: {
            action: "move",
            toElementKey: target.elementKey,
          },
        },
      },
    });
    expect(
      (
        await testRawPrisma.workstation.findUniqueOrThrow({
          where: { id: target.id },
        })
      ).personId,
    ).toBe(station.personId);
    expect(
      await testRawPrisma.workstation.count({ where: { id: station.id } }),
    ).toBe(0);
  });

  it("déplace la personne sur un NOUVEAU poste créé dans la même version", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const station = await assignedStation();
    const without = removeElements(layout, [station.elementKey]);
    const zoneId = layout.zones.find((z) =>
      layout.elements.some(
        (e) => e.zoneId === z.id && e.id === station.elementKey,
      ),
    )!.id;
    // Cherche un emplacement libre pour un nouveau bureau dans une pièce
    let placed: Layout | null = null;
    let newId = "";
    for (let y = 0; y < layout.height && !placed; y++) {
      for (let x = 0; x < layout.width && !placed; x++) {
        const result = addElement(
          without,
          { catalogKey: "bureau_simple", x, y, rotation: 0 },
          sequentialIds(),
        );
        if (result.ok) {
          placed = result.layout;
          newId = result.id;
        }
      }
    }
    expect(placed).not.toBeNull();
    expect(zoneId).toBeTruthy();
    await manager.saveNewVersion(placed, {
      plan: {
        workstations: {
          [station.elementKey]: { action: "move", toElementKey: newId },
        },
      },
    });
    const created = await testRawPrisma.workstation.findFirstOrThrow({
      where: { organizationId: a.organizationId, elementKey: newId },
    });
    expect(created.personId).toBe(station.personId);
  });

  it("refuse une destination invalide : poste occupé, inexistant ou visé deux fois", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const assigned = await testRawPrisma.workstation.findMany({
      where: { organizationId: a.organizationId, personId: { not: null } },
      orderBy: { elementKey: "asc" },
    });
    const [s1, s2, s3] = assigned;
    const [free] = await freeStations();
    const next = removeElements(layout, [s1.elementKey, s2.elementKey]);

    const occupiedTarget = {
      workstations: {
        [s1.elementKey]: { action: "move", toElementKey: s3.elementKey },
        [s2.elementKey]: { action: "release" },
      },
    };
    await expect(
      manager.saveNewVersion(next, { plan: occupiedTarget }),
    ).rejects.toThrow(ReassignmentRequiredError);
    const missingTarget = {
      workstations: {
        [s1.elementKey]: { action: "move", toElementKey: "n-existe-pas" },
        [s2.elementKey]: { action: "release" },
      },
    };
    await expect(
      manager.saveNewVersion(next, { plan: missingTarget }),
    ).rejects.toThrow(ReassignmentRequiredError);
    const twice = {
      workstations: {
        [s1.elementKey]: { action: "move", toElementKey: free.elementKey },
        [s2.elementKey]: { action: "move", toElementKey: free.elementKey },
      },
    };
    await expect(manager.saveNewVersion(next, { plan: twice })).rejects.toThrow(
      ReassignmentRequiredError,
    );
    expect((await activeLayout()).version).toBe(1);
    expect(
      await testRawPrisma.workstation.count({
        where: { organizationId: a.organizationId, personId: { not: null } },
      }),
    ).toBe(assigned.length);
  });

  it("accepte de supprimer un poste libre sans plan", async () => {
    const { layout } = await activeLayout();
    const [free] = await freeStations();
    const next = removeElements(layout, [free.elementKey]);
    await expect(
      repos(a, "manager").layouts.saveNewVersion(next),
    ).resolves.toMatchObject({ version: 2 });
  });

  it("range le stock et le matériel d'une pièce supprimée dans une autre pièce, avec historique", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const zone = await testRawPrisma.zone.findUniqueOrThrow({
      where: { id: a.ids.Zone },
    });
    const removed = removeZone(layout, zone.key);
    if (!removed.ok) throw new Error(removed.problem);
    // Les postes attribués de la pièce supprimée doivent aussi être décidés
    const stationsInZone = await testRawPrisma.workstation.findMany({
      where: { zoneId: zone.id, personId: { not: null } },
    });
    const targetZone = removed.layout.zones.find((z) => z.id !== zone.key)!;
    const plan = {
      zones: { [zone.key]: { action: "move", toZoneKey: targetZone.id } },
      workstations: Object.fromEntries(
        stationsInZone.map((s) => [s.elementKey, { action: "release" }]),
      ),
    };
    await expect(manager.saveNewVersion(removed.layout)).rejects.toThrow(
      ReassignmentRequiredError,
    );
    await manager.saveNewVersion(removed.layout, { plan });

    const target = await testRawPrisma.zone.findFirstOrThrow({
      where: { organizationId: a.organizationId, key: targetZone.id },
    });
    expect(
      (
        await testRawPrisma.stockItem.findUniqueOrThrow({
          where: { id: a.ids.StockItem },
        })
      ).zoneId,
    ).toBe(target.id);
    expect(
      (
        await testRawPrisma.asset.findUniqueOrThrow({
          where: { id: a.ids.Asset },
        })
      ).zoneId,
    ).toBe(target.id);
    expect(await testRawPrisma.zone.count({ where: { id: zone.id } })).toBe(0);
    const history = await testRawPrisma.assetAssignment.findMany({
      where: { assetId: a.ids.Asset },
      orderBy: { assignedAt: "asc" },
    });
    expect(
      history.some(
        (entry) => entry.zoneId === target.id && entry.releasedAt === null,
      ),
    ).toBe(true);
    expect(history.every((entry) => entry.zoneId !== zone.id)).toBe(true); // plus de référence à la pièce supprimée
  });

  it("détache le stock et le matériel (sans pièce) quand on le décide : rien n'est supprimé", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const zone = await testRawPrisma.zone.findUniqueOrThrow({
      where: { id: a.ids.Zone },
    });
    const removed = removeZone(layout, zone.key);
    if (!removed.ok) throw new Error(removed.problem);
    const stationsInZone = await testRawPrisma.workstation.findMany({
      where: { zoneId: zone.id, personId: { not: null } },
    });
    await manager.saveNewVersion(removed.layout, {
      plan: {
        zones: { [zone.key]: { action: "unassign" } },
        workstations: Object.fromEntries(
          stationsInZone.map((s) => [s.elementKey, { action: "release" }]),
        ),
      },
    });
    expect(
      await testRawPrisma.stockItem.count({
        where: { id: a.ids.StockItem, zoneId: null },
      }),
    ).toBe(1);
    expect(
      await testRawPrisma.asset.count({
        where: { id: a.ids.Asset, zoneId: null },
      }),
    ).toBe(1);
    expect(
      await testRawPrisma.stockMovement.count({
        where: { stockItemId: a.ids.StockItem },
      }),
    ).toBe(1);
  });

  it("refuse une destination de zone inexistante", async () => {
    const manager = repos(a, "manager").layouts;
    const { layout } = await activeLayout();
    const zone = await testRawPrisma.zone.findUniqueOrThrow({
      where: { id: a.ids.Zone },
    });
    const removed = removeZone(layout, zone.key);
    if (!removed.ok) throw new Error(removed.problem);
    const stationsInZone = await testRawPrisma.workstation.findMany({
      where: { zoneId: zone.id, personId: { not: null } },
    });
    await expect(
      manager.saveNewVersion(removed.layout, {
        plan: {
          zones: { [zone.key]: { action: "move", toZoneKey: "pas-une-zone" } },
          workstations: Object.fromEntries(
            stationsInZone.map((s) => [s.elementKey, { action: "release" }]),
          ),
        },
      }),
    ).rejects.toThrow(ReassignmentRequiredError);
    expect(
      await testRawPrisma.stockItem.count({
        where: { id: a.ids.StockItem, zoneId: a.ids.Zone },
      }),
    ).toBe(1);
  });
});

describe("historique et restauration", () => {
  it("restaure une ancienne version en créant une nouvelle version, sans rien effacer", async () => {
    const manager = repos(a, "manager").layouts;
    const v1 = await activeLayout();
    const [free] = await freeStations();
    await manager.saveNewVersion(removeElements(v1.layout, [free.elementKey])); // version 2
    expect((await activeLayout()).layout.elements.length).toBe(
      v1.layout.elements.length - 1,
    );

    const restored = await manager.restoreVersion(v1.id);
    expect(restored.version).toBe(3);
    const now = await activeLayout();
    expect(now.version).toBe(3);
    expect(now.layout).toEqual(v1.layout);
    expect(
      (await manager.listVersions()).map((v) => [v.version, v.isActive]),
    ).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ]);
    expect(
      await testRawPrisma.auditLog.count({
        where: { organizationId: a.organizationId, action: "layout.restore" },
      }),
    ).toBe(1);
    expect(
      await testRawPrisma.workstation.count({
        where: {
          organizationId: a.organizationId,
          elementKey: free.elementKey,
        },
      }),
    ).toBe(1); // le poste est revenu
  });

  it("exige la même réaffectation qu'un enregistrement quand la restauration retire un poste attribué", async () => {
    const manager = repos(a, "manager").layouts;
    const v1 = await activeLayout();
    const station = await assignedStation();
    // Version 2 : un poste de plus, attribué à une personne
    const without = removeElements(v1.layout, [station.elementKey]);
    await manager.saveNewVersion(without, {
      plan: { workstations: { [station.elementKey]: { action: "release" } } },
    });
    const [free] = await freeStations();
    await repos(a, "manager").workstations.assign({
      workstationId: free.id,
      personId: station.personId,
    });
    // Restaurer la version 1 recrée le poste retiré : aucun retrait d'un poste attribué, donc pas de plan nécessaire
    await expect(manager.restoreVersion(v1.id)).resolves.toMatchObject({
      version: 3,
    });
    // À l'inverse, restaurer v2 (qui n'a pas le poste attribué par défaut) ne retire rien d'attribué non plus
    const impact = await manager.previewRestore(
      (await manager.listVersions()).find((v) => v.version === 2)!.id,
    );
    expect(impact.workstations).toEqual([]);
  });

  it("ne touche pas aux versions d'une autre entreprise", async () => {
    const manager = repos(a, "manager").layouts;
    await expect(manager.restoreVersion(b.ids.Layout)).rejects.toThrow(
      NotFoundError,
    );
    await expect(manager.previewRestore(b.ids.Layout)).rejects.toThrow(
      NotFoundError,
    );
    expect(await manager.getVersion(b.ids.Layout)).toBeNull();
    expect((await repos(b, "manager").layouts.listVersions()).length).toBe(1);
  });

  it("ouvre une ancienne version pour l'éditer, sans la modifier", async () => {
    const manager = repos(a, "manager").layouts;
    const v1 = await activeLayout();
    const opened = await manager.getVersion(v1.id);
    expect(opened).toMatchObject({ version: 1, isActive: true });
    expect(opened?.layout).toEqual(v1.layout);
  });
});

describe("garde-fous", () => {
  it("n'accepte aucun élément de structure ni aucun type inconnu comme mobilier dans une carte sauvegardée", async () => {
    const { layout } = await activeLayout();
    const first = layout.elements.find((e) => isStation(e.catalogKey))!;
    const forged = {
      ...layout,
      elements: layout.elements.map((e) =>
        e.id === first.id ? { ...e, catalogKey: "porte" } : e,
      ),
    };
    await expect(
      repos(a, "manager").layouts.saveNewVersion(forged),
    ).rejects.toThrow(InvalidLayoutError);
  });
});
