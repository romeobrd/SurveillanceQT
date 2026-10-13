import { describe, expect, it } from "vitest";
import { suggestedReorder, toReorderCsv } from "@/features/stock/reorder";

describe("réapprovisionnement", () => {
  it("conseille de revenir à deux fois le seuil, seulement sous le seuil", () => {
    expect(suggestedReorder(3, 10)).toBe(17);
    expect(suggestedReorder(0, 5)).toBe(10);
    expect(suggestedReorder(-2, 5)).toBe(10); // un stock négatif (erreur d'inventaire) ne gonfle pas la commande
    expect(suggestedReorder(10, 10)).toBe(0);
    expect(suggestedReorder(0, 0)).toBe(0); // seuil à 0 : pas d'alerte
  });

  it("exporte un CSV français lisible par un tableur", () => {
    const csv = toReorderCsv([
      {
        name: "Papier A4",
        reference: "PAP-A4",
        zone: "Réserve 1",
        quantity: 4,
        threshold: 10,
        unit: "ramettes",
        suggested: 16,
      },
      {
        name: 'Stylo "bleu"; fin',
        reference: "STY",
        zone: null,
        quantity: 1,
        threshold: 3,
        unit: "boîtes",
        suggested: 5,
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0]).toBe(
      "Article;Référence;Zone;Quantité;Seuil;Unité;À commander",
    );
    expect(lines[1]).toBe("Papier A4;PAP-A4;Réserve 1;4;10;ramettes;16");
    expect(lines[2]).toBe('"Stylo ""bleu""; fin";STY;;1;3;boîtes;5');
  });

  it("neutralise les formules de tableur (injection CSV)", () => {
    const csv = toReorderCsv([
      {
        name: '=HYPERLINK("x")',
        reference: "+1",
        zone: "@zone",
        quantity: 0,
        threshold: 1,
        unit: "-u",
        suggested: 2,
      },
    ]);
    const row = csv.slice(1).trim().split("\r\n")[1];
    expect(row.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(row).toContain(";'+1;'@zone;");
    expect(row).toContain(";'-u;");
  });
});
