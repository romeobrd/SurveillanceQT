import { describe, expect, it } from "vitest";
import { addElement, removeElements } from "./operations";
import { createEmptyLayout } from "./empty";
import { checkPlacement } from "./placement";
import { addZone, resizeZone } from "./zones";
import { sequentialIds } from "./ids";
import type { Layout } from "../schema";

const empty = () => createEmptyLayout(10, 10, sequentialIds());
const desk = (x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0) => ({
  catalogKey: "bureau_simple",
  x,
  y,
  rotation,
});

describe("validité d'un placement", () => {
  it("accepte un placement libre dans une pièce", () => {
    expect(checkPlacement(empty(), desk(3, 3))).toBeNull();
  });

  it("refuse hors de la carte", () => {
    expect(checkPlacement(empty(), desk(-1, 0))).toBe("out_of_bounds");
    expect(checkPlacement(empty(), desk(9, 0))).toBe("out_of_bounds"); // emprise 2×1 déborde à droite
    expect(checkPlacement(empty(), desk(0, 10))).toBe("out_of_bounds");
  });

  it("refuse une collision avec un autre élément, y compris par rotation", () => {
    const placed = addElement(empty(), desk(3, 3), sequentialIds());
    if (!placed.ok) throw new Error("placement initial refusé");
    expect(checkPlacement(placed.layout, desk(3, 3))).toBe("collision");
    expect(checkPlacement(placed.layout, desk(4, 3))).toBe("collision"); // chevauche la 2e tuile
    expect(checkPlacement(placed.layout, desk(5, 3))).toBeNull();
    // Un bureau vertical (rotation 90) occupe 1×2 : (3,2)-(3,3) chevauche
    expect(checkPlacement(placed.layout, desk(3, 2, 90))).toBe("collision");
  });

  it("refuse hors d'une pièce et à cheval sur deux pièces", () => {
    const shrunk = resizeZone(empty(), "z-test1", { x: 0, y: 0, w: 5, h: 10 });
    if (!shrunk.ok) throw new Error("redimensionnement refusé");
    expect(checkPlacement(shrunk.layout, desk(6, 3))).toBe("outside_zone"); // zone vide à droite
    const second = addZone(
      shrunk.layout,
      { x: 5, y: 0, w: 5, h: 10 },
      "salle_reunion",
      sequentialIds(),
    );
    if (!second.ok) throw new Error("zone refusée");
    expect(checkPlacement(second.layout, desk(4, 3))).toBe("outside_zone"); // (4,3) et (5,3) : deux pièces
    expect(checkPlacement(second.layout, desk(6, 3))).toBeNull();
  });

  it("garde libres les tuiles autour des portes", () => {
    // Porte d'entrée en (5, 10) côté nord de y=10 : tuile intérieure (5, 9)
    expect(
      checkPlacement(empty(), {
        catalogKey: "plante",
        x: 5,
        y: 9,
        rotation: 0,
      }),
    ).toBe("near_door");
    expect(
      checkPlacement(empty(), {
        catalogKey: "plante",
        x: 4,
        y: 9,
        rotation: 0,
      }),
    ).toBeNull();
  });

  it("refuse un élément qui coupe l'accès à une partie de la pièce", () => {
    let layout: Layout = empty();
    const ids = sequentialIds();
    // Une rangée de plantes sur toute la largeur en y = 5 : la dernière ferme le passage
    for (let x = 0; x < 9; x++) {
      const result = addElement(
        layout,
        { catalogKey: "plante", x, y: 5, rotation: 0 },
        ids,
      );
      if (!result.ok)
        throw new Error(`plante ${x} refusée : ${result.problem}`);
      layout = result.layout;
    }
    expect(
      checkPlacement(layout, { catalogKey: "plante", x: 9, y: 5, rotation: 0 }),
    ).toBe("blocks_path");
    // Retirer une plante rouvre le passage
    const removed = removeElements(layout, [layout.elements[3].id]);
    expect(
      checkPlacement(removed, {
        catalogKey: "plante",
        x: 9,
        y: 5,
        rotation: 0,
      }),
    ).toBeNull();
  });

  it("ne reproche pas un défaut d'accès déjà présent (carte sans entrée)", () => {
    const noEntrance: Layout = { ...empty(), doors: [] };
    expect(checkPlacement(noEntrance, desk(3, 3))).toBeNull();
  });

  it("refuse les éléments de structure et inconnus comme mobilier", () => {
    expect(
      checkPlacement(empty(), { catalogKey: "mur", x: 3, y: 3, rotation: 0 }),
    ).toBe("unknown_element");
    expect(
      checkPlacement(empty(), {
        catalogKey: "inconnu",
        x: 3,
        y: 3,
        rotation: 0,
      }),
    ).toBe("unknown_element");
  });
});
