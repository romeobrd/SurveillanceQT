import { describe, expect, it } from "vitest";
import {
  gridToScreen,
  screenToGrid,
  screenToTile,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "./iso";

describe("projection isométrique", () => {
  it("respecte le rapport 2:1", () => {
    expect(TILE_WIDTH / TILE_HEIGHT).toBe(2);
    expect(gridToScreen(1, 0)).toEqual({
      x: TILE_WIDTH / 2,
      y: TILE_HEIGHT / 2,
    });
    expect(gridToScreen(0, 1)).toEqual({
      x: -TILE_WIDTH / 2,
      y: TILE_HEIGHT / 2,
    });
  });

  it("l'origine reste à l'origine", () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("screenToGrid est l'inverse de gridToScreen", () => {
    for (const [gx, gy] of [
      [0, 0],
      [3, 5],
      [12.5, 7.25],
      [39, 39],
    ]) {
      const screen = gridToScreen(gx, gy);
      const back = screenToGrid(screen.x, screen.y);
      expect(back.x).toBeCloseTo(gx);
      expect(back.y).toBeCloseTo(gy);
    }
  });

  it("retrouve la tuile sous le centre d'un losange", () => {
    const top = gridToScreen(4, 6);
    expect(screenToTile(top.x, top.y + TILE_HEIGHT / 2)).toEqual({
      x: 4,
      y: 6,
    });
  });
});
