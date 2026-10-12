// Tuile où s'assoit l'occupant d'un poste : la chaise adjacente, sinon une tuile libre voisine.
import { CATALOG, getFootprint } from "./catalog";
import type { Layout, MapElement } from "./schema";

export function findSeatTile(
  layout: Layout,
  workstation: MapElement,
): { x: number; y: number } | null {
  const entry = CATALOG[workstation.catalogKey];
  if (!entry) return null;
  const { w, h } = getFootprint(entry, workstation.rotation);
  const around: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < w; dx++)
    around.push({ x: workstation.x + dx, y: workstation.y + h });
  for (let dx = 0; dx < w; dx++)
    around.push({ x: workstation.x + dx, y: workstation.y - 1 });
  for (let dy = 0; dy < h; dy++)
    around.push({ x: workstation.x + w, y: workstation.y + dy });
  for (let dy = 0; dy < h; dy++)
    around.push({ x: workstation.x - 1, y: workstation.y + dy });

  const chairAt = (tile: { x: number; y: number }) =>
    layout.elements.some(
      (e) => e.catalogKey === "chaise" && e.x === tile.x && e.y === tile.y,
    );
  const chair = around.find(chairAt);
  if (chair) return chair;

  const occupied = new Set<string>();
  for (const element of layout.elements) {
    const other = CATALOG[element.catalogKey];
    if (!other) continue;
    const fp = getFootprint(other, element.rotation);
    for (let dy = 0; dy < fp.h; dy++) {
      for (let dx = 0; dx < fp.w; dx++)
        occupied.add(`${element.x + dx}:${element.y + dy}`);
    }
  }
  const zone = layout.zones.find((z) => z.id === workstation.zoneId);
  const inZone = (tile: { x: number; y: number }) =>
    zone?.rects.some(
      (r) =>
        tile.x >= r.x &&
        tile.y >= r.y &&
        tile.x < r.x + r.w &&
        tile.y < r.y + r.h,
    ) ?? false;
  return (
    around.find(
      (tile) => inZone(tile) && !occupied.has(`${tile.x}:${tile.y}`),
    ) ?? null
  );
}
