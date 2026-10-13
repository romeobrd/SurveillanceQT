// Validation de cohérence d'une carte, au-delà du schéma zod (collisions, appartenance aux zones…).
import { CATALOG, getFootprint, type CatalogEntry } from "./catalog";
import type { Edge, Layout } from "./schema";

const edgeKey = (edge: Edge) => `${edge.side}:${edge.x}:${edge.y}`;

function edgeInBounds(edge: Edge, layout: Layout): boolean {
  return edge.side === "N"
    ? edge.x < layout.width && edge.y <= layout.height
    : edge.x <= layout.width && edge.y < layout.height;
}

/** Retourne la liste des problèmes détectés (vide si la carte est cohérente). */
export function validateLayout(
  layout: Layout,
  catalog: Readonly<Record<string, CatalogEntry>> = CATALOG,
): string[] {
  const problems: string[] = [];

  const zoneOwner = new Map<number, string>();
  const zoneRects = new Map<string, Layout["zones"][number]["rects"]>();
  for (const zone of layout.zones) {
    if (zoneRects.has(zone.id)) problems.push(`zone en double : ${zone.id}`);
    zoneRects.set(zone.id, zone.rects);
    for (const rect of zone.rects) {
      if (rect.x + rect.w > layout.width || rect.y + rect.h > layout.height) {
        problems.push(`zone hors carte : ${zone.id}`);
        continue;
      }
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
          const index = y * layout.width + x;
          if (zoneOwner.has(index))
            problems.push(`zones qui se chevauchent en (${x}, ${y})`);
          zoneOwner.set(index, zone.id);
        }
      }
    }
  }

  const wallKeys = new Set<string>();
  for (const wall of layout.walls) {
    if (!edgeInBounds(wall, layout))
      problems.push(`mur hors carte : ${edgeKey(wall)}`);
    if (wallKeys.has(edgeKey(wall)))
      problems.push(`mur en double : ${edgeKey(wall)}`);
    wallKeys.add(edgeKey(wall));
  }
  const doorKeys = new Set<string>();
  for (const door of layout.doors) {
    if (!edgeInBounds(door, layout))
      problems.push(`porte hors carte : ${edgeKey(door)}`);
    if (doorKeys.has(edgeKey(door)))
      problems.push(`porte en double : ${edgeKey(door)}`);
    if (wallKeys.has(edgeKey(door)))
      problems.push(`porte et mur sur la même arête : ${edgeKey(door)}`);
    doorKeys.add(edgeKey(door));
  }

  const occupied = new Set<number>();
  const elementIds = new Set<string>();
  for (const element of layout.elements) {
    if (elementIds.has(element.id))
      problems.push(`élément en double : ${element.id}`);
    elementIds.add(element.id);
    const entry = catalog[element.catalogKey];
    if (!entry) {
      problems.push(`élément inconnu du catalogue : ${element.catalogKey}`);
      continue;
    }
    if (entry.category === "structure") {
      problems.push(
        `élément de structure placé comme mobilier : ${element.catalogKey}`,
      );
      continue;
    }
    const rects = zoneRects.get(element.zoneId);
    if (!rects) {
      problems.push(
        `zone inconnue pour l'élément ${element.id} : ${element.zoneId}`,
      );
      continue;
    }
    const { w, h } = getFootprint(entry, element.rotation);
    const insideZone = rects.some(
      (r) =>
        element.x >= r.x &&
        element.y >= r.y &&
        element.x + w <= r.x + r.w &&
        element.y + h <= r.y + r.h,
    );
    if (!insideZone) problems.push(`élément ${element.id} hors de sa zone`);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const index = (element.y + dy) * layout.width + element.x + dx;
        if (occupied.has(index))
          problems.push(`collision de l'élément ${element.id}`);
        occupied.add(index);
      }
    }
  }
  return problems;
}
