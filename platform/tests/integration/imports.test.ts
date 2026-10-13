// Import CSV côté serveur : doublons avec l'existant, limite de l'offre, équipes, journal, droits, isolation.
import { beforeEach, describe, expect, it } from "vitest";
import { getRepositories } from "@/lib/db";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
});

const imports = (who: "admin" | "employee" = "admin", fixture = a) =>
  getRepositories(fixture.accounts[who].context).imports;

describe("import de collaborateurs", () => {
  it("importe les lignes valides, crée les équipes manquantes et journalise", async () => {
    const existing = await testRawPrisma.person.findFirstOrThrow({
      where: { organizationId: a.organizationId },
    });
    const csv = [
      "Prénom;Nom;E-mail;Poste;Équipe",
      "Léa;Import;lea.import@exemple.fr;Comptable;Équipe importée",
      `Déjà;Là;${existing.workEmail.toUpperCase()};Poste;`,
      "Sans;Email;;Poste;",
    ].join("\n");
    const preview = await imports().preview("collaborateurs", csv);
    expect(preview).toMatchObject({ total: 3, valid: 1 });
    expect(preview.rejected.map((line) => line.line)).toEqual([3, 4]);
    expect(preview.rejected[0].errors[0]).toMatch(/déjà enregistré/);

    expect(await imports().run("collaborateurs", csv)).toEqual({
      created: 1,
      skipped: 2,
    });
    const person = await testRawPrisma.person.findFirstOrThrow({
      where: { workEmail: "lea.import@exemple.fr" },
      include: { team: true },
    });
    expect(person.organizationId).toBe(a.organizationId);
    expect(person.team?.name).toBe("Équipe importée");
    expect(
      await testRawPrisma.auditLog.count({
        where: {
          action: "person.import",
          resourceId: person.id,
          organizationId: a.organizationId,
        },
      }),
    ).toBe(1);
    // L'autre entreprise n'est pas touchée
    expect(
      await testRawPrisma.person.count({
        where: {
          organizationId: b.organizationId,
          workEmail: "lea.import@exemple.fr",
        },
      }),
    ).toBe(0);
  });

  it("ne dépasse pas la limite de l'offre", async () => {
    await testRawPrisma.organization.update({
      where: { id: a.organizationId },
      data: { plan: "pro" },
    });
    const active = await testRawPrisma.person.count({
      where: { organizationId: a.organizationId, status: "ACTIVE" },
    });
    const room = 50 - active;
    expect(room).toBeGreaterThan(0);
    const csv = [
      "Prénom;Nom;E-mail;Poste",
      ...Array.from(
        { length: room + 2 },
        (_, i) => `P${i};N;p${i}@limite.fr;Poste`,
      ),
    ].join("\n");
    const preview = await imports().preview("collaborateurs", csv);
    expect(preview.valid).toBe(room);
    expect(preview.rejected.at(-1)?.errors[0]).toMatch(/Limite de l'offre/);
    await imports().run("collaborateurs", csv);
    expect(
      await testRawPrisma.person.count({
        where: { organizationId: a.organizationId, status: "ACTIVE" },
      }),
    ).toBe(50);
  });

  it("est refusé sans le droit d'écriture", async () => {
    await expect(
      imports("employee").preview("collaborateurs", "a"),
    ).rejects.toThrow();
    await expect(imports("employee").run("stock", "a")).rejects.toThrow();
  });
});

describe("import de matériel et de stock", () => {
  it("refuse les numéros de série existants, accepte le même numéro dans une autre entreprise", async () => {
    const serial = (
      await testRawPrisma.asset.findFirstOrThrow({
        where: { organizationId: b.organizationId },
      })
    ).serialNumber;
    const own = (
      await testRawPrisma.asset.findFirstOrThrow({
        where: { organizationId: a.organizationId },
      })
    ).serialNumber;
    const csv = [
      "Type;Marque;Modèle;Numéro de série",
      `Écran;Dell;P1;${serial}`,
      `Écran;Dell;P1;${own}`,
    ].join("\n");
    const result = await imports().run("materiel", csv);
    expect(result.created).toBe(serial === own ? 0 : 1);
    expect(result.skipped).toBe(serial === own ? 2 : 1);
  });

  it("crée les articles avec un mouvement d'entrée pour la quantité initiale", async () => {
    const csv = [
      "Article;Référence;Unité;Seuil;Quantité",
      "Café;IMP-CAFE;paquets;2;12",
      "Thé;IMP-THE;boîtes;;",
    ].join("\n");
    expect(await imports().run("stock", csv)).toEqual({
      created: 2,
      skipped: 0,
    });
    const cafe = await testRawPrisma.stockItem.findFirstOrThrow({
      where: { organizationId: a.organizationId, reference: "IMP-CAFE" },
      include: { movements: true },
    });
    expect(cafe.threshold).toBe(2);
    expect(cafe.movements).toMatchObject([
      { type: "IN", quantity: 12, reason: "Import CSV" },
    ]);
    const the = await testRawPrisma.stockItem.findFirstOrThrow({
      where: { reference: "IMP-THE" },
      include: { movements: true },
    });
    expect(the.movements).toEqual([]);
    expect(
      await testRawPrisma.auditLog.count({ where: { action: "stock.import" } }),
    ).toBe(2);
    // Une seconde fois : tout est refusé (références existantes)
    expect(await imports().run("stock", csv)).toEqual({
      created: 0,
      skipped: 2,
    });
  });
});
