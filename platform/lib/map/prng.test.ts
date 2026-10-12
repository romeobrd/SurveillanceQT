import { describe, expect, it } from "vitest";
import { createRng } from "./prng";

describe("prng", () => {
  it("produit la même séquence pour le même seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([
      b.next(),
      b.next(),
      b.next(),
    ]);
  });

  it("produit des séquences différentes pour des seeds différents", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("respecte les bornes de int", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(3, 5);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("mélange sans perdre d'éléments ni modifier l'original", () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = createRng(3).shuffle(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual(original);
  });
});
