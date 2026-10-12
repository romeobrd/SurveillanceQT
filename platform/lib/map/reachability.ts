// Contrôle d'accessibilité : toutes les tuiles libres doivent être atteignables depuis l'entrée.
import { createGrid, floodFill } from "./grid";
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
