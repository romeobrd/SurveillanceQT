import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/map/catalog";
import { generateLayout } from "@/lib/map/generator";
import {
  catalogParts,
  doorParts,
  elementSize,
  partsTop,
  personParts,
  wallParts,
} from "@/lib/map/models";
import type { Rotation } from "@/lib/map/schema";

const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const EPSILON = 1e-9;

describe("modèles 3D du catalogue", () => {
  it("chaque objet a au moins une forme, posée au sol et contenue dans son emprise, à toute rotation", () => {
    for (const key of Object.keys(CATALOG)) {
      for (const rotation of ROTATIONS) {
        const parts = catalogParts(key, 10, 20, rotation);
        expect(parts.length, key).toBeGreaterThan(0);
        const { w, h } = elementSize(key, rotation);
        for (const part of parts) {
          expect(
            part.x - part.sx / 2,
            `${key}@${rotation}`,
          ).toBeGreaterThanOrEqual(10 - EPSILON);
          expect(
            part.x + part.sx / 2,
            `${key}@${rotation}`,
          ).toBeLessThanOrEqual(10 + w + EPSILON);
          expect(
            part.z - part.sz / 2,
            `${key}@${rotation}`,
          ).toBeGreaterThanOrEqual(20 - EPSILON);
          expect(
            part.z + part.sz / 2,
            `${key}@${rotation}`,
          ).toBeLessThanOrEqual(20 + h + EPSILON);
          expect(part.y - part.sy / 2).toBeGreaterThanOrEqual(-EPSILON);
          for (const size of [part.sx, part.sy, part.sz])
            expect(size).toBeGreaterThan(0);
          expect(part.color).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
    }
  });

  it("un quart de tour échange largeur et profondeur de l'emprise", () => {
    const flat = catalogParts("bureau_simple", 0, 0, 0);
    const turned = catalogParts("bureau_simple", 0, 0, 90);
    expect(turned).toHaveLength(flat.length);
    const extent = (parts: typeof flat, axis: "x" | "z") =>
      Math.max(...parts.map((p) => p[axis] + (axis === "x" ? p.sx : p.sz) / 2));
    expect(extent(flat, "x")).toBeCloseTo(extent(turned, "z"));
    expect(extent(flat, "z")).toBeCloseTo(extent(turned, "x"));
  });

  it("est déterministe (mêmes formes pour le même objet)", () => {
    expect(catalogParts("etagere", 3, 4, 180)).toEqual(
      catalogParts("etagere", 3, 4, 180),
    );
  });

  it("les bureaux portent des écrans et restent plus bas que les murs", () => {
    const parts = catalogParts("bureau_double", 0, 0, 0);
    expect(parts.some((p) => p.color === "#2b2f36")).toBe(true);
    expect(partsTop(parts)).toBeLessThan(1);
  });

  it("un objet inconnu ne produit rien", () => {
    expect(catalogParts("inconnu", 0, 0, 0)).toEqual([]);
  });

  it("les modèles de toute une carte générée restent raisonnables en nombre", () => {
    const layout = generateLayout(2024);
    const total = layout.elements.reduce(
      (sum, e) => sum + catalogParts(e.catalogKey, e.x, e.y, e.rotation).length,
      0,
    );
    expect(total).toBeLessThan(20_000);
  });
});

describe("murs, portes et figurines", () => {
  it("un mur nord suit l'axe X, un mur ouest l'axe Z", () => {
    const [north] = wallParts({ x: 3, y: 5, side: "N" });
    expect(north).toMatchObject({ x: 3.5, z: 5 });
    expect(north.sx).toBeGreaterThan(north.sz);
    const [west] = wallParts({ x: 3, y: 5, side: "W" });
    expect(west).toMatchObject({ x: 3, z: 5.5 });
    expect(west.sz).toBeGreaterThan(west.sx);
  });

  it("une cloison vitrée est translucide, encadrée", () => {
    const parts = wallParts({ x: 0, y: 0, side: "N", kind: "glass" });
    expect(parts.filter((p) => p.glass)).toHaveLength(1);
    expect(parts.length).toBeGreaterThan(1);
  });

  it("une porte n'est qu'un seuil au sol (on passe)", () => {
    const [threshold] = doorParts({ x: 1, y: 1, side: "W" });
    expect(threshold.y + threshold.sy / 2).toBeLessThan(0.05);
  });

  it("une figurine se tient au centre de sa tuile, avec la couleur demandée", () => {
    const parts = personParts(4, 7, "#123456");
    expect(parts.every((p) => p.x === 4.5 && p.z === 7.5)).toBe(true);
    expect(parts.some((p) => p.color === "#123456")).toBe(true);
  });
});
