// Validité d'un placement : dans la carte, dans une seule pièce, sans collision, sans bloquer un passage.
import { CATALOG, getFootprint } from "../catalog";
import { buildDoorKeepFree, createGrid, floodFill } from "../grid";
import { getEntranceTiles } from "../reachability";
import type { Layout, MapElement, Rotation } from "../schema";
import { buildZoneLookup } from "../zones";

export type PlacementProblem =
  | "out_of_bounds"
  | "outside_zone"
  | "collision"
  | "near_door"
  | "blocks_path"
  | "unknown_element";

export interface PlacementSpec {
  catalogKey: string;
  x: number;
  y: number;
  rotation: Rotation;
}

const GHOST_ID = "__ghost__";

/**
 * Évalue les éléments `subjectIds` d'une carte modifiée (`after`) par rapport à l'originale (`before`).
 * Retourne un problème par élément refusé. « Bloque un passage » signifie qu'une tuile libre qui était
 * atteignable depuis l'entrée ne l'est plus (un défaut déjà présent avant la modification n'est pas reproché).
 */
export function evaluateChange(
  before: Layout,
  after: Layout,
  subjectIds: readonly string[],
): Map<string, PlacementProblem> {
  const problems = new Map<string, PlacementProblem>();
  const subjects = new Set(subjectIds);
  const { width, height } = after;
  const zoneLookup = buildZoneLookup(after);
  const keepFree = buildDoorKeepFree(after);

  // Propriétaire de chaque tuile (index d'élément) pour détecter les collisions
  const owner = new Int32Array(width * height).fill(-1);
  const overlapping = new Set<number>();
  after.elements.forEach((element, index) => {
    const entry = CATALOG[element.catalogKey];
    if (!entry) return;
    const { w, h } = getFootprint(entry, element.rotation);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const x = element.x + dx;
        const y = element.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const tile = y * width + x;
        if (owner[tile] >= 0 && owner[tile] !== index) {
          overlapping.add(owner[tile]);
          overlapping.add(index);
        }
        owner[tile] = index;
      }
    }
  });

  after.elements.forEach((element, index) => {
    if (!subjects.has(element.id)) return;
    const entry = CATALOG[element.catalogKey];
    if (!entry || entry.category === "structure") {
      problems.set(element.id, "unknown_element");
      return;
    }
    const { w, h } = getFootprint(entry, element.rotation);
    if (
      element.x < 0 ||
      element.y < 0 ||
      element.x + w > width ||
      element.y + h > height
    ) {
      problems.set(element.id, "out_of_bounds");
      return;
    }
    const firstZone = zoneLookup[element.y * width + element.x];
    let sameZone = firstZone >= 0;
    let nearDoor = false;
    for (let dy = 0; dy < h && sameZone; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = (element.y + dy) * width + element.x + dx;
        if (zoneLookup[tile] !== firstZone) sameZone = false;
        if (keepFree[tile]) nearDoor = true;
      }
    }
    if (!sameZone) problems.set(element.id, "outside_zone");
    else if (overlapping.has(index)) problems.set(element.id, "collision");
    else if (nearDoor) problems.set(element.id, "near_door");
  });

  // Passages : aucune tuile atteignable avant ne doit devenir inatteignable
  const gridBefore = createGrid(before);
  const reachedBefore = floodFill(gridBefore, getEntranceTiles(before)).visited;
  const gridAfter = createGrid(after);
  const reachedAfter = floodFill(gridAfter, getEntranceTiles(after)).visited;
  let blocked = false;
  for (let tile = 0; tile < reachedBefore.length && !blocked; tile++) {
    if (reachedBefore[tile] && !gridAfter.occupied[tile] && !reachedAfter[tile])
      blocked = true;
  }
  if (blocked) {
    for (const id of subjectIds)
      if (!problems.has(id)) problems.set(id, "blocks_path");
  }
  return problems;
}

/** Zone (identifiant) qui contient entièrement l'emprise donnée, ou null. */
export function zoneIdForFootprint(
  layout: Layout,
  x: number,
  y: number,
  w: number,
  h: number,
): string | null {
  if (x < 0 || y < 0 || x + w > layout.width || y + h > layout.height)
    return null;
  const lookup = buildZoneLookup(layout);
  const first = lookup[y * layout.width + x];
  if (first < 0) return null;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (lookup[(y + dy) * layout.width + x + dx] !== first) return null;
    }
  }
  return layout.zones[first].id;
}

/** Vérifie le placement d'un nouvel élément (aperçu fantôme vert ou rouge). */
export function checkPlacement(
  layout: Layout,
  spec: PlacementSpec,
): PlacementProblem | null {
  const entry = CATALOG[spec.catalogKey];
  if (!entry || entry.category === "structure") return "unknown_element";
  const { w, h } = getFootprint(entry, spec.rotation);
  const ghost: MapElement = {
    id: GHOST_ID,
    catalogKey: spec.catalogKey,
    x: spec.x,
    y: spec.y,
    rotation: spec.rotation,
    zoneId: zoneIdForFootprint(layout, spec.x, spec.y, w, h) ?? "",
  };
  const candidate: Layout = {
    ...layout,
    elements: [...layout.elements, ghost],
  };
  return evaluateChange(layout, candidate, [GHOST_ID]).get(GHOST_ID) ?? null;
}
