// Recherche de zone par tuile.
import type { Layout } from "./schema";

/** Table tuile -> index de zone (-1 hors zone), indexée par y * width + x. */
export function buildZoneLookup(layout: Layout): Int16Array {
  const lookup = new Int16Array(layout.width * layout.height).fill(-1);
  layout.zones.forEach((zone, index) => {
    for (const rect of zone.rects) {
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++)
          lookup[y * layout.width + x] = index;
      }
    }
  });
  return lookup;
}

export function zoneIdAtTile(
  layout: Layout,
  lookup: Int16Array,
  x: number,
  y: number,
): string | null {
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return null;
  const index = lookup[y * layout.width + x];
  return index >= 0 ? layout.zones[index].id : null;
}
