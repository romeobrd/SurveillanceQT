// Caméra 2D (déplacement + zoom) : fonctions pures, sans DOM ni PixiJS.

export interface Camera {
  /** Translation écran (px) de l'origine du monde. */
  x: number;
  y: number;
  zoom: number;
}

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

export function worldToScreen(camera: Camera, wx: number, wy: number) {
  return { x: wx * camera.zoom + camera.x, y: wy * camera.zoom + camera.y };
}

export function screenToWorld(camera: Camera, sx: number, sy: number) {
  return { x: (sx - camera.x) / camera.zoom, y: (sy - camera.y) / camera.zoom };
}

/** Zoom en gardant fixe le point monde situé sous (px, py). */
export function zoomAt(
  camera: Camera,
  factor: number,
  px: number,
  py: number,
): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  const world = screenToWorld(camera, px, py);
  return { zoom, x: px - world.x * zoom, y: py - world.y * zoom };
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** Rectangle monde visible dans une vue de viewWidth × viewHeight pixels. */
export function visibleWorldRect(
  camera: Camera,
  viewWidth: number,
  viewHeight: number,
): WorldRect {
  const topLeft = screenToWorld(camera, 0, 0);
  const bottomRight = screenToWorld(camera, viewWidth, viewHeight);
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
}

export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
  );
}

/** Caméra qui cadre entièrement `bounds` avec une marge en pixels. */
export function fitCamera(
  bounds: WorldRect,
  viewWidth: number,
  viewHeight: number,
  padding = 24,
): Camera {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const zoom = Math.min(
    MAX_ZOOM,
    Math.max(
      MIN_ZOOM,
      Math.min(
        (viewWidth - 2 * padding) / width,
        (viewHeight - 2 * padding) / height,
      ),
    ),
  );
  return {
    zoom,
    x: (viewWidth - width * zoom) / 2 - bounds.minX * zoom,
    y: (viewHeight - height * zoom) / 2 - bounds.minY * zoom,
  };
}

/** Empêche de perdre la carte : au moins `margin` px de la carte restent visibles. */
export function clampCamera(
  camera: Camera,
  bounds: WorldRect,
  viewWidth: number,
  viewHeight: number,
  margin = 80,
): Camera {
  const left = bounds.minX * camera.zoom + camera.x;
  const right = bounds.maxX * camera.zoom + camera.x;
  const top = bounds.minY * camera.zoom + camera.y;
  const bottom = bounds.maxY * camera.zoom + camera.y;
  let { x, y } = camera;
  if (right < margin) x += margin - right;
  if (left > viewWidth - margin) x -= left - (viewWidth - margin);
  if (bottom < margin) y += margin - bottom;
  if (top > viewHeight - margin) y -= top - (viewHeight - margin);
  return { ...camera, x, y };
}
