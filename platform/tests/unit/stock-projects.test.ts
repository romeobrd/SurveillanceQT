import { describe, expect, it } from "vitest";
import {
  computeProgress,
  computeProjectState,
  swapTarget,
} from "@/features/projects/progress";
import {
  computeQuantity,
  isBelowThreshold,
  isValidMovement,
  movementDelta,
} from "@/features/stock/quantity";
import { AssetQuerySchema } from "@/features/assets/schemas";
import { PeopleQuerySchema } from "@/features/people/schemas";
import { StockQuerySchema } from "@/features/stock/schemas";
import { firstValues } from "@/features/list-query";

describe("quantité de stock", () => {
  it("additionne les entrées, retranche les sorties et applique les ajustements signés", () => {
    expect(
      computeQuantity([
        { type: "IN", quantity: 20 },
        { type: "OUT", quantity: 5 },
        { type: "ADJUSTMENT", quantity: -3 },
        { type: "ADJUSTMENT", quantity: 2 },
      ]),
    ).toBe(14);
    expect(computeQuantity([])).toBe(0);
  });

  it("calcule l'effet de chaque type de mouvement", () => {
    expect(movementDelta("IN", 4)).toBe(4);
    expect(movementDelta("OUT", 4)).toBe(-4);
    expect(movementDelta("ADJUSTMENT", -4)).toBe(-4);
  });

  it("alerte strictement sous le seuil, jamais avec un seuil à 0", () => {
    expect(isBelowThreshold(4, 5)).toBe(true);
    expect(isBelowThreshold(5, 5)).toBe(false);
    expect(isBelowThreshold(0, 0)).toBe(false);
  });

  it("valide les mouvements", () => {
    expect(isValidMovement("IN", 3)).toBe(true);
    expect(isValidMovement("IN", 0)).toBe(false);
    expect(isValidMovement("OUT", -1)).toBe(false);
    expect(isValidMovement("ADJUSTMENT", -2)).toBe(true);
    expect(isValidMovement("ADJUSTMENT", 0)).toBe(false);
    expect(isValidMovement("IN", 1.5)).toBe(false);
  });
});

describe("projets", () => {
  const steps = (...statuses: Array<"TODO" | "IN_PROGRESS" | "DONE">) =>
    statuses.map((status) => ({ status }));

  it("calcule la progression à partir des étapes terminées", () => {
    expect(computeProgress([])).toBe(0);
    expect(computeProgress(steps("TODO", "TODO"))).toBe(0);
    expect(computeProgress(steps("DONE", "IN_PROGRESS", "TODO"))).toBe(33);
    expect(computeProgress(steps("DONE", "DONE", "TODO"))).toBe(67);
    expect(computeProgress(steps("DONE", "DONE"))).toBe(100);
  });

  it("déduit l'état du projet", () => {
    expect(computeProjectState([])).toBe("NOT_STARTED");
    expect(computeProjectState(steps("TODO"))).toBe("NOT_STARTED");
    expect(computeProjectState(steps("DONE", "TODO"))).toBe("IN_PROGRESS");
    expect(computeProjectState(steps("IN_PROGRESS"))).toBe("IN_PROGRESS");
    expect(computeProjectState(steps("DONE", "DONE"))).toBe("DONE");
  });

  it("trouve l'étape voisine pour un déplacement", () => {
    const list = [
      { id: "a", order: 1 },
      { id: "b", order: 5 },
      { id: "c", order: 9 },
    ];
    expect(swapTarget(list, "b", "up")?.id).toBe("a");
    expect(swapTarget(list, "b", "down")?.id).toBe("c");
    expect(swapTarget(list, "a", "up")).toBeNull();
    expect(swapTarget(list, "c", "down")).toBeNull();
    expect(swapTarget(list, "inconnue", "up")).toBeNull();
  });
});

describe("paramètres de liste", () => {
  it("applique des valeurs par défaut sûres quand l'URL est invalide", () => {
    expect(
      PeopleQuerySchema.parse({
        status: "nimporte",
        sort: "mot-de-passe",
        dir: "x",
      }),
    ).toEqual({
      search: undefined,
      teamId: undefined,
      status: "ACTIVE",
      sort: "lastName",
      dir: "asc",
    });
    expect(StockQuerySchema.parse({ alert: "?", sort: "zzz" })).toMatchObject({
      alert: "all",
      sort: "name",
    });
    expect(AssetQuerySchema.parse({ state: "CASSE" })).toMatchObject({
      state: "ALL",
      sort: "type",
    });
  });

  it("conserve les valeurs valides et limite la longueur de la recherche", () => {
    expect(
      PeopleQuerySchema.parse({
        status: "DEPARTED",
        sort: "jobTitle",
        dir: "desc",
        search: " dupont ",
      }),
    ).toMatchObject({
      status: "DEPARTED",
      sort: "jobTitle",
      dir: "desc",
      search: "dupont",
    });
    expect(
      PeopleQuerySchema.parse({ search: "x".repeat(500) }).search,
    ).toBeUndefined();
  });

  it("garde la première valeur d'un paramètre répété", () => {
    expect(firstValues({ a: ["1", "2"], b: "3", c: undefined })).toEqual({
      a: "1",
      b: "3",
      c: undefined,
    });
  });
});
