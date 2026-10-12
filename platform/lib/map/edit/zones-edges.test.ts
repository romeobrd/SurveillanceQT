import { describe, expect, it } from "vitest";
import { generateLayout } from "../generator";
import { edgeAtPoint, edgeKey, edgeState, setEdge } from "./edges";
import { createEmptyLayout, MAX_EMPTY_SIZE, MIN_EMPTY_SIZE } from "./empty";
import { sequentialIds } from "./ids";
import { addElement, removeElements } from "./operations";
import { validateForSave } from "./save";
import {
  addZone,
  removeZone,
  renameZone,
  resizeZone,
  setZoneType,
} from "./zones";
import type { Layout } from "../schema";

const empty = () => createEmptyLayout(12, 10, sequentialIds());
const wallKeys = (layout: Layout) => new Set(layout.walls.map(edgeKey));

describe("locaux vides", () => {
  it("créent un espace ouvert fermé par des murs avec une entrée au sud, enregistrable", () => {
    const layout = empty();
    expect(layout.zones).toHaveLength(1);
    expect(layout.doors).toEqual([{ x: 6, y: 10, side: "N" }]);
    expect(layout.walls).toHaveLength(2 * (12 + 10) - 1);
    expect(validateForSave(layout)).toEqual([]);
  });

  it("refusent une taille hors limites", () => {
    expect(() => createEmptyLayout(MIN_EMPTY_SIZE - 1, 20)).toThrow(RangeError);
    expect(() => createEmptyLayout(20, MAX_EMPTY_SIZE + 1)).toThrow(RangeError);
    expect(() => createEmptyLayout(20.5, 20)).toThrow(RangeError);
  });
});

describe("pièces", () => {
  it("trace une pièce dans l'espace libre et crée ses murs de contour", () => {
    const shrunk = resizeZone(empty(), "z-test1", { x: 0, y: 0, w: 6, h: 10 });
    if (!shrunk.ok) throw new Error(shrunk.problem);
    const added = addZone(
      shrunk.layout,
      { x: 6, y: 0, w: 6, h: 10 },
      "salle_reunion",
      sequentialIds(),
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.layout.zones).toHaveLength(2);
    expect(added.layout.zones[1]).toMatchObject({
      type: "salle_reunion",
      name: "Salle de réunion 1",
    });
    expect(wallKeys(added.layout).has("W:12:0")).toBe(true);
    expect(wallKeys(added.layout).has("W:6:5")).toBe(true); // cloison entre les deux pièces
  });

  it("refuse chevauchement, hors carte et pièce trop petite", () => {
    expect(
      addZone(empty(), { x: 2, y: 2, w: 3, h: 3 }, "bureau_individuel"),
    ).toEqual({ ok: false, problem: "zone_overlap" });
    const shrunk = resizeZone(empty(), "z-test1", { x: 0, y: 0, w: 6, h: 10 });
    if (!shrunk.ok) throw new Error(shrunk.problem);
    expect(
      addZone(shrunk.layout, { x: 10, y: 0, w: 5, h: 5 }, "reserve"),
    ).toEqual({ ok: false, problem: "zone_out_of_bounds" });
    expect(
      addZone(shrunk.layout, { x: 6, y: 0, w: 1, h: 5 }, "reserve"),
    ).toEqual({ ok: false, problem: "zone_too_small" });
  });

  it("redimensionne en déplaçant les murs de contour, ancienne porte comprise", () => {
    const resized = resizeZone(empty(), "z-test1", { x: 0, y: 0, w: 12, h: 8 });
    expect(resized.ok).toBe(true);
    if (!resized.ok) return;
    expect(wallKeys(resized.layout).has("N:0:10")).toBe(false); // ancien mur sud retiré
    expect(wallKeys(resized.layout).has("N:0:8")).toBe(true); // nouveau mur sud
    expect(resized.layout.doors).toHaveLength(0); // l'entrée était sur l'ancien contour
    expect(validateForSave(resized.layout).map((p) => p.code)).toContain(
      "no_entrance",
    );
  });

  it("refuse de réduire une pièce sous son mobilier", () => {
    const placed = addElement(
      empty(),
      { catalogKey: "plante", x: 10, y: 4, rotation: 0 },
      sequentialIds(),
    );
    if (!placed.ok) throw new Error(placed.problem);
    expect(
      resizeZone(placed.layout, "z-test1", { x: 0, y: 0, w: 8, h: 10 }),
    ).toEqual({ ok: false, problem: "elements_outside" });
  });

  it("renomme (nom valide) et change le type en adaptant la couleur du sol", () => {
    const renamed = renameZone(empty(), "z-test1", "  Atelier  ");
    expect(renamed.ok && renamed.layout.zones[0].name).toBe("Atelier");
    expect(renameZone(empty(), "z-test1", "   ")).toEqual({
      ok: false,
      problem: "invalid_name",
    });
    expect(renameZone(empty(), "z-test1", "x".repeat(81))).toEqual({
      ok: false,
      problem: "invalid_name",
    });
    expect(renameZone(empty(), "inconnue", "x")).toEqual({
      ok: false,
      problem: "not_found",
    });
    const typed = setZoneType(empty(), "z-test1", "cafeteria");
    expect(typed.ok && typed.layout.zones[0]).toMatchObject({
      type: "cafeteria",
      floorColor: "#f0d9b5",
    });
  });

  it("supprime une pièce avec son mobilier et ses murs devenus orphelins", () => {
    const shrunk = resizeZone(empty(), "z-test1", { x: 0, y: 0, w: 6, h: 10 });
    if (!shrunk.ok) throw new Error(shrunk.problem);
    const added = addZone(
      shrunk.layout,
      { x: 6, y: 0, w: 6, h: 10 },
      "reserve",
      sequentialIds(),
    );
    if (!added.ok) throw new Error(added.problem);
    const withShelf = addElement(
      added.layout,
      { catalogKey: "etagere", x: 8, y: 3, rotation: 0 },
      sequentialIds(),
    );
    if (!withShelf.ok) throw new Error(withShelf.problem);
    const removed = removeZone(withShelf.layout, added.id);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.layout.zones).toHaveLength(1);
    expect(removed.layout.elements).toHaveLength(0);
    expect(wallKeys(removed.layout).has("W:12:0")).toBe(false); // mur extérieur de la pièce supprimée
    expect(wallKeys(removed.layout).has("W:6:5")).toBe(true); // reste le mur de la pièce conservée
  });
});

describe("murs, cloisons vitrées et portes", () => {
  it("pose un mur plein, une cloison vitrée, puis une porte, et vide une arête", () => {
    let layout = empty();
    const edge = { x: 4, y: 3, side: "W" as const };
    const solid = setEdge(layout, edge, "solid");
    if (!solid.ok) throw new Error(solid.problem);
    expect(edgeState(solid.layout, edge)).toBe("solid");
    const glass = setEdge(solid.layout, edge, "glass");
    if (!glass.ok) throw new Error(glass.problem);
    expect(edgeState(glass.layout, edge)).toBe("glass");
    expect(
      glass.layout.walls.find((w) => edgeKey(w) === edgeKey(edge))?.kind,
    ).toBe("glass");
    const door = setEdge(glass.layout, edge, "door");
    if (!door.ok) throw new Error(door.problem);
    expect(edgeState(door.layout, edge)).toBe("door");
    expect(door.layout.walls.some((w) => edgeKey(w) === edgeKey(edge))).toBe(
      false,
    );
    const cleared = setEdge(door.layout, edge, "none");
    expect(cleared.ok && edgeState(cleared.layout, edge)).toBe("none");
    layout = cleared.ok ? cleared.layout : layout;
    expect(validateForSave(layout)).toEqual([]);
  });

  it("refuse une arête hors carte ou hors de toute pièce, et une porte devant du mobilier", () => {
    expect(setEdge(empty(), { x: 0, y: 99, side: "N" }, "solid")).toEqual({
      ok: false,
      problem: "edge_out_of_bounds",
    });
    const shrunk = resizeZone(empty(), "z-test1", { x: 0, y: 0, w: 6, h: 10 });
    if (!shrunk.ok) throw new Error(shrunk.problem);
    expect(setEdge(shrunk.layout, { x: 9, y: 4, side: "W" }, "solid")).toEqual({
      ok: false,
      problem: "edge_outside_zone",
    });
    const desk = addElement(
      empty(),
      { catalogKey: "plante", x: 3, y: 3, rotation: 0 },
      sequentialIds(),
    );
    if (!desk.ok) throw new Error(desk.problem);
    expect(setEdge(desk.layout, { x: 3, y: 3, side: "N" }, "door")).toEqual({
      ok: false,
      problem: "door_blocked",
    });
    expect(setEdge(desk.layout, { x: 3, y: 3, side: "N" }, "solid").ok).toBe(
      true,
    );
  });

  it("une cloison complète qui coupe la pièce sans porte rend la carte non enregistrable", () => {
    let layout = empty();
    for (let y = 0; y < 10; y++) {
      const result = setEdge(layout, { x: 6, y, side: "W" }, "solid");
      if (!result.ok) throw new Error(result.problem);
      layout = result.layout;
    }
    expect(validateForSave(layout).map((p) => p.code)).toContain("unreachable");
    const withDoor = setEdge(layout, { x: 6, y: 4, side: "W" }, "door");
    expect(withDoor.ok && validateForSave(withDoor.layout)).toEqual([]);
  });

  it("tolère une petite alcôve fermée (meuble retiré d'un recoin)", () => {
    const ids = sequentialIds();
    let layout = empty();
    const center = addElement(
      layout,
      { catalogKey: "plante", x: 4, y: 4, rotation: 0 },
      ids,
    );
    if (!center.ok) throw new Error(center.problem);
    layout = center.layout;
    for (const [x, y] of [
      [4, 3],
      [3, 4],
      [5, 4],
      [4, 5],
    ]) {
      const result = addElement(
        layout,
        { catalogKey: "plante", x, y, rotation: 0 },
        ids,
      );
      if (!result.ok) throw new Error(result.problem);
      layout = result.layout;
    }
    // Enfermer une tuile atteignable est refusé par l'éditeur…
    expect(validateForSave(layout)).toEqual([]);
    // …mais retirer le meuble central laisse une alcôve d'une tuile : inoffensive
    layout = removeElements(layout, [center.id]);
    expect(validateForSave(layout)).toEqual([]);
  });

  it("refuse d'enfermer une tuile libre atteignable", () => {
    const ids = sequentialIds();
    let layout = empty();
    for (const [x, y] of [
      [4, 3],
      [3, 4],
      [5, 4],
    ]) {
      const result = addElement(
        layout,
        { catalogKey: "plante", x, y, rotation: 0 },
        ids,
      );
      if (!result.ok) throw new Error(result.problem);
      layout = result.layout;
    }
    expect(
      addElement(
        layout,
        { catalogKey: "plante", x: 4, y: 5, rotation: 0 },
        ids,
      ),
    ).toEqual({
      ok: false,
      problem: "blocks_path",
    });
  });

  it("trouve l'arête la plus proche d'un point de la grille", () => {
    expect(edgeAtPoint(3.5, 4.05)).toEqual({ x: 3, y: 4, side: "N" });
    expect(edgeAtPoint(3.96, 2.5)).toEqual({ x: 4, y: 2, side: "W" });
    expect(edgeAtPoint(3.5, 3.5)).toBeNull(); // centre de tuile : aucune arête
  });
});

describe("cartes générées", () => {
  it("restent enregistrables sans modification", () => {
    for (const seed of [1, 2, 3, 2024])
      expect(validateForSave(generateLayout(seed))).toEqual([]);
  });
});
