import { describe, expect, it } from "vitest";
import { generateLayout } from "./generator";
import { buildScene, getWorldBounds } from "./scene";
import { findSeatTile } from "./seats";
import { CATALOG } from "./catalog";
import { buildZoneLookup, zoneIdAtTile } from "./zones";
import { hexToInt, shade } from "./color";
import { isBehind } from "./depth";

const layout = generateLayout(11);

describe("scène", () => {
  const workstations = layout.elements.filter(
    (e) => CATALOG[e.catalogKey].isWorkstation,
  );
  const people = workstations.map((w) => ({
    workstationElementId: w.id,
    color: "#3366cc",
  }));
  const scene = buildScene(layout, people);

  it("contient murs, portes, éléments et personnages", () => {
    expect(scene.filter((i) => i.kind === "wall")).toHaveLength(
      layout.walls.length,
    );
    expect(scene.filter((i) => i.kind === "door")).toHaveLength(
      layout.doors.length,
    );
    expect(scene.filter((i) => i.kind === "element")).toHaveLength(
      layout.elements.length,
    );
    expect(scene.filter((i) => i.kind === "person").length).toBeGreaterThan(0);
  });

  it("respecte la relation de profondeur pour chaque paire", () => {
    for (let i = 0; i < scene.length; i++) {
      for (let j = i + 1; j < scene.length; j++) {
        const a = scene[i].footprint;
        const b = scene[j].footprint;
        // a est dessiné avant b : b ne doit pas être strictement derrière a
        expect(isBehind(b, a) && !isBehind(a, b)).toBe(false);
      }
    }
  });

  it("calcule des bornes monde cohérentes", () => {
    const bounds = getWorldBounds(layout);
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });
});

describe("sièges", () => {
  it("trouve une tuile voisine pour chaque poste d'un open space", () => {
    const withSeat = layout.elements
      .filter((e) => CATALOG[e.catalogKey].isWorkstation)
      .filter((e) => findSeatTile(layout, e) !== null);
    expect(withSeat.length).toBeGreaterThan(0);
  });
});

describe("recherche de zone", () => {
  const lookup = buildZoneLookup(layout);
  it("retrouve la zone de chaque tuile d'une zone", () => {
    for (const zone of layout.zones) {
      const rect = zone.rects[0];
      expect(zoneIdAtTile(layout, lookup, rect.x, rect.y)).toBe(zone.id);
      expect(
        zoneIdAtTile(layout, lookup, rect.x + rect.w - 1, rect.y + rect.h - 1),
      ).toBe(zone.id);
    }
  });
  it("retourne null hors carte", () => {
    expect(zoneIdAtTile(layout, lookup, -1, 0)).toBeNull();
    expect(zoneIdAtTile(layout, lookup, layout.width, 0)).toBeNull();
  });
});

describe("couleurs", () => {
  it("convertit une couleur hexadécimale", () => {
    expect(hexToInt("#ff8000")).toBe(0xff8000);
  });
  it("assombrit et éclaircit sans dépasser les bornes", () => {
    expect(shade("#808080", 0.5)).toBe(0x404040);
    expect(shade("#ffffff", 2)).toBe(0xffffff);
  });
});
