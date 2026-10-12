// Tri de profondeur isométrique pour des boîtes alignées sur la grille (y compris multi-tuiles).

/** Emprise sur la grille. w ou h peut valoir 0 (mur posé sur une arête). */
export interface Footprint {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DepthItem {
  footprint: Footprint;
  /** Départage deux objets de même emprise : le plus grand est dessiné en dernier. */
  layer: number;
}

/** Vrai si a est entièrement "derrière" b pour la caméra (a occulté par b). */
export function isBehind(a: Footprint, b: Footprint): boolean {
  return a.x + a.w <= b.x || a.y + a.h <= b.y;
}

function centerSum(f: Footprint): number {
  return f.x + f.w / 2 + f.y + f.h / 2;
}

/**
 * Trie du plus lointain au plus proche. Tri topologique sur la relation "derrière"
 * (une simple somme x+y est fausse pour les objets de plusieurs tuiles), avec un
 * repli sur la somme des centres si la relation n'est pas décisive.
 */
export function sortByDepth<T extends DepthItem>(items: readonly T[]): T[] {
  const n = items.length;
  const fallback = (i: number, j: number) =>
    centerSum(items[i].footprint) - centerSum(items[j].footprint) ||
    items[i].layer - items[j].layer ||
    i - j;

  const successors: number[][] = Array.from({ length: n }, () => []);
  const inDegree = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const iBehindJ = isBehind(items[i].footprint, items[j].footprint);
      const jBehindI = isBehind(items[j].footprint, items[i].footprint);
      if (iBehindJ === jBehindI) continue; // aucun ordre imposé, ou ambigu (pas de recouvrement écran)
      const [from, to] = iBehindJ ? [i, j] : [j, i];
      successors[from].push(to);
      inDegree[to]++;
    }
  }

  const ready = new Set<number>();
  for (let i = 0; i < n; i++) if (inDegree[i] === 0) ready.add(i);
  const sorted: T[] = [];
  const done = new Uint8Array(n);
  while (sorted.length < n) {
    if (ready.size === 0) {
      // Cycle (cas pathologique) : on libère l'élément le plus lointain restant
      let best = -1;
      for (let i = 0; i < n; i++)
        if (!done[i] && (best < 0 || fallback(i, best) < 0)) best = i;
      ready.add(best);
    }
    let next = -1;
    for (const candidate of ready)
      if (next < 0 || fallback(candidate, next) < 0) next = candidate;
    ready.delete(next);
    done[next] = 1;
    sorted.push(items[next]);
    for (const successor of successors[next]) {
      if (!done[successor] && --inDegree[successor] === 0) ready.add(successor);
    }
  }
  return sorted;
}
