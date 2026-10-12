// Grille d'occupation : murs sur arêtes, tuiles occupées, déplacement entre tuiles.
import { CATALOG, getFootprint, type CatalogEntry } from "./catalog";
import type { Layout } from "./schema";

export interface Grid {
  width: number;
  height: number;
  /** wallN[y * width + x] : mur au nord de la tuile (x, y), y ∈ [0, height]. */
  wallN: Uint8Array;
  /** wallW[y * (width + 1) + x] : mur à l'ouest de la tuile (x, y), x ∈ [0, width]. */
  wallW: Uint8Array;
  /** occupied[y * width + x] : 1 si un élément occupe la tuile. */
  occupied: Uint8Array;
}

export function createGrid(
  layout: Layout,
  catalog: Readonly<Record<string, CatalogEntry>> = CATALOG,
): Grid {
  const { width, height } = layout;
  const grid: Grid = {
    width,
    height,
    wallN: new Uint8Array(width * (height + 1)),
    wallW: new Uint8Array((width + 1) * height),
    occupied: new Uint8Array(width * height),
  };
  for (const wall of layout.walls) {
    if (wall.side === "N") {
      if (wall.x < width && wall.y <= height)
        grid.wallN[wall.y * width + wall.x] = 1;
    } else if (wall.x <= width && wall.y < height) {
      grid.wallW[wall.y * (width + 1) + wall.x] = 1;
    }
  }
  for (const element of layout.elements) {
    const entry = catalog[element.catalogKey];
    if (!entry) continue;
    const { w, h } = getFootprint(entry, element.rotation);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const x = element.x + dx;
        const y = element.y + dy;
        if (x < width && y < height) grid.occupied[y * width + x] = 1;
      }
    }
  }
  return grid;
}

/** Vrai si on peut passer de (x, y) à la tuile voisine, murs seulement (pas le mobilier). */
export function canCross(
  grid: Grid,
  x: number,
  y: number,
  dx: number,
  dy: number,
): boolean {
  if (dx === 1) return !grid.wallW[y * (grid.width + 1) + x + 1];
  if (dx === -1) return !grid.wallW[y * (grid.width + 1) + x];
  if (dy === 1) return !grid.wallN[(y + 1) * grid.width + x];
  return !grid.wallN[y * grid.width + x];
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Parcours en largeur depuis les tuiles de départ, en évitant murs et tuiles occupées.
 * Retourne le masque des tuiles atteintes et leur nombre.
 */
export function floodFill(
  grid: Grid,
  starts: ReadonlyArray<{ x: number; y: number }>,
): { visited: Uint8Array; count: number } {
  const { width, height } = grid;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (const start of starts) {
    const index = start.y * width + start.x;
    if (!grid.occupied[index] && !visited[index]) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = (index - x) / width;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (visited[next] || grid.occupied[next] || !canCross(grid, x, y, dx, dy))
        continue;
      visited[next] = 1;
      queue[tail++] = next;
    }
  }
  return { visited, count: tail };
}
