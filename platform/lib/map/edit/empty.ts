// Locaux vides : un seul espace ouvert couvrant tout le plan, murs de contour, une porte d'entrée au sud.
import { rectBoundaryEdges } from "../bsp";
import { MAP_FORMAT_VERSION, type Edge, type Layout } from "../schema";
import { ZONE_FLOOR_COLORS, ZONE_LABELS } from "../zoneTypes";
import { randomId, type IdFactory } from "./ids";

export const MIN_EMPTY_SIZE = 10;
export const MAX_EMPTY_SIZE = 60;

export function createEmptyLayout(
  width: number,
  height: number,
  ids: IdFactory = randomId,
): Layout {
  for (const size of [width, height]) {
    if (
      !Number.isInteger(size) ||
      size < MIN_EMPTY_SIZE ||
      size > MAX_EMPTY_SIZE
    ) {
      throw new RangeError(
        `Taille invalide (${MIN_EMPTY_SIZE} à ${MAX_EMPTY_SIZE} tuiles par côté)`,
      );
    }
  }
  const entrance: Edge = { x: Math.floor(width / 2), y: height, side: "N" };
  const walls = rectBoundaryEdges({ x: 0, y: 0, w: width, h: height }).filter(
    (edge) =>
      !(
        edge.side === entrance.side &&
        edge.x === entrance.x &&
        edge.y === entrance.y
      ),
  );
  return {
    version: MAP_FORMAT_VERSION,
    width,
    height,
    zones: [
      {
        id: ids("z"),
        name: `${ZONE_LABELS.open_space} 1`,
        type: "open_space",
        rects: [{ x: 0, y: 0, w: width, h: height }],
        floorColor: ZONE_FLOOR_COLORS.open_space,
      },
    ],
    walls,
    doors: [entrance],
    elements: [],
  };
}
