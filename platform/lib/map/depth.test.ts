import { describe, expect, it } from "vitest";
import { isBehind, sortByDepth, type DepthItem } from "./depth";

const item = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  layer = 0,
) => ({
  id,
  footprint: { x, y, w, h },
  layer,
});
const order = (items: Array<DepthItem & { id: string }>) =>
  sortByDepth(items).map((i) => i.id);

describe("tri de profondeur", () => {
  it("place le plus proche de la caméra (x+y plus grand) en dernier", () => {
    expect(
      order([item("devant", 5, 5, 1, 1), item("derriere", 2, 2, 1, 1)]),
    ).toEqual(["derriere", "devant"]);
  });

  it("gère un objet long : un bureau 3×1 est avant un objet situé devant lui, même si sa somme x+y est plus petite", () => {
    // Le bureau occupe x ∈ [0,3[, y = 5 ; la plante est en (2, 6), devant le bout du bureau.
    // Somme des coins : bureau (0+5) < plante (2+6) mais aussi (2+5) < (2+6) : cas simple.
    // Cas piège : plante en (1, 4), derrière le bureau, alors que sa somme (5) égale celle du coin (0,5).
    const result = order([
      item("bureau", 0, 5, 3, 1),
      item("plante", 1, 4, 1, 1),
    ]);
    expect(result).toEqual(["plante", "bureau"]);
  });

  it("dessine un objet multi-tuiles après ce qu'il occulte, quelle que soit la somme des centres", () => {
    // Table large 4×1 en (0,3) ; petit objet en (3,2) derrière son extrémité droite.
    const result = order([
      item("table", 0, 3, 4, 1),
      item("petit", 3, 2, 1, 1),
    ]);
    expect(result).toEqual(["petit", "table"]);
  });

  it("place un mur sur arête nord derrière l'objet situé au sud et devant l'objet situé au nord", () => {
    const wall = item("mur", 3, 4, 1, 0);
    expect(order([wall, item("sud", 3, 4, 1, 1)])).toEqual(["mur", "sud"]);
    expect(order([wall, item("nord", 3, 3, 1, 1)])).toEqual(["nord", "mur"]);
  });

  it("place un mur sur arête ouest derrière l'objet situé à l'est et devant celui de l'ouest", () => {
    const wall = item("mur", 4, 3, 0, 1);
    expect(order([wall, item("est", 4, 3, 1, 1)])).toEqual(["mur", "est"]);
    expect(order([wall, item("ouest", 3, 3, 1, 1)])).toEqual(["ouest", "mur"]);
  });

  it("dessine un personnage après la chaise de même emprise", () => {
    const result = order([
      item("personne", 2, 2, 1, 1, 2),
      item("chaise", 2, 2, 1, 1, 1),
    ]);
    expect(result).toEqual(["chaise", "personne"]);
  });

  it("est indépendant de l'ordre d'entrée", () => {
    const items = [
      item("a", 0, 0, 2, 1),
      item("b", 4, 4, 1, 1),
      item("c", 2, 1, 1, 3),
      item("d", 5, 0, 1, 1),
      item("e", 0, 6, 3, 1),
    ];
    const reference = order(items);
    for (const permutation of [
      [...items].reverse(),
      [items[2], items[4], items[0], items[3], items[1]],
    ]) {
      const result = order(permutation);
      // Toute paire ordonnée par la relation "derrière" doit être respectée
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const a = items.find((it) => it.id === result[i])!;
          const b = items.find((it) => it.id === result[j])!;
          const aBehind = isBehind(a.footprint, b.footprint);
          const bBehind = isBehind(b.footprint, a.footprint);
          expect(bBehind && !aBehind).toBe(false);
        }
      }
      expect(result).toHaveLength(reference.length);
    }
  });
});
