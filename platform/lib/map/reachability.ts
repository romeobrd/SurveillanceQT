// Contrôle d'accessibilité : toutes les tuiles libres doivent être atteignables depuis l'entrée.
import { canCross, createGrid, floodFill } from "./grid";
import type { Layout } from "./schema";

/** Tuiles intérieures situées derrière une porte donnant sur l'extérieur. */
export function getEntranceTiles(
  layout: Layout,
): Array<{ x: number; y: number }> {
  const { width, height } = layout;
  const tiles: Array<{ x: number; y: number }> = [];
  for (const door of layout.doors) {
    if (door.side === "N" && door.y === 0) tiles.push({ x: door.x, y: 0 });
    else if (door.side === "N" && door.y === height)
      tiles.push({ x: door.x, y: height - 1 });
    else if (door.side === "W" && door.x === 0) tiles.push({ x: 0, y: door.y });
    else if (door.side === "W" && door.x === width)
      tiles.push({ x: width - 1, y: door.y });
  }
  return tiles;
}

/** Liste les tuiles libres que l'on ne peut pas atteindre depuis l'entrée. */
export function findUnreachableTiles(
  layout: Layout,
): Array<{ x: number; y: number }> {
  const grid = createGrid(layout);
  const { visited } = floodFill(grid, getEntranceTiles(layout));
  const unreachable: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const index = y * layout.width + x;
      if (!grid.occupied[index] && !visited[index]) unreachable.push({ x, y });
    }
  }
  return unreachable;
}

/** Vrai si chaque zone possède au moins une tuile libre atteignable depuis l'entrée. */
export function areAllZonesAccessible(layout: Layout): boolean {
  const grid = createGrid(layout);
  const { visited } = floodFill(grid, getEntranceTiles(layout));
  return layout.zones.every((zone) =>
    zone.rects.some((rect) => {
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
          if (visited[y * layout.width + x]) return true;
        }
      }
      return false;
    }),
  );
}

/** Une alcôve fermée plus petite que ça (meuble déplacé hors d'un recoin, par exemple) est inoffensive. */
export const MAX_ENCLOSED_POCKET = 8;

/**
 * Tailles des zones libres isolées de l'entrée (composantes connexes de tuiles libres inatteignables,
 * en tenant compte des murs). Sert à distinguer une alcôve fermée d'une partie de pièce coupée du reste.
 */
export function findUnreachableComponents(layout: Layout): number[] {
  const grid = createGrid(layout);
  const { visited } = floodFill(grid, getEntranceTiles(layout));
  const { width, height } = layout;
  const seen = new Uint8Array(width * height);
  const sizes: number[] = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let start = 0; start < width * height; start++) {
    if (visited[start] || seen[start] || grid.occupied[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let size = 0;
    while (queue.length > 0) {
      const index = queue.pop() as number;
      size++;
      const x = index % width;
      const y = (index - x) / width;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (
          seen[next] ||
          visited[next] ||
          grid.occupied[next] ||
          !canCross(grid, x, y, dx, dy)
        )
          continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes;
}
