// Modules de gestion (phase 4) : CRUD, droits, règles métier et isolation, via les dépôts de données.
import { beforeAll, describe, expect, it } from "vitest";
import {
  DuplicateError,
  ForbiddenError,
  getRepositories,
  InsufficientStockError,
  InUseError,
  InvalidOperationError,
  NotFoundError,
} from "@/lib/db";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeAll(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const repos = (fixture: FullFixture, who: "admin" | "manager" | "employee") =>
  getRepositories(fixture.accounts[who].context);

const newPerson = (suffix: string) => ({
  firstName: "Test",
  lastName: `Personne${suffix}`,
  workEmail: `test.${suffix}@atelier-lumiere.example`,
  jobTitle: "Testeur",
});

describe("collaborateurs : recherche, filtres, tri", () => {
  it("recherche par nom, intitulé de poste et e-mail (managers), insensible à la casse", async () => {
    const manager = repos(a, "manager").people;
    const bySurname = await manager.list({ search: "BERNARD" });
    expect(bySurname.map((p) => p.lastName)).toEqual(["Bernard"]);
    expect((await manager.list({ search: "développeuse" })).length).toBe(2);
    expect((await manager.list({ search: "sophie.bernard@" })).length).toBe(1);
    expect(
      (await repos(a, "employee").people.list({ search: "sophie.bernard@" }))
        .length,
    ).toBe(0);
  });

  it("filtre par équipe et trie", async () => {
    const manager = repos(a, "manager");
    const teams = await manager.teams.list();
    const technique = teams.find((team) => team.name === "Technique")!;
    const filtered = await manager.people.list({ teamId: technique.id });
    expect(filtered.length).toBe(8);
    expect(filtered.every((person) => person.teamName === "Technique")).toBe(
      true,
    );
    const desc = await manager.people.list({ sort: "lastName", dir: "desc" });
    const names = desc.map((person) => person.lastName);
    expect(names).toEqual([...names].sort((x, y) => y.localeCompare(x, "en")));
  });

  it("cache les collaborateurs partis aux employés", async () => {
    const admin = repos(a, "admin");
    const { id } = await admin.people.create(newPerson("parti"));
    await admin.people.markDeparted(id);
    expect(
      (await repos(a, "manager").people.list({ status: "DEPARTED" })).map(
        (p) => p.id,
      ),
    ).toContain(id);
    expect(
      (await repos(a, "employee").people.list({ status: "ALL" })).map(
        (p) => p.id,
      ),
    ).not.toContain(id);
    expect(
      (await repos(a, "manager").people.list({})).map((p) => p.id),
    ).not.toContain(id);
  });
});

describe("départ d'un collaborateur", () => {
  it("libère son poste et son matériel en conservant l'historique", async () => {
    const admin = repos(a, "admin");
    const manager = repos(a, "manager");
    const { id: personId } = await admin.people.create(newPerson("depart"));
    const stations = await manager.workstations.list({ status: "free" });
    expect(stations.length).toBeGreaterThan(0);
    await manager.workstations.assign({
      workstationId: stations[0].id,
      personId,
    });
    const { id: assetId } = await manager.assets.create({
      type: "Portable",
      brand: "Marque",
      model: "X1",
      serialNumber: "SN-DEPART-1",
      state: "IN_SERVICE",
      purchaseDate: null,
      personId,
      zoneId: null,
    });

    await admin.people.markDeparted(personId);

    expect(
      (
        await testRawPrisma.workstation.findUniqueOrThrow({
          where: { id: stations[0].id },
        })
      ).personId,
    ).toBeNull();
    expect(
      (await testRawPrisma.asset.findUniqueOrThrow({ where: { id: assetId } }))
        .personId,
    ).toBeNull();
    const history = await testRawPrisma.assetAssignment.findMany({
      where: { assetId },
    });
    expect(history).toHaveLength(1);
    expect(history[0].releasedAt).not.toBeNull();
    expect(history[0].personId).toBe(personId);
    await expect(admin.people.markDeparted(personId)).rejects.toThrow(
      InvalidOperationError,
    );
  });

  it("refuse d'attribuer un poste ou du matériel à un collaborateur parti", async () => {
    const admin = repos(a, "admin");
    const { id } = await admin.people.create(newPerson("parti2"));
    await admin.people.markDeparted(id);
    const [station] = await repos(a, "manager").workstations.list({
      status: "free",
    });
    await expect(
      repos(a, "manager").workstations.assign({
        workstationId: station.id,
        personId: id,
      }),
    ).rejects.toThrow(InvalidOperationError);
  });

  it("est réservé aux administrateurs", async () => {
    await expect(
      repos(a, "manager").people.markDeparted(a.ids.Person),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("équipes", () => {
  it("renomme, refuse les doublons et refuse de supprimer une équipe utilisée", async () => {
    const admin = repos(a, "admin").teams;
    const { id } = await admin.create("Logistique");
    await expect(admin.create("Logistique")).rejects.toThrow(DuplicateError);
    await admin.rename(id, "Logistique & achats");
    await admin.delete(id);
    const technique = (await admin.list()).find(
      (team) => team.name === "Technique",
    )!;
    await expect(admin.delete(technique.id)).rejects.toThrow(InUseError);
  });
});

describe("postes de travail", () => {
  it("liste libres et occupés avec zone et occupant, filtrable", async () => {
    const manager = repos(a, "manager").workstations;
    const all = await manager.list();
    const free = await manager.list({ status: "free" });
    const occupied = await manager.list({ status: "occupied" });
    expect(free.length + occupied.length).toBe(all.length);
    expect(occupied.every((w) => w.personName)).toBe(true);
    expect(free.every((w) => w.personName === null)).toBe(true);
    const zone = all[0];
    expect(
      (await manager.list({ zoneId: zone.zoneId })).every(
        (w) => w.zoneId === zone.zoneId,
      ),
    ).toBe(true);
  });
});

describe("stock", () => {
  it("calcule la quantité à partir des mouvements et signale les alertes", async () => {
    const manager = repos(a, "manager").stock;
    const { id } = await manager.createItem({
      name: "Clés USB",
      reference: "USB-1",
      unit: "unités",
      threshold: 10,
      zoneId: null,
    });
    expect((await manager.getItem(id))?.item).toMatchObject({
      quantity: 0,
      isLow: true,
    });
    await manager.addMovement({
      stockItemId: id,
      type: "IN",
      quantity: 25,
      reason: "Réception",
    });
    await manager.addMovement({
      stockItemId: id,
      type: "OUT",
      quantity: 10,
      reason: "Distribution",
    });
    expect((await manager.getItem(id))?.item).toMatchObject({
      quantity: 15,
      isLow: false,
    });
    await manager.addMovement({
      stockItemId: id,
      type: "ADJUSTMENT",
      quantity: -6,
      reason: "Inventaire",
    });
    const detail = await manager.getItem(id);
    expect(detail?.item).toMatchObject({ quantity: 9, isLow: true });
    expect(detail?.movements).toHaveLength(3);
    expect(
      (await manager.listItems({ alert: "low" })).map((i) => i.id),
    ).toContain(id);
  });

  it("refuse un stock négatif et un mouvement invalide, sans rien enregistrer", async () => {
    const manager = repos(a, "manager").stock;
    const { id } = await manager.createItem({
      name: "Piles",
      reference: "PILE-1",
      unit: "unités",
      threshold: 0,
      zoneId: null,
    });
    await manager.addMovement({
      stockItemId: id,
      type: "IN",
      quantity: 3,
      reason: "Réception",
    });
    await expect(
      manager.addMovement({
        stockItemId: id,
        type: "OUT",
        quantity: 4,
        reason: "Trop",
      }),
    ).rejects.toThrow(InsufficientStockError);
    await expect(
      manager.addMovement({
        stockItemId: id,
        type: "IN",
        quantity: -2,
        reason: "x",
      }),
    ).rejects.toThrow();
    await expect(
      manager.addMovement({
        stockItemId: id,
        type: "ADJUSTMENT",
        quantity: 0,
        reason: "x",
      }),
    ).rejects.toThrow();
    await expect(
      manager.addMovement({
        stockItemId: id,
        type: "IN",
        quantity: 1,
        reason: "",
      }),
    ).rejects.toThrow();
    expect((await manager.getItem(id))?.item.quantity).toBe(3);
  });

  it("ne perd aucune sortie lors de mouvements concurrents", async () => {
    const manager = repos(a, "manager").stock;
    const { id } = await manager.createItem({
      name: "Rames",
      reference: "RAME-1",
      unit: "unités",
      threshold: 0,
      zoneId: null,
    });
    await manager.addMovement({
      stockItemId: id,
      type: "IN",
      quantity: 5,
      reason: "Réception",
    });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        manager.addMovement({
          stockItemId: id,
          type: "OUT",
          quantity: 1,
          reason: "Sortie",
        }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBeLessThanOrEqual(5);
    expect((await manager.getItem(id))?.item.quantity).toBe(5 - ok);
    expect((await manager.getItem(id))!.item.quantity).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("refuse une référence en double, supprime l'article avec son historique", async () => {
    const manager = repos(a, "manager").stock;
    await manager.createItem({
      name: "A",
      reference: "DUP-1",
      unit: "u",
      threshold: 0,
      zoneId: null,
    });
    await expect(
      manager.createItem({
        name: "B",
        reference: "DUP-1",
        unit: "u",
        threshold: 0,
        zoneId: null,
      }),
    ).rejects.toThrow(DuplicateError);
    const { id } = await manager.createItem({
      name: "C",
      reference: "DEL-1",
      unit: "u",
      threshold: 0,
      zoneId: null,
    });
    await manager.addMovement({
      stockItemId: id,
      type: "IN",
      quantity: 2,
      reason: "Réception",
    });
    await manager.deleteItem(id);
    expect(await manager.getItem(id)).toBeNull();
    expect(
      await testRawPrisma.stockMovement.count({ where: { stockItemId: id } }),
    ).toBe(0);
  });

  it("recherche, filtre par zone et trie par quantité", async () => {
    const manager = repos(a, "manager").stock;
    expect(
      (await manager.listItems({ search: "ramettes" })).map((i) => i.id),
    ).toContain(a.ids.StockItem);
    expect(
      (await manager.listItems({ zoneId: a.ids.Zone })).every(
        (i) => i.zoneId === a.ids.Zone,
      ),
    ).toBe(true);
    const asc = (await manager.listItems({ sort: "quantity", dir: "asc" })).map(
      (i) => i.quantity,
    );
    expect(asc).toEqual([...asc].sort((x, y) => x - y));
  });

  it("est en lecture seule pour l'employé", async () => {
    const employee = repos(a, "employee").stock;
    expect((await employee.listItems({})).length).toBeGreaterThan(0);
    await expect(
      employee.addMovement({
        stockItemId: a.ids.StockItem,
        type: "IN",
        quantity: 1,
        reason: "x",
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(employee.deleteItem(a.ids.StockItem)).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("matériel", () => {
  const input = (
    serialNumber: string,
    extra: Record<string, unknown> = {},
  ) => ({
    type: "Écran",
    brand: "Marque",
    model: "M2",
    serialNumber,
    state: "IN_SERVICE" as const,
    purchaseDate: null,
    personId: null,
    zoneId: null,
    ...extra,
  });

  it("trace l'historique d'affectation à chaque changement de personne ou de zone", async () => {
    const manager = repos(a, "manager").assets;
    const { id } = await manager.create(
      input("SN-HIST-1", { personId: a.accounts.employee.personId }),
    );
    await manager.update(
      id,
      input("SN-HIST-1", {
        personId: a.accounts.manager.personId,
        zoneId: a.ids.Zone,
      }),
    );
    await manager.update(
      id,
      input("SN-HIST-1", {
        personId: a.accounts.manager.personId,
        zoneId: a.ids.Zone,
        state: "BROKEN",
      }),
    );
    await manager.update(id, input("SN-HIST-1"));
    const detail = (await manager.getDetail(id))!;
    expect(detail.asset.state).toBe("IN_SERVICE");
    expect(detail.history).toHaveLength(2); // le seul changement d'état n'ouvre pas d'affectation
    expect(detail.history.filter((h) => h.releasedAt === null)).toHaveLength(0);
    expect(
      detail.history.map((h) => h.personName).filter(Boolean),
    ).toHaveLength(2);
  });

  it("refuse un numéro de série en double et gère l'état", async () => {
    const manager = repos(a, "manager").assets;
    await manager.create(input("SN-UNIQUE-1"));
    await expect(manager.create(input("SN-UNIQUE-1"))).rejects.toThrow(
      DuplicateError,
    );
    const { id } = await manager.create(input("SN-STATE-1"));
    await manager.setState(id, "TO_RENEW");
    expect((await manager.getDetail(id))?.asset.state).toBe("TO_RENEW");
    expect(
      (await manager.list({ state: "TO_RENEW" })).map((asset) => asset.id),
    ).toContain(id);
  });

  it("un employé ne voit que son propre matériel et ne peut rien modifier", async () => {
    const employee = repos(a, "employee").assets;
    const mine = await employee.list({});
    expect(mine.length).toBeGreaterThan(0);
    expect(
      mine.every((asset) => asset.personId === a.accounts.employee.personId),
    ).toBe(true);
    const others = await repos(a, "manager").assets.list({});
    expect(others.length).toBeGreaterThan(mine.length);
    const notMine = others.find(
      (asset) => asset.personId !== a.accounts.employee.personId,
    )!;
    expect(await employee.getDetail(notMine.id)).toBeNull();
    await expect(employee.setState(mine[0].id, "BROKEN")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("supprime le matériel avec son historique", async () => {
    const manager = repos(a, "manager").assets;
    const { id } = await manager.create(
      input("SN-DEL-1", { zoneId: a.ids.Zone }),
    );
    await manager.delete(id);
    expect(await manager.getDetail(id)).toBeNull();
    expect(
      await testRawPrisma.assetAssignment.count({ where: { assetId: id } }),
    ).toBe(0);
    await expect(manager.delete(id)).rejects.toThrow(NotFoundError);
  });
});

describe("projets", () => {
  it("calcule la progression, ordonne et déplace les étapes", async () => {
    const manager = repos(a, "manager").projects;
    const { id } = await manager.create({
      name: "Déménagement",
      teamId: null,
      description: "",
    });
    const s1 = await manager.addStep(id, "Cartons");
    const s2 = await manager.addStep(id, "Transport");
    const s3 = await manager.addStep(id, "Installation");
    expect((await manager.get(id))?.project).toMatchObject({
      progress: 0,
      state: "NOT_STARTED",
      stepCount: 3,
    });

    await manager.setStepStatus(s1.id, "DONE");
    expect((await manager.get(id))?.project).toMatchObject({
      progress: 33,
      state: "IN_PROGRESS",
    });
    await manager.setStepStatus(s2.id, "DONE");
    await manager.setStepStatus(s3.id, "DONE");
    expect((await manager.get(id))?.project).toMatchObject({
      progress: 100,
      state: "DONE",
    });

    await manager.moveStep(s3.id, "up");
    expect((await manager.get(id))!.steps.map((s) => s.name)).toEqual([
      "Cartons",
      "Installation",
      "Transport",
    ]);
    await manager.moveStep(s3.id, "up");
    await manager.moveStep(s3.id, "up");
    expect((await manager.get(id))!.steps.map((s) => s.name)).toEqual([
      "Installation",
      "Cartons",
      "Transport",
    ]);
    await manager.moveStep(s2.id, "down");
    expect((await manager.get(id))!.steps.map((s) => s.name)).toEqual([
      "Installation",
      "Cartons",
      "Transport",
    ]);

    await manager.deleteStep(s1.id);
    await manager.addStep(id, "Rangement");
    expect((await manager.get(id))!.steps.map((s) => s.name)).toEqual([
      "Installation",
      "Transport",
      "Rangement",
    ]);
  });

  it("filtre par équipe et par état, supprime avec les étapes", async () => {
    const manager = repos(a, "manager").projects;
    const teams = await repos(a, "manager").teams.list();
    const team = teams.find((t) => t.name === "Technique")!;
    const { id } = await manager.create({
      name: "Migration réseau",
      teamId: team.id,
      description: "Câblage",
    });
    expect(
      (await manager.list({ teamId: team.id })).map((p) => p.id),
    ).toContain(id);
    expect(
      (await manager.list({ state: "DONE" })).map((p) => p.id),
    ).not.toContain(id);
    expect(
      (await manager.list({ search: "réseau" })).map((p) => p.id),
    ).toContain(id);
    await manager.addStep(id, "Audit");
    await manager.delete(id);
    expect(await manager.get(id)).toBeNull();
    expect(
      await testRawPrisma.projectStep.count({ where: { projectId: id } }),
    ).toBe(0);
  });

  it("est en lecture seule pour l'employé", async () => {
    const employee = repos(a, "employee").projects;
    expect((await employee.list({})).length).toBeGreaterThan(0);
    await expect(
      employee.create({ name: "x", teamId: null, description: "" }),
    ).rejects.toThrow(ForbiddenError);
    await expect(employee.addStep(a.ids.Project, "x")).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("tableau de bord et données de la carte", () => {
  it("agrège collaborateurs, postes, alertes, matériel et projets de l'entreprise seulement", async () => {
    const dash = await repos(a, "manager").dashboard.get();
    const people = await testRawPrisma.person.count({
      where: { organizationId: a.organizationId, status: "ACTIVE" },
    });
    expect(dash.activePeople).toBe(people);
    expect(dash.workstations.total).toBe(
      dash.workstations.occupied + dash.workstations.free,
    );
    expect(dash.workstations.total).toBe(
      await testRawPrisma.workstation.count({
        where: { organizationId: a.organizationId },
      }),
    );
    expect(dash.lowStock.every((item) => item.isLow)).toBe(true);
    expect(dash.assets.broken).toBe(
      await testRawPrisma.asset.count({
        where: { organizationId: a.organizationId, state: "BROKEN" },
      }),
    );
    const projectIds = dash.projects.map((p) => p.id);
    expect(projectIds).toContain(a.ids.Project);
    expect(projectIds).not.toContain(b.ids.Project);
  });

  it("fournit à la carte les occupants, le stock, le matériel et les projets par zone", async () => {
    const map = (await repos(a, "employee").map.getActive())!;
    expect(map.layout.seed).toBe(2024);
    const zoneKeys = new Set(map.layout.zones.map((zone) => zone.id));
    expect(map.data.workstations.length).toBeGreaterThan(0);
    expect(map.data.workstations.every((w) => zoneKeys.has(w.zoneId))).toBe(
      true,
    );
    expect(map.data.workstations.some((w) => w.personId)).toBe(true);
    expect(map.data.stock.every((s) => zoneKeys.has(s.zoneId))).toBe(true);
    expect(map.data.stock.find((s) => s.id === a.ids.StockItem)?.quantity).toBe(
      10,
    );
    expect(map.data.assets.every((asset) => zoneKeys.has(asset.zoneId))).toBe(
      true,
    );
    const ids = new Set(map.data.people.map((p) => p.id));
    expect(ids.has(b.ids.Person)).toBe(false);
  });

  it("la carte de B ne contient rien de A", async () => {
    const map = (await repos(b, "admin").map.getActive())!;
    expect(map.layout.seed).toBe(77);
    expect(map.data.stock.map((s) => s.id)).not.toContain(a.ids.StockItem);
    expect(map.data.projects.map((p) => p.id)).not.toContain(a.ids.Project);
  });
});

describe("isolation A/B des nouveaux modules", () => {
  it("A ne peut ni lire, ni modifier, ni supprimer les données de B", async () => {
    const manager = repos(a, "manager");
    const admin = repos(a, "admin");
    expect(await manager.stock.getItem(b.ids.StockItem)).toBeNull();
    expect(await manager.assets.getDetail(b.ids.Asset)).toBeNull();
    expect(await manager.projects.get(b.ids.Project)).toBeNull();
    expect((await manager.stock.listItems({})).map((i) => i.id)).not.toContain(
      b.ids.StockItem,
    );
    expect((await manager.assets.list({})).map((i) => i.id)).not.toContain(
      b.ids.Asset,
    );
    expect(
      (await manager.workstations.list({})).map((w) => w.id),
    ).not.toContain(b.ids.Workstation);

    await expect(
      manager.stock.addMovement({
        stockItemId: b.ids.StockItem,
        type: "IN",
        quantity: 1,
        reason: "piratage",
      }),
    ).rejects.toThrow(NotFoundError);
    await expect(manager.stock.deleteItem(b.ids.StockItem)).rejects.toThrow();
    await expect(
      manager.assets.setState(b.ids.Asset, "BROKEN"),
    ).rejects.toThrow();
    await expect(manager.assets.delete(b.ids.Asset)).rejects.toThrow();
    await expect(
      manager.projects.addStep(b.ids.Project, "piratage"),
    ).rejects.toThrow(NotFoundError);
    await expect(manager.projects.delete(b.ids.Project)).rejects.toThrow();
    await expect(
      manager.projects.setStepStatus(b.ids.ProjectStep, "DONE"),
    ).rejects.toThrow();
    await expect(
      manager.projects.moveStep(b.ids.ProjectStep, "up"),
    ).rejects.toThrow();
    await expect(admin.people.markDeparted(b.ids.Person)).rejects.toThrow(
      NotFoundError,
    );
    await expect(admin.teams.delete(b.ids.Team)).rejects.toThrow(NotFoundError);
    await expect(admin.teams.rename(b.ids.Team, "piratage")).rejects.toThrow();

    expect(
      await testRawPrisma.stockItem.count({ where: { id: b.ids.StockItem } }),
    ).toBe(1);
    expect(
      await testRawPrisma.asset.count({
        where: { id: b.ids.Asset, state: "IN_SERVICE" },
      }),
    ).toBe(1);
    expect(
      await testRawPrisma.project.count({ where: { id: b.ids.Project } }),
    ).toBe(1);
    expect(
      (
        await testRawPrisma.person.findUniqueOrThrow({
          where: { id: b.ids.Person },
        })
      ).status,
    ).toBe("ACTIVE");
  });

  it("A ne peut pas rattacher ses données à des éléments de B", async () => {
    const manager = repos(a, "manager");
    const base = {
      type: "x",
      brand: "x",
      model: "x",
      state: "IN_SERVICE" as const,
      purchaseDate: null,
    };
    await expect(
      manager.assets.create({
        ...base,
        serialNumber: "SN-X-1",
        personId: b.ids.Person,
        zoneId: null,
      }),
    ).rejects.toThrow();
    await expect(
      manager.assets.create({
        ...base,
        serialNumber: "SN-X-2",
        personId: null,
        zoneId: b.ids.Zone,
      }),
    ).rejects.toThrow();
    await expect(
      manager.stock.createItem({
        name: "x",
        reference: "REF-X-1",
        unit: "u",
        threshold: 0,
        zoneId: b.ids.Zone,
      }),
    ).rejects.toThrow();
    await expect(
      manager.projects.create({
        name: "x",
        teamId: b.ids.Team,
        description: "",
      }),
    ).rejects.toThrow();
    await expect(
      repos(a, "admin").people.create({
        ...newPerson("fk"),
        teamId: b.ids.Team,
      }),
    ).rejects.toThrow();
    expect(
      await testRawPrisma.asset.count({
        where: {
          organizationId: a.organizationId,
          serialNumber: { startsWith: "SN-X-" },
        },
      }),
    ).toBe(0);
  });
});
