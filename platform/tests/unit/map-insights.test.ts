import { describe, expect, it } from "vitest";
import {
  computeMapKpis,
  computeZoneAlerts,
  summarizeZone,
} from "@/features/map/insights";
import type { MapData } from "@/features/map/types";

const data: MapData = {
  people: [
    { id: "p1", firstName: "A", lastName: "B", jobTitle: "x", team: "T" },
    { id: "p2", firstName: "C", lastName: "D", jobTitle: "y", team: "T" },
  ],
  workstations: [
    { elementId: "e1", zoneId: "z1", label: "Poste 1", personId: "p1" },
    { elementId: "e2", zoneId: "z1", label: "Poste 2", personId: null },
    { elementId: "e3", zoneId: "z2", label: "Poste 3", personId: "p2" },
  ],
  stock: [
    {
      id: "s1",
      zoneId: "z3",
      name: "Papier",
      quantity: 2,
      unit: "u",
      threshold: 5,
    },
    {
      id: "s2",
      zoneId: "z3",
      name: "Agrafes",
      quantity: 9,
      unit: "u",
      threshold: 5,
    },
    {
      id: "s3",
      zoneId: "z1",
      name: "Café",
      quantity: 0,
      unit: "u",
      threshold: 0,
    },
  ],
  assets: [
    { id: "a1", zoneId: "z2", label: "Imprimante", state: "BROKEN" },
    { id: "a2", zoneId: "z2", label: "Écran", state: "IN_SERVICE" },
  ],
  projects: [],
};

describe("indicateurs de la carte", () => {
  it("compte collaborateurs, postes, alertes de stock et pannes", () => {
    expect(computeMapKpis(data)).toEqual({
      people: 2,
      workstationsOccupied: 2,
      workstationsTotal: 3,
      lowStock: 1, // un seuil à 0 ne déclenche jamais d'alerte
      brokenAssets: 1,
    });
  });

  it("place des alertes seulement sur les pièces concernées, dans l'ordre des zones", () => {
    expect(computeZoneAlerts(data, ["z1", "z2", "z3"])).toEqual([
      { zoneId: "z2", lowStock: 0, brokenAssets: 1 },
      { zoneId: "z3", lowStock: 1, brokenAssets: 0 },
    ]);
    expect(computeZoneAlerts(data, ["z1"])).toEqual([]);
  });

  it("résume une pièce : stock à réapprovisionner en premier", () => {
    const summary = summarizeZone(data, "z3");
    expect(summary.stock.map((item) => item.name)).toEqual([
      "Papier",
      "Agrafes",
    ]);
    expect(summary).toMatchObject({ lowStock: 1, workstations: 0, assets: 0 });
    expect(summarizeZone(data, "z1")).toMatchObject({
      occupied: 1,
      workstations: 2,
    });
  });

  it("ne contient aucune donnée personnelle (seulement des nombres)", () => {
    const kpis = computeMapKpis(data);
    expect(
      Object.values(kpis).every((value) => typeof value === "number"),
    ).toBe(true);
  });
});
