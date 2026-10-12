// Fonctions de dessin PixiJS : formes géométriques simples en projection isométrique.
import type { Graphics } from "pixi.js";
import { CATALOG } from "../map/catalog";
import { hexToInt, shade } from "../map/color";
import type { Footprint } from "../map/depth";
import { gridToScreen, TILE_HEIGHT } from "../map/iso";
import { HEIGHT_UNIT, WALL_HEIGHT, type SceneItem } from "../map/scene";
import type { Edge, Rect, Zone } from "../map/schema";
import type { WorldRect } from "../map/viewport";

const WALL_COLOR = "#ece4d6";
const DOOR_COLOR = "#a47551";
const SKIN_COLOR = 0xf1c7a0;

type Point = { x: number; y: number };
const flat = (points: Point[]) => points.flatMap((p) => [p.x, p.y]);
const lift = (p: Point, dy: number): Point => ({ x: p.x, y: p.y - dy });

/** Boîte isométrique alignée sur la grille (trois faces visibles). */
function prism(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
  z0: number,
  color: string,
) {
  const top = height * HEIGHT_UNIT + z0 * HEIGHT_UNIT;
  const base = z0 * HEIGHT_UNIT;
  const a = gridToScreen(x, y);
  const b = gridToScreen(x + w, y);
  const c = gridToScreen(x + w, y + h);
  const d = gridToScreen(x, y + h);
  const outline = { width: 1, color: shade(color, 0.55), alpha: 0.5 };
  g.poly(flat([lift(d, top), lift(c, top), lift(c, base), lift(d, base)]))
    .fill(shade(color, 0.82))
    .stroke(outline);
  g.poly(flat([lift(c, top), lift(b, top), lift(b, base), lift(c, base)]))
    .fill(shade(color, 0.64))
    .stroke(outline);
  g.poly(flat([lift(a, top), lift(b, top), lift(c, top), lift(d, top)]))
    .fill(hexToInt(color))
    .stroke(outline);
}

/** Zone d'écran (monde) couverte par une emprise de hauteur donnée, avec une marge. */
export function footprintBounds(f: Footprint, heightUnits: number): WorldRect {
  const margin = 6;
  return {
    minX: gridToScreen(f.x, f.y + f.h).x - margin,
    maxX: gridToScreen(f.x + f.w, f.y).x + margin,
    minY: gridToScreen(f.x, f.y).y - heightUnits * HEIGHT_UNIT - 40,
    maxY: gridToScreen(f.x + f.w, f.y + f.h).y + margin,
  };
}

export function drawFloor(g: Graphics, zone: Zone): void {
  for (const rect of zone.rects) {
    const corners = [
      gridToScreen(rect.x, rect.y),
      gridToScreen(rect.x + rect.w, rect.y),
      gridToScreen(rect.x + rect.w, rect.y + rect.h),
      gridToScreen(rect.x, rect.y + rect.h),
    ];
    g.poly(flat(corners)).fill(hexToInt(zone.floorColor));
    const line = { width: 1, color: shade(zone.floorColor, 0.88), alpha: 0.9 };
    for (let i = 1; i < rect.w; i++) {
      const from = gridToScreen(rect.x + i, rect.y);
      const to = gridToScreen(rect.x + i, rect.y + rect.h);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke(line);
    }
    for (let j = 1; j < rect.h; j++) {
      const from = gridToScreen(rect.x, rect.y + j);
      const to = gridToScreen(rect.x + rect.w, rect.y + j);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke(line);
    }
  }
}

export function drawZoneOverlay(
  g: Graphics,
  rects: Rect[],
  mode: "hover" | "selected",
): void {
  for (const rect of rects) {
    const corners = [
      gridToScreen(rect.x, rect.y),
      gridToScreen(rect.x + rect.w, rect.y),
      gridToScreen(rect.x + rect.w, rect.y + rect.h),
      gridToScreen(rect.x, rect.y + rect.h),
    ];
    if (mode === "hover") {
      g.poly(flat(corners))
        .fill({ color: 0xffffff, alpha: 0.28 })
        .stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
    } else {
      g.poly(flat(corners))
        .fill({ color: 0xe8590c, alpha: 0.14 })
        .stroke({ width: 3, color: 0xe8590c, alpha: 0.95 });
    }
  }
}

function edgeEnds(edge: Edge): [Point, Point] {
  return edge.side === "N"
    ? [gridToScreen(edge.x, edge.y), gridToScreen(edge.x + 1, edge.y)]
    : [gridToScreen(edge.x, edge.y), gridToScreen(edge.x, edge.y + 1)];
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawWall(g: Graphics, edge: Edge): void {
  const [p1, p2] = edgeEnds(edge);
  const wallHeight = WALL_HEIGHT * HEIGHT_UNIT;
  if (edge.kind === "glass") {
    // Cloison vitrée : translucide, avec un cadre en haut et en bas
    g.poly(flat([lift(p1, wallHeight), lift(p2, wallHeight), p2, p1]))
      .fill({ color: 0x9ccfe0, alpha: 0.35 })
      .stroke({ width: 2, color: 0x5b9bb5, alpha: 0.85 });
    return;
  }
  const color =
    edge.side === "N" ? shade(WALL_COLOR, 0.95) : shade(WALL_COLOR, 0.8);
  g.poly(flat([lift(p1, wallHeight), lift(p2, wallHeight), p2, p1]))
    .fill(color)
    .stroke({ width: 1, color: shade(WALL_COLOR, 0.55), alpha: 0.6 });
}

function drawDoor(g: Graphics, edge: Edge): void {
  const [p1, p2] = edgeEnds(edge);
  const wallHeight = WALL_HEIGHT * HEIGHT_UNIT;
  const dark = shade(DOOR_COLOR, 0.8);
  const quad = (t0: number, t1: number, h0: number, h1: number) => {
    const a = lerp(p1, p2, t0);
    const b = lerp(p1, p2, t1);
    g.poly(flat([lift(a, h1), lift(b, h1), lift(b, h0), lift(a, h0)]))
      .fill(dark)
      .stroke({ width: 1, color: shade(DOOR_COLOR, 0.5), alpha: 0.7 });
  };
  quad(0, 0.16, 0, wallHeight);
  quad(0.84, 1, 0, wallHeight);
  quad(0, 1, wallHeight * 0.8, wallHeight);
  // Seuil au sol
  const a = lerp(p1, p2, 0.16);
  const b = lerp(p1, p2, 0.84);
  g.moveTo(a.x, a.y)
    .lineTo(b.x, b.y)
    .stroke({ width: 3, color: hexToInt(DOOR_COLOR), alpha: 0.5 });
}

function drawElement(
  g: Graphics,
  item: Extract<SceneItem, { kind: "element" }>,
): void {
  const entry = CATALOG[item.catalogKey];
  const { x, y, w, h } = item.footprint;
  switch (item.catalogKey) {
    case "plante": {
      prism(g, x + 0.3, y + 0.3, 0.4, 0.4, 0.3, 0, "#9c6b43");
      const c = gridToScreen(x + 0.5, y + 0.5);
      g.circle(c.x, c.y - 0.3 * HEIGHT_UNIT - 8, 10)
        .fill(0x4e9a5b)
        .stroke({ width: 1, color: 0x2f6b3b });
      g.circle(c.x - 5, c.y - 0.3 * HEIGHT_UNIT - 13, 6).fill(0x63b36f);
      return;
    }
    case "chaise": {
      prism(g, x + 0.15, y + 0.15, 0.7, 0.7, 0.25, 0, entry.color);
      prism(g, x + 0.15, y + 0.15, 0.7, 0.12, 0.7, 0, "#3d5877");
      return;
    }
    default:
      prism(g, x, y, w, h, entry.height, 0, entry.color);
  }
  if (entry.isWorkstation) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if ((dx + dy) % 2 === 0)
          prism(
            g,
            x + dx + 0.3,
            y + dy + 0.35,
            0.4,
            0.15,
            0.45,
            entry.height,
            "#2f3640",
          );
      }
    }
  }
}

function drawPerson(
  g: Graphics,
  item: Extract<SceneItem, { kind: "person" }>,
): void {
  const c = gridToScreen(item.footprint.x + 0.5, item.footprint.y + 0.5);
  g.ellipse(c.x, c.y, 11, TILE_HEIGHT / 4).fill({
    color: 0x000000,
    alpha: 0.18,
  });
  g.roundRect(c.x - 7, c.y - 24, 14, 20, 6)
    .fill(hexToInt(item.color))
    .stroke({ width: 1, color: 0x000000, alpha: 0.35 });
  g.circle(c.x, c.y - 31, 6.5)
    .fill(SKIN_COLOR)
    .stroke({ width: 1, color: 0x000000, alpha: 0.35 });
}

/** Hauteur (en unités) utilisée pour le calcul des bornes de culling. */
export function itemHeightUnits(item: SceneItem): number {
  switch (item.kind) {
    case "wall":
    case "door":
      return WALL_HEIGHT;
    case "person":
      return 1.6;
    case "element":
      return (CATALOG[item.catalogKey]?.height ?? 1) + 0.5;
  }
}

export function drawSceneItem(g: Graphics, item: SceneItem): void {
  switch (item.kind) {
    case "wall":
      return drawWall(g, item.edge);
    case "door":
      return drawDoor(g, item.edge);
    case "element":
      return drawElement(g, item);
    case "person":
      return drawPerson(g, item);
  }
}
