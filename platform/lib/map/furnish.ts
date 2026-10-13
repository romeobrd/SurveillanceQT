// Ameublement cohérent par type de zone, sans collision et sans bloquer un passage.
import { CATALOG, getFootprint } from "./catalog";
import { buildDoorKeepFree, createGrid, floodFill, type Grid } from "./grid";
import type { Rng } from "./prng";
import { getEntranceTiles } from "./reachability";
import type { Layout, MapElement, Rect, Rotation, Zone } from "./schema";

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

interface Context {
  layout: Layout;
  grid: Grid;
  rng: Rng;
  entrances: Array<{ x: number; y: number }>;
  /** Tuiles de part et d'autre d'une porte : toujours laissées libres. */
  keepFree: Uint8Array;
  freeCount: number;
  elements: MapElement[];
}

function allReachable(ctx: Context): boolean {
  return floodFill(ctx.grid, ctx.entrances).count === ctx.freeCount;
}

function placeAt(
  ctx: Context,
  key: string,
  x: number,
  y: number,
  rotation: Rotation,
  rect: Rect,
  zoneId: string,
): MapElement | null {
  const entry = CATALOG[key];
  const { w, h } = getFootprint(entry, rotation);
  if (
    x < rect.x ||
    y < rect.y ||
    x + w > rect.x + rect.w ||
    y + h > rect.y + rect.h
  )
    return null;
  const { width } = ctx.layout;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const index = (y + dy) * width + x + dx;
      if (ctx.grid.occupied[index] || ctx.keepFree[index]) return null;
    }
  }
  const mark = (value: 0 | 1) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++)
        ctx.grid.occupied[(y + dy) * width + x + dx] = value;
    }
  };
  mark(1);
  ctx.freeCount -= w * h;
  if (!allReachable(ctx)) {
    mark(0);
    ctx.freeCount += w * h;
    return null;
  }
  const element: MapElement = {
    id: `e${ctx.elements.length + 1}`,
    catalogKey: key,
    x,
    y,
    rotation,
    zoneId,
  };
  ctx.elements.push(element);
  return element;
}

function tryPlace(
  ctx: Context,
  key: string,
  rect: Rect,
  zoneId: string,
  attempts = 30,
): MapElement | null {
  const entry = CATALOG[key];
  for (let i = 0; i < attempts; i++) {
    const rotation = entry.rotatable ? ctx.rng.pick(ROTATIONS) : 0;
    const { w, h } = getFootprint(entry, rotation);
    if (w > rect.w || h > rect.h) continue;
    const x = ctx.rng.int(rect.x, rect.x + rect.w - w);
    const y = ctx.rng.int(rect.y, rect.y + rect.h - h);
    const placed = placeAt(ctx, key, x, y, rotation, rect, zoneId);
    if (placed) return placed;
  }
  return null;
}

/** Place une chaise sur une tuile adjacente à l'élément (côté sud en priorité). */
function placeChairNear(ctx: Context, target: MapElement, rect: Rect): void {
  const entry = CATALOG[target.catalogKey];
  const { w, h } = getFootprint(entry, target.rotation);
  const candidates: Array<{ x: number; y: number }> = [];
  for (let dx = 0; dx < w; dx++)
    candidates.push({ x: target.x + dx, y: target.y + h });
  for (let dx = 0; dx < w; dx++)
    candidates.push({ x: target.x + dx, y: target.y - 1 });
  for (let dy = 0; dy < h; dy++)
    candidates.push({ x: target.x + w, y: target.y + dy });
  for (let dy = 0; dy < h; dy++)
    candidates.push({ x: target.x - 1, y: target.y + dy });
  for (const tile of candidates) {
    if (placeAt(ctx, "chaise", tile.x, tile.y, 0, rect, target.zoneId)) return;
  }
}

function furnishZone(ctx: Context, zone: Zone): void {
  const rect = zone.rects[0];
  const area = rect.w * rect.h;
  const { rng } = ctx;
  const place = (key: string, count: number) => {
    const placed: MapElement[] = [];
    for (let i = 0; i < count; i++) {
      const element = tryPlace(ctx, key, rect, zone.id);
      if (element) placed.push(element);
    }
    return placed;
  };

  switch (zone.type) {
    case "open_space": {
      const desks = Math.max(2, Math.floor(area / 10));
      for (let i = 0; i < desks; i++) {
        const key = rng.pick([
          "bureau_simple",
          "bureau_simple",
          "bureau_simple",
          "bureau_double",
          "ilot_4",
        ]);
        const desk = tryPlace(ctx, key, rect, zone.id);
        if (desk) placeChairNear(ctx, desk, rect);
      }
      place("poste_debout", rng.int(0, 2));
      place("plante", rng.int(1, 3));
      place("etagere", rng.int(0, 1));
      break;
    }
    case "bureau_individuel": {
      const desk = tryPlace(ctx, "bureau_simple", rect, zone.id);
      if (desk) placeChairNear(ctx, desk, rect);
      place("plante", rng.int(0, 1));
      place("etagere", rng.int(0, 1));
      break;
    }
    case "salle_reunion": {
      const table = tryPlace(ctx, "table_reunion", rect, zone.id);
      if (table) {
        const chairs = rng.int(3, 6);
        for (let i = 0; i < chairs; i++) placeChairNear(ctx, table, rect);
      }
      place("plante", rng.int(0, 1));
      break;
    }
    case "cafeteria": {
      const tables = place("table_cafeteria", area >= 40 ? 2 : 1);
      for (const table of tables) placeChairNear(ctx, table, rect);
      place("machine_cafe", 1);
      place("canape", rng.int(0, 1));
      place("plante", rng.int(0, 2));
      break;
    }
    case "reserve":
      place("etagere", Math.max(2, Math.min(5, Math.floor(area / 6))));
      break;
    case "salle_serveur":
      place("baie_serveur", Math.max(2, Math.min(5, Math.floor(area / 5))));
      break;
    case "accueil":
      place("comptoir_accueil", 1);
      place("canape", rng.int(0, 1));
      place("plante", rng.int(1, 2));
      break;
  }
}

/** Retourne les éléments à ajouter à une carte (murs, portes et zones déjà définis). */
export function furnishLayout(layout: Layout, rng: Rng): MapElement[] {
  const grid = createGrid(layout);
  const ctx: Context = {
    layout,
    grid,
    rng,
    entrances: getEntranceTiles(layout),
    keepFree: buildDoorKeepFree(layout),
    freeCount: layout.width * layout.height,
    elements: [],
  };
  for (const zone of layout.zones) furnishZone(ctx, zone);
  return ctx.elements;
}
