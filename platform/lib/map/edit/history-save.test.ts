import { describe, expect, it } from "vitest";
import { generateLayout } from "../generator";
import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  pushHistory,
  redo,
  undo,
} from "./history";
import { createEmptyLayout } from "./empty";
import { sequentialIds } from "./ids";
import { elementAtTile, elementsInRect, zoneAtTile } from "./queries";
import { computeRemovals, validateForSave } from "./save";
import { removeElements } from "./operations";
import type { Layout } from "../schema";

describe("historique annuler / rétablir", () => {
  it("annule et rétablit dans l'ordre", () => {
    let h = createHistory(0);
    expect([canUndo(h), canRedo(h)]).toEqual([false, false]);
    h = pushHistory(h, 1);
    h = pushHistory(h, 2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = undo(h);
    h = undo(h); // déjà au début : sans effet
    expect(h.present).toBe(0);
    h = redo(h);
    h = redo(h);
    h = redo(h); // déjà à la fin : sans effet
    expect(h.present).toBe(2);
  });

  it("efface la branche « rétablir » après une nouvelle action", () => {
    let h = pushHistory(pushHistory(createHistory("a"), "b"), "c");
    h = undo(h);
    h = pushHistory(h, "d");
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe("d");
    expect(undo(h).present).toBe("b");
  });

  it("ignore un état identique et borne la taille", () => {
    const h = createHistory({ n: 0 });
    expect(pushHistory(h, h.present)).toBe(h);
    let long = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) long = pushHistory(long, i);
    expect(long.past).toHaveLength(HISTORY_LIMIT);
    expect(long.present).toBe(HISTORY_LIMIT + 50);
  });
});

describe("recherches", () => {
  const layout = generateLayout(5);
  it("retrouve l'élément et la pièce sous une tuile", () => {
    const element = layout.elements[0];
    expect(elementAtTile(layout, element.x, element.y)?.id).toBe(element.id);
    expect(zoneAtTile(layout, element.x, element.y)).toBe(element.zoneId);
    expect(zoneAtTile(layout, -1, 0)).toBeNull();
    expect(elementAtTile(createEmptyLayout(10, 10), 3, 3)).toBeNull();
  });

  it("sélectionne par rectangle", () => {
    const found = elementsInRect(layout, 0, 0, layout.width, layout.height);
    expect(found).toHaveLength(layout.elements.length);
    expect(elementsInRect(layout, -5, -5, -1, -1)).toHaveLength(0);
  });
});

describe("contrôle avant enregistrement", () => {
  it("signale l'absence de zone et d'entrée", () => {
    const base = createEmptyLayout(10, 10, sequentialIds());
    expect(
      validateForSave({ ...base, zones: [], elements: [] }).map((p) => p.code),
    ).toContain("no_zone");
    expect(
      validateForSave({ ...base, doors: [] }).map((p) => p.code),
    ).toContain("no_entrance");
  });

  it("signale un élément posé devant une porte et une carte incohérente", () => {
    const base = createEmptyLayout(10, 10, sequentialIds());
    const blocking: Layout = {
      ...base,
      elements: [
        {
          id: "e1",
          catalogKey: "plante",
          x: 5,
          y: 9,
          rotation: 0,
          zoneId: base.zones[0].id,
        },
      ],
    };
    expect(validateForSave(blocking).map((p) => p.code)).toContain("near_door");
    const dup: Layout = {
      ...base,
      elements: [
        { ...blocking.elements[0], x: 1, y: 1 },
        { ...blocking.elements[0], x: 1, y: 1, id: "e2" },
      ],
    };
    expect(validateForSave(dup).map((p) => p.code)).toContain("invalid");
  });

  it("refuse une carte démesurée", () => {
    const base = createEmptyLayout(10, 10);
    const huge: Layout = {
      ...base,
      walls: Array.from({ length: 25_000 }, (_, i) => ({
        x: i % 10,
        y: 0,
        side: "N" as const,
      })),
    };
    expect(validateForSave(huge)).toEqual([{ code: "too_large" }]);
  });

  it("calcule les zones et postes supprimés entre deux versions", () => {
    const previous = generateLayout(11);
    expect(computeRemovals(previous, previous)).toEqual({
      removedZoneKeys: [],
      removedWorkstationKeys: [],
    });
    const station = previous.elements.find((e) =>
      ["bureau_simple", "bureau_double", "ilot_4", "poste_debout"].includes(
        e.catalogKey,
      ),
    )!;
    const chair = previous.elements.find((e) => e.catalogKey === "chaise")!;
    const next = removeElements(previous, [station.id, chair.id]);
    expect(computeRemovals(previous, next).removedWorkstationKeys).toEqual([
      station.id,
    ]); // une chaise n'est pas un poste
    const zone = previous.zones[0];
    const without: Layout = {
      ...next,
      zones: next.zones.filter((z) => z.id !== zone.id),
    };
    expect(computeRemovals(previous, without).removedZoneKeys).toEqual([
      zone.id,
    ]);
  });
});
