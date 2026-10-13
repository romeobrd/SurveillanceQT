// Recherches dans une carte pour la sélection à la souris.
import { CATALOG, getFootprint } from "../catalog";
import type { Layout, MapElement } from "../schema";
import { buildZoneLookup } from "../zones";

/** Élément qui occupe la tuile donnée (le dernier posé l'emporte en cas de doute). */
export function elementAtTile(
  layout: Layout,
  x: number,
  y: number,
): MapElement | null {
  for (let index = layout.elements.length - 1; index >= 0; index--) {
    const element = layout.elements[index];
    const entry = CATALOG[element.catalogKey];
    if (!entry) continue;
    const { w, h } = getFootprint(entry, element.rotation);
    if (
      x >= element.x &&
      y >= element.y &&
      x < element.x + w &&
      y < element.y + h
    )
      return element;
  }
  return null;
}

/** Éléments dont l'emprise touche le rectangle (tuiles, bornes incluses). */
export function elementsInRect(
  layout: Layout,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): MapElement[] {
  const [minX, maxX] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [minY, maxY] = [Math.min(y0, y1), Math.max(y0, y1)];
  return layout.elements.filter((element) => {
    const entry = CATALOG[element.catalogKey];
    if (!entry) return false;
    const { w, h } = getFootprint(entry, element.rotation);
    return (
      element.x <= maxX &&
      element.x + w - 1 >= minX &&
      element.y <= maxY &&
      element.y + h - 1 >= minY
    );
  });
}

export function zoneAtTile(
  layout: Layout,
  x: number,
  y: number,
): string | null {
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return null;
  const index = buildZoneLookup(layout)[y * layout.width + x];
  return index >= 0 ? layout.zones[index].id : null;
}
