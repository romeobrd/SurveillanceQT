import { describe, expect, it } from "vitest";
import { generateLayout } from "../generator";
import { createEmptyLayout } from "./empty";
import { sequentialIds } from "./ids";
import {
  addElement,
  moveElements,
  nextRotation,
  removeElements,
  rotateElements,
} from "./operations";
import type { Layout } from "../schema";

const base = () => createEmptyLayout(12, 12, sequentialIds());

function place(
  layout: Layout,
  key: string,
  x: number,
  y: number,
): { layout: Layout; id: string } {
  const result = addElement(
    layout,
    { catalogKey: key, x, y, rotation: 0 },
    sequentialIds(),
  );
  if (!result.ok) throw new Error(`refusé : ${result.problem}`);
  return { layout: result.layout, id: result.id };
}

describe("ajout", () => {
  it("ajoute un élément rattaché à sa pièce, sans modifier la carte d'origine", () => {
    const original = base();
    const snapshot = JSON.stringify(original);
    const result = addElement(
      original,
      { catalogKey: "bureau_simple", x: 2, y: 2, rotation: 0 },
      sequentialIds(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(result.layout.elements).toHaveLength(1);
    expect(result.layout.elements[0]).toMatchObject({
      catalogKey: "bureau_simple",
      zoneId: original.zones[0].id,
    });
  });

  it("produit des identifiants uniques, jamais réutilisés après suppression", () => {
    const a = place(base(), "plante", 1, 1);
    const b = place(a.layout, "plante", 3, 1);
    const withoutB = removeElements(b.layout, [b.id]);
    const again = addElement(withoutB, {
      catalogKey: "plante",
      x: 3,
      y: 1,
      rotation: 0,
    }); // fabrique aléatoire
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.id).not.toBe(b.id);
  });

  it("refuse un placement invalide en donnant la raison", () => {
    const first = place(base(), "bureau_simple", 2, 2);
    expect(
      addElement(first.layout, {
        catalogKey: "bureau_simple",
        x: 2,
        y: 2,
        rotation: 0,
      }),
    ).toEqual({
      ok: false,
      problem: "collision",
    });
  });
});

describe("déplacement", () => {
  it("déplace un élément et met à jour sa pièce", () => {
    const start = place(base(), "bureau_simple", 2, 2);
    const moved = moveElements(start.layout, [start.id], 3, 1);
    expect(moved.ok).toBe(true);
    if (moved.ok)
      expect(moved.layout.elements[0]).toMatchObject({ x: 5, y: 3 });
  });

  it("refuse un déplacement qui sort de la carte ou entre en collision", () => {
    const a = place(base(), "bureau_simple", 2, 2);
    const b = place(a.layout, "bureau_simple", 6, 2);
    expect(moveElements(b.layout, [b.id], -3, 0)).toMatchObject({
      ok: false,
      problem: "collision",
    });
    expect(moveElements(b.layout, [b.id], 20, 0)).toMatchObject({
      ok: false,
      problem: "out_of_bounds",
    });
  });

  it("déplace une sélection multiple d'un bloc, ou rien du tout", () => {
    const a = place(base(), "plante", 1, 1);
    const b = place(a.layout, "plante", 3, 1);
    const ok = moveElements(b.layout, [a.id, b.id], 0, 2);
    expect(ok.ok && ok.layout.elements.map((e) => e.y)).toEqual([3, 3]);
    // Le second sortirait de la carte : aucun des deux ne bouge
    const blocked = moveElements(b.layout, [a.id, b.id], 9, 0);
    expect(blocked.ok).toBe(false);
  });

  it("ne déplace pas sur une tuile occupée par un élément de la même sélection (swap) sans collision", () => {
    const a = place(base(), "plante", 1, 1);
    const b = place(a.layout, "plante", 2, 1);
    // Décaler les deux d'une tuile à droite est valide : ils ne se chevauchent pas entre eux
    expect(moveElements(b.layout, [a.id, b.id], 1, 0).ok).toBe(true);
  });

  it("signale une sélection vide", () => {
    expect(moveElements(base(), [], 1, 0)).toEqual({
      ok: false,
      problem: "nothing_selected",
    });
  });
});

describe("rotation", () => {
  it("fait tourner par pas de 90° et change l'emprise", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
    const start = place(base(), "bureau_simple", 2, 2); // 2×1
    const rotated = rotateElements(start.layout, [start.id]);
    expect(rotated.ok && rotated.layout.elements[0].rotation).toBe(90);
  });

  it("refuse une rotation qui collisionne et un élément non pivotable", () => {
    const desk = place(base(), "bureau_simple", 2, 2);
    const wall = place(desk.layout, "plante", 2, 3); // sous le bureau : le bureau vertical (2,2)-(2,3) heurte la plante
    expect(rotateElements(wall.layout, [desk.id])).toMatchObject({
      ok: false,
      problem: "collision",
    });
    expect(rotateElements(wall.layout, [wall.id])).toMatchObject({
      ok: false,
      problem: "not_rotatable",
    });
  });
});

describe("suppression", () => {
  it("retire les éléments demandés et ignore les identifiants inconnus", () => {
    const a = place(base(), "plante", 1, 1);
    const b = place(a.layout, "plante", 3, 1);
    expect(
      removeElements(b.layout, [a.id, "inconnu"]).elements.map((e) => e.id),
    ).toEqual([b.id]);
  });
});

describe("robustesse : une suite quelconque d'opérations ne produit jamais de carte invalide", () => {
  it("garde la carte cohérente après des centaines d'opérations aléatoires", async () => {
    const { validateForSave } = await import("./save");
    const { createRng } = await import("../prng");
    for (const seed of [1, 7, 42, 99, 123]) {
      let layout = generateLayout(seed);
      expect(validateForSave(layout)).toEqual([]);
      const rng = createRng(seed);
      const keys = [
        "bureau_simple",
        "bureau_double",
        "ilot_4",
        "plante",
        "etagere",
        "table_reunion",
        "baie_serveur",
      ];
      for (let step = 0; step < 150; step++) {
        const roll = rng.next();
        if (roll < 0.45) {
          const result = addElement(layout, {
            catalogKey: rng.pick(keys),
            x: rng.int(0, layout.width - 1),
            y: rng.int(0, layout.height - 1),
            rotation: rng.pick([0, 90, 180, 270] as const),
          });
          if (result.ok) layout = result.layout;
        } else if (roll < 0.75 && layout.elements.length > 0) {
          const target = rng.pick(layout.elements);
          const result = moveElements(
            layout,
            [target.id],
            rng.int(-3, 3),
            rng.int(-3, 3),
          );
          if (result.ok) layout = result.layout;
        } else if (roll < 0.9 && layout.elements.length > 0) {
          const result = rotateElements(layout, [rng.pick(layout.elements).id]);
          if (result.ok) layout = result.layout;
        } else if (layout.elements.length > 0) {
          layout = removeElements(layout, [rng.pick(layout.elements).id]);
        }
        expect(
          validateForSave(layout),
          `graine ${seed}, étape ${step}`,
        ).toEqual([]);
      }
    }
  });
});
