// Projection isométrique 2:1 : conversions grille <-> écran (pures, sans PixiJS).

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = TILE_WIDTH / 2;

export interface Point {
  x: number;
  y: number;
}

/** Position écran du coin supérieur (nord) de la tuile (gx, gy). */
export function gridToScreen(
  gx: number,
  gy: number,
  tileWidth = TILE_WIDTH,
): Point {
  const halfW = tileWidth / 2;
  const halfH = tileWidth / 4;
  return { x: (gx - gy) * halfW, y: (gx + gy) * halfH };
}

/** Inverse de gridToScreen : coordonnées de grille (fractionnaires) d'un point écran. */
export function screenToGrid(
  sx: number,
  sy: number,
  tileWidth = TILE_WIDTH,
): Point {
  const halfW = tileWidth / 2;
  const halfH = tileWidth / 4;
  return { x: (sx / halfW + sy / halfH) / 2, y: (sy / halfH - sx / halfW) / 2 };
}

/** Tuile (entière) située sous un point écran. */
export function screenToTile(
  sx: number,
  sy: number,
  tileWidth = TILE_WIDTH,
): Point {
  const g = screenToGrid(sx, sy, tileWidth);
  return { x: Math.floor(g.x), y: Math.floor(g.y) };
}
