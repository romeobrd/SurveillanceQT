import { describe, expect, it } from "vitest";
import { LayoutSchema } from "./schema";

const minimal = {
  version: 1,
  width: 20,
  height: 20,
  zones: [],
  walls: [],
  doors: [],
  elements: [],
};

describe("schéma de carte", () => {
  it("accepte une carte minimale", () => {
    expect(LayoutSchema.safeParse(minimal).success).toBe(true);
  });

  it("refuse une version inconnue", () => {
    expect(LayoutSchema.safeParse({ ...minimal, version: 2 }).success).toBe(
      false,
    );
  });

  it("refuse une rotation invalide", () => {
    const element = {
      id: "e1",
      catalogKey: "chaise",
      x: 0,
      y: 0,
      rotation: 45,
      zoneId: "z1",
    };
    expect(
      LayoutSchema.safeParse({ ...minimal, elements: [element] }).success,
    ).toBe(false);
  });
});
