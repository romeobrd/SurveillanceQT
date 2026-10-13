// Édition des pièces : tracer, redimensionner, typer, renommer, supprimer. Les murs de contour suivent.
import { rectBoundaryEdges } from "../bsp";
import { CATALOG, getFootprint } from "../catalog";
import type { Edge, Layout, Rect, Zone, ZoneType } from "../schema";
import { ZONE_FLOOR_COLORS, ZONE_LABELS } from "../zoneTypes";
import { rectContainsTile, rectInside, rectsOverlap } from "./geometry";
import { randomId, type IdFactory } from "./ids";

export type ZoneProblem =
  | "zone_out_of_bounds"
  | "zone_overlap"
  | "zone_too_small"
  | "elements_outside"
  | "not_found"
  | "invalid_name"
  | "unsupported";

export type ZoneResult =
  | { ok: true; layout: Layout; id: string }
  | { ok: false; problem: ZoneProblem };

export const MIN_ZONE_SIZE = 2;
export const MAX_ZONE_NAME = 80;

const edgeKey = (edge: Edge) => `${edge.side}:${edge.x}:${edge.y}`;

function boundaries(layout: Layout): Map<string, Edge> {
  const map = new Map<string, Edge>();
  for (const zone of layout.zones) {
    for (const rect of zone.rects)
      for (const edge of rectBoundaryEdges(rect)) map.set(edgeKey(edge), edge);
  }
  return map;
}

/**
 * Met les murs en cohérence après une modification de pièces : les arêtes qui ne bordent plus aucune pièce
 * sont retirées (murs et portes), les nouvelles arêtes de contour reçoivent un mur plein.
 * Les cloisons posées à la main à l'intérieur d'une pièce ne sont jamais touchées.
 */
export function rebuildBoundaries(before: Layout, after: Layout): Layout {
  const oldKeys = boundaries(before);
  const newKeys = boundaries(after);
  const walls = after.walls.filter(
    (wall) => !(oldKeys.has(edgeKey(wall)) && !newKeys.has(edgeKey(wall))),
  );
  const doors = after.doors.filter(
    (door) => !(oldKeys.has(edgeKey(door)) && !newKeys.has(edgeKey(door))),
  );
  const taken = new Set([...walls, ...doors].map(edgeKey));
  for (const [key, edge] of newKeys) {
    if (!taken.has(key)) walls.push({ x: edge.x, y: edge.y, side: edge.side });
  }
  return { ...after, walls, doors };
}

function validRect(
  layout: Layout,
  rect: Rect,
  ignoreZoneId?: string,
): ZoneProblem | null {
  if (!Number.isInteger(rect.x + rect.y + rect.w + rect.h))
    return "zone_out_of_bounds";
  if (rect.w < MIN_ZONE_SIZE || rect.h < MIN_ZONE_SIZE) return "zone_too_small";
  if (!rectInside(rect, layout.width, layout.height))
    return "zone_out_of_bounds";
  const clash = layout.zones.some(
    (zone) =>
      zone.id !== ignoreZoneId &&
      zone.rects.some((other) => rectsOverlap(other, rect)),
  );
  return clash ? "zone_overlap" : null;
}

export function addZone(
  layout: Layout,
  rect: Rect,
  type: ZoneType,
  ids: IdFactory = randomId,
): ZoneResult {
  const problem = validRect(layout, rect);
  if (problem) return { ok: false, problem };
  const existing = new Set(layout.zones.map((zone) => zone.id));
  let id = ids("z");
  while (existing.has(id)) id = ids("z");
  const sameType = layout.zones.filter((zone) => zone.type === type).length;
  const zone: Zone = {
    id,
    name:
      type === "accueil" && sameType === 0
        ? ZONE_LABELS[type]
        : `${ZONE_LABELS[type]} ${sameType + 1}`,
    type,
    rects: [{ ...rect }],
    floorColor: ZONE_FLOOR_COLORS[type],
  };
  const next: Layout = { ...layout, zones: [...layout.zones, zone] };
  return { ok: true, layout: rebuildBoundaries(layout, next), id };
}

function findZone(layout: Layout, zoneId: string): Zone | null {
  return layout.zones.find((zone) => zone.id === zoneId) ?? null;
}

export function resizeZone(
  layout: Layout,
  zoneId: string,
  rect: Rect,
): ZoneResult {
  const zone = findZone(layout, zoneId);
  if (!zone) return { ok: false, problem: "not_found" };
  if (zone.rects.length !== 1) return { ok: false, problem: "unsupported" };
  const problem = validRect(layout, rect, zoneId);
  if (problem) return { ok: false, problem };
  // Les éléments de la pièce doivent rester entièrement dedans
  const outside = layout.elements.some((element) => {
    if (element.zoneId !== zoneId) return false;
    const { w, h } = getFootprint(
      CATALOG[element.catalogKey],
      element.rotation,
    );
    return !(
      rectContainsTile(rect, element.x, element.y) &&
      rectContainsTile(rect, element.x + w - 1, element.y + h - 1)
    );
  });
  if (outside) return { ok: false, problem: "elements_outside" };
  const next: Layout = {
    ...layout,
    zones: layout.zones.map((candidate) =>
      candidate.id === zoneId
        ? { ...candidate, rects: [{ ...rect }] }
        : candidate,
    ),
  };
  return { ok: true, layout: rebuildBoundaries(layout, next), id: zoneId };
}

export function setZoneType(
  layout: Layout,
  zoneId: string,
  type: ZoneType,
): ZoneResult {
  if (!findZone(layout, zoneId)) return { ok: false, problem: "not_found" };
  return {
    ok: true,
    id: zoneId,
    layout: {
      ...layout,
      zones: layout.zones.map((zone) =>
        zone.id === zoneId
          ? { ...zone, type, floorColor: ZONE_FLOOR_COLORS[type] }
          : zone,
      ),
    },
  };
}

export function renameZone(
  layout: Layout,
  zoneId: string,
  name: string,
): ZoneResult {
  const trimmed = name.trim();
  if (!findZone(layout, zoneId)) return { ok: false, problem: "not_found" };
  if (trimmed.length === 0 || trimmed.length > MAX_ZONE_NAME)
    return { ok: false, problem: "invalid_name" };
  return {
    ok: true,
    id: zoneId,
    layout: {
      ...layout,
      zones: layout.zones.map((zone) =>
        zone.id === zoneId ? { ...zone, name: trimmed } : zone,
      ),
    },
  };
}

/** Supprime la pièce, son mobilier et les murs qui ne bordent plus aucune pièce. */
export function removeZone(layout: Layout, zoneId: string): ZoneResult {
  if (!findZone(layout, zoneId)) return { ok: false, problem: "not_found" };
  const next: Layout = {
    ...layout,
    zones: layout.zones.filter((zone) => zone.id !== zoneId),
    elements: layout.elements.filter((element) => element.zoneId !== zoneId),
  };
  return { ok: true, layout: rebuildBoundaries(layout, next), id: zoneId };
}
