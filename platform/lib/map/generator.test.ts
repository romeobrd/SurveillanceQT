import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { generateLayout } from "./generator";
import {
  areAllZonesAccessible,
  findUnreachableTiles,
  getEntranceTiles,
} from "./reachability";
import { LayoutSchema, ZONE_TYPES } from "./schema";
import { validateLayout } from "./validate";

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

describe("generateLayout", () => {
  it("est déterministe : même seed = même carte", () => {
    expect(generateLayout(123)).toEqual(generateLayout(123));
  });

  it("produit des cartes différentes pour des seeds différents", () => {
    expect(generateLayout(1)).not.toEqual(generateLayout(2));
  });

  it("respecte une taille imposée", () => {
    const layout = generateLayout(5, { width: 24, height: 30 });
    expect([layout.width, layout.height]).toEqual([24, 30]);
  });

  it("mémorise le seed d'origine", () => {
    expect(generateLayout(99).seed).toBe(99);
  });

  describe(`sur ${SEEDS.length} seeds`, () => {
    const layouts = SEEDS.map((seed) => generateLayout(seed));

    it("respecte le schéma et la taille 20×20 à 40×40", () => {
      for (const layout of layouts) {
        expect(LayoutSchema.safeParse(layout).success).toBe(true);
        expect(layout.width).toBeGreaterThanOrEqual(20);
        expect(layout.width).toBeLessThanOrEqual(40);
        expect(layout.height).toBeGreaterThanOrEqual(20);
        expect(layout.height).toBeLessThanOrEqual(40);
      }
    });

    it("n'a aucun problème de cohérence (collision, hors zone, doublon)", () => {
      for (const layout of layouts) expect(validateLayout(layout)).toEqual([]);
    });

    it("rend toutes les pièces et toutes les tuiles libres accessibles depuis l'entrée", () => {
      for (const layout of layouts) {
        expect(getEntranceTiles(layout).length).toBeGreaterThan(0);
        expect(areAllZonesAccessible(layout)).toBe(true);
        expect(findUnreachableTiles(layout)).toEqual([]);
      }
    });

    it("contient les 7 types de zones, dont un seul accueil", () => {
      for (const layout of layouts) {
        const types = layout.zones.map((zone) => zone.type);
        for (const type of ZONE_TYPES) expect(types).toContain(type);
        expect(types.filter((type) => type === "accueil")).toHaveLength(1);
      }
    });

    it("n'utilise que des éléments du catalogue, jamais de structure", () => {
      for (const layout of layouts) {
        for (const element of layout.elements) {
          expect(CATALOG[element.catalogKey]).toBeDefined();
          expect(CATALOG[element.catalogKey].category).not.toBe("structure");
        }
      }
    });

    it("meuble chaque type de zone de façon cohérente", () => {
      for (const layout of layouts) {
        const keysOf = (type: string) =>
          layout.elements
            .filter(
              (e) => layout.zones.find((z) => z.id === e.zoneId)?.type === type,
            )
            .map((e) => e.catalogKey);
        const hasKey = (type: string, key: string) =>
          keysOf(type).includes(key);
        for (const zone of layout.zones) {
          if (zone.type === "salle_serveur")
            expect(hasKey(zone.type, "baie_serveur")).toBe(true);
          if (zone.type === "reserve")
            expect(hasKey(zone.type, "etagere")).toBe(true);
        }
        expect(
          layout.elements.some((e) => CATALOG[e.catalogKey].isWorkstation),
        ).toBe(true);
      }
    });
  });
});
