// Partition récursive de l'espace (BSP) en pièces rectangulaires et recherche des murs partagés.
import type { Rng } from "./prng";
import type { Edge, Rect } from "./schema";

export interface PartitionOptions {
  minRoom: number;
  maxRoom: number;
}

export function partition(
  rng: Rng,
  root: Rect,
  options: PartitionOptions,
): Rect[] {
  const { minRoom, maxRoom } = options;
  const rooms: Rect[] = [];

  const split = (rect: Rect) => {
    const canSplitX = rect.w >= 2 * minRoom;
    const canSplitY = rect.h >= 2 * minRoom;
    const mustSplit = rect.w > maxRoom || rect.h > maxRoom;
    const wantsSplit = mustSplit || (rect.w * rect.h >= 64 && rng.chance(0.35));
    if (!wantsSplit || (!canSplitX && !canSplitY)) {
      rooms.push(rect);
      return;
    }
    let vertical: boolean;
    if (!canSplitY) vertical = true;
    else if (!canSplitX) vertical = false;
    else if (rect.w > rect.h * 1.25) vertical = true;
    else if (rect.h > rect.w * 1.25) vertical = false;
    else vertical = rng.chance(0.5);

    if (vertical) {
      const cut = rng.int(minRoom, rect.w - minRoom);
      split({ x: rect.x, y: rect.y, w: cut, h: rect.h });
      split({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h });
    } else {
      const cut = rng.int(minRoom, rect.h - minRoom);
      split({ x: rect.x, y: rect.y, w: rect.w, h: cut });
      split({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut });
    }
  };

  split(root);
  return rooms;
}

/** Arêtes de tuiles situées sur le contour d'un rectangle. */
export function rectBoundaryEdges(rect: Rect): Edge[] {
  const edges: Edge[] = [];
  for (let x = rect.x; x < rect.x + rect.w; x++) {
    edges.push({ x, y: rect.y, side: "N" });
    edges.push({ x, y: rect.y + rect.h, side: "N" });
  }
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    edges.push({ x: rect.x, y, side: "W" });
    edges.push({ x: rect.x + rect.w, y, side: "W" });
  }
  return edges;
}

/** Arêtes partagées par deux rectangles adjacents (vide s'ils ne se touchent pas). */
export function sharedEdges(a: Rect, b: Rect): Edge[] {
  const edges: Edge[] = [];
  const overlapY = [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)];
  const overlapX = [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)];
  if (overlapY[1] > overlapY[0]) {
    const wallX = a.x + a.w === b.x ? b.x : b.x + b.w === a.x ? a.x : -1;
    if (wallX >= 0)
      for (let y = overlapY[0]; y < overlapY[1]; y++)
        edges.push({ x: wallX, y, side: "W" });
  }
  if (overlapX[1] > overlapX[0]) {
    const wallY = a.y + a.h === b.y ? b.y : b.y + b.h === a.y ? a.y : -1;
    if (wallY >= 0)
      for (let x = overlapX[0]; x < overlapX[1]; x++)
        edges.push({ x, y: wallY, side: "N" });
  }
  return edges;
}
