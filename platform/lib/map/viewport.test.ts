import { describe, expect, it } from "vitest";
import {
  clampCamera,
  fitCamera,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  rectsIntersect,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
  zoomAt,
} from "./viewport";

const camera = { x: 100, y: 50, zoom: 1 };

describe("caméra", () => {
  it("convertit monde <-> écran dans les deux sens", () => {
    const world = screenToWorld(camera, 300, 200);
    const screen = worldToScreen(camera, world.x, world.y);
    expect(screen.x).toBeCloseTo(300);
    expect(screen.y).toBeCloseTo(200);
  });

  it("zoome en gardant fixe le point sous le curseur", () => {
    const before = screenToWorld(camera, 400, 300);
    const zoomed = zoomAt(camera, 1.5, 400, 300);
    const after = screenToWorld(zoomed, 400, 300);
    expect(zoomed.zoom).toBeCloseTo(1.5);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("borne le zoom", () => {
    expect(zoomAt(camera, 1000, 0, 0).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(camera, 0.0001, 0, 0).zoom).toBe(MIN_ZOOM);
  });

  it("déplace la caméra", () => {
    expect(panBy(camera, 10, -5)).toEqual({ x: 110, y: 45, zoom: 1 });
  });

  it("calcule le rectangle monde visible", () => {
    expect(visibleWorldRect({ x: 0, y: 0, zoom: 2 }, 800, 600)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 400,
      maxY: 300,
    });
  });

  it("détecte l'intersection de rectangles (culling)", () => {
    const view = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(
      rectsIntersect(view, { minX: 50, minY: 50, maxX: 150, maxY: 150 }),
    ).toBe(true);
    expect(
      rectsIntersect(view, { minX: 101, minY: 0, maxX: 200, maxY: 50 }),
    ).toBe(false);
  });

  it("cadre une carte entière au centre de la vue", () => {
    const bounds = { minX: -500, minY: -50, maxX: 500, maxY: 450 };
    const fit = fitCamera(bounds, 1000, 600, 0);
    const topLeft = worldToScreen(fit, bounds.minX, bounds.minY);
    const bottomRight = worldToScreen(fit, bounds.maxX, bounds.maxY);
    expect(topLeft.x).toBeGreaterThanOrEqual(-0.001);
    expect(topLeft.y).toBeGreaterThanOrEqual(-0.001);
    expect(bottomRight.x).toBeLessThanOrEqual(1000.001);
    expect(bottomRight.y).toBeLessThanOrEqual(600.001);
  });

  it("empêche de faire sortir complètement la carte de la vue", () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const lost = clampCamera(
      { x: -5000, y: 5000, zoom: 1 },
      bounds,
      800,
      600,
      80,
    );
    const topLeft = worldToScreen(lost, 0, 0);
    const bottomRight = worldToScreen(lost, 100, 100);
    expect(bottomRight.x).toBeGreaterThanOrEqual(80);
    expect(topLeft.y).toBeLessThanOrEqual(600 - 80);
  });
});
