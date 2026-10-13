// Générateur pseudo-aléatoire déterministe (mulberry32) : même seed = même séquence.

export interface Rng {
  /** Flottant dans [0, 1). */
  next(): number;
  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number;
  /** Vrai avec la probabilité p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Retourne une copie mélangée (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
