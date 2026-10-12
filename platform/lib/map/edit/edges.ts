// Murs, cloisons vitrées et portes posés sur les arêtes de tuiles.
import { CATALOG, getFootprint } from "../catalog";
import type { Edge, Layout } from "../schema";
import { buildZoneLookup } from "../zones";

export type EdgeTool = "solid" | "glass" | "door" | "none";
export type EdgeProblem =
  "edge_out_of_bounds" | "edge_outside_zone" | "door_blocked";
export type EdgeResult =
  { ok: true; layout: Layout } | { ok: false; problem: EdgeProblem };

export const edgeKey = (edge: Pick<Edge, "x" | "y" | "side">) =>
  `${edge.side}:${edge.x}:${edge.y}`;

export function edgeInBounds(
  layout: Layout,
  edge: Pick<Edge, "x" | "y" | "side">,
): boolean {
  return edge.side === "N"
    ? edge.x >= 0 &&
        edge.x < layout.width &&
        edge.y >= 0 &&
        edge.y <= layout.height
    : edge.x >= 0 &&
        edge.x <= layout.width &&
        edge.y >= 0 &&
        edge.y < layout.height;
}

/** Les deux tuiles de part et d'autre d'une arête (hors carte = null). */
export function tilesAroundEdge(
  layout: Layout,
  edge: Pick<Edge, "x" | "y" | "side">,
): [{ x: number; y: number } | null, { x: number; y: number } | null] {
  const a =
    edge.side === "N"
      ? { x: edge.x, y: edge.y - 1 }
      : { x: edge.x - 1, y: edge.y };
  const b = { x: edge.x, y: edge.y };
  const inside = (tile: { x: number; y: number }) =>
    tile.x >= 0 &&
    tile.y >= 0 &&
    tile.x < layout.width &&
    tile.y < layout.height
      ? tile
      : null;
  return [inside(a), inside(b)];
}

/** Arête la plus proche d'un point de la grille (coordonnées fractionnaires), dans une tolérance. */
export function edgeAtPoint(
  gx: number,
  gy: number,
  tolerance = 0.3,
): Pick<Edge, "x" | "y" | "side"> | null {
  const nearestY = Math.round(gy);
  const nearestX = Math.round(gx);
  const distN = Math.abs(gy - nearestY);
  const distW = Math.abs(gx - nearestX);
  const candidates: Array<{
    dist: number;
    edge: Pick<Edge, "x" | "y" | "side">;
  }> = [];
  if (distN <= tolerance)
    candidates.push({
      dist: distN,
      edge: { x: Math.floor(gx), y: nearestY, side: "N" },
    });
  if (distW <= tolerance)
    candidates.push({
      dist: distW,
      edge: { x: nearestX, y: Math.floor(gy), side: "W" },
    });
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0]?.edge ?? null;
}

function occupiedTiles(layout: Layout): Set<string> {
  const occupied = new Set<string>();
  for (const element of layout.elements) {
    const entry = CATALOG[element.catalogKey];
    if (!entry) continue;
    const { w, h } = getFootprint(entry, element.rotation);
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        occupied.add(`${element.x + dx}:${element.y + dy}`);
  }
  return occupied;
}

/**
 * Pose un mur plein, une cloison vitrée ou une porte sur une arête, ou la vide (`none`).
 * Une porte doit border une pièce et ses deux tuiles voisines doivent être libres de mobilier.
 */
export function setEdge(
  layout: Layout,
  edge: Pick<Edge, "x" | "y" | "side">,
  tool: EdgeTool,
): EdgeResult {
  if (!edgeInBounds(layout, edge))
    return { ok: false, problem: "edge_out_of_bounds" };
  const key = edgeKey(edge);
  const walls = layout.walls.filter((wall) => edgeKey(wall) !== key);
  const doors = layout.doors.filter((door) => edgeKey(door) !== key);
  const base = { x: edge.x, y: edge.y, side: edge.side };

  if (tool === "none") return { ok: true, layout: { ...layout, walls, doors } };

  const lookup = buildZoneLookup(layout);
  const [first, second] = tilesAroundEdge(layout, edge);
  const touchesZone = [first, second].some(
    (tile) => tile && lookup[tile.y * layout.width + tile.x] >= 0,
  );
  if (!touchesZone) return { ok: false, problem: "edge_outside_zone" };

  if (tool === "door") {
    const occupied = occupiedTiles(layout);
    if (
      [first, second].some(
        (tile) => tile && occupied.has(`${tile.x}:${tile.y}`),
      )
    ) {
      return { ok: false, problem: "door_blocked" };
    }
    return { ok: true, layout: { ...layout, walls, doors: [...doors, base] } };
  }
  const wall = tool === "glass" ? { ...base, kind: "glass" as const } : base;
  return { ok: true, layout: { ...layout, walls: [...walls, wall], doors } };
}

/** Nature actuelle d'une arête. */
export function edgeState(
  layout: Layout,
  edge: Pick<Edge, "x" | "y" | "side">,
): "solid" | "glass" | "door" | "none" {
  const key = edgeKey(edge);
  if (layout.doors.some((door) => edgeKey(door) === key)) return "door";
  const wall = layout.walls.find((candidate) => edgeKey(candidate) === key);
  if (!wall) return "none";
  return wall.kind === "glass" ? "glass" : "solid";
}
