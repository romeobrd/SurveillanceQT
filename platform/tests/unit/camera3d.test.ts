import { describe, expect, it } from "vitest";
import {
  cameraPosition,
  clampOrbit,
  DEFAULT_AZIMUTH,
  easeInOutCubic,
  focusOn,
  lerpOrbit,
  fitCamera,
  groundAxes,
  MAX_POLAR,
  MIN_DISTANCE,
  MIN_POLAR,
  normalizeAngle,
  orbitBy,
  panBetween,
  panScreen,
  rayToGround,
  zoomToward,
  type GroundBounds,
  type OrbitCamera,
} from "@/lib/map/camera3d";

const bounds: GroundBounds = {
  minX: 0,
  maxX: 40,
  minZ: 0,
  maxZ: 30,
  height: 2,
};
const base: OrbitCamera = {
  targetX: 20,
  targetZ: 15,
  distance: 30,
  azimuth: DEFAULT_AZIMUTH,
  polar: 0.9,
};

describe("caméra 3D en orbite", () => {
  it("cadre la carte : centrée, plus loin pour une carte plus grande", () => {
    const camera = fitCamera(bounds, Math.PI / 4, 1.5);
    expect(camera).toMatchObject({ targetX: 20, targetZ: 15 });
    const larger = fitCamera({ ...bounds, maxX: 80 }, Math.PI / 4, 1.5);
    expect(larger.distance).toBeGreaterThan(camera.distance);
    const narrow = fitCamera(bounds, Math.PI / 4, 0.5);
    expect(narrow.distance).toBeGreaterThan(camera.distance); // écran étroit : il faut reculer
  });

  it("place la caméra au-dessus du sol, du côté (largeur, hauteur) par défaut, à la bonne distance", () => {
    const position = cameraPosition(base);
    expect(position.y).toBeGreaterThan(0);
    expect(position.x).toBeGreaterThan(base.targetX);
    expect(position.z).toBeGreaterThan(base.targetZ);
    const distance = Math.hypot(position.x - 20, position.y, position.z - 15);
    expect(distance).toBeCloseTo(30);
  });

  it("le glisser garde le point saisi sous le pointeur", () => {
    const moved = panBetween(base, { x: 10, z: 10 }, { x: 12, z: 9 });
    expect(moved.targetX).toBeCloseTo(18);
    expect(moved.targetZ).toBeCloseTo(16);
  });

  it("le zoom garde fixe le point visé et respecte les bornes", () => {
    const anchor = { x: 10, z: 5 };
    const zoomed = zoomToward(base, 2, anchor, 100);
    expect(zoomed.distance).toBeCloseTo(15);
    // Le point d'ancrage, le point visé et l'ancien point visé restent alignés
    expect(zoomed.targetX).toBeCloseTo(15);
    expect(zoomed.targetZ).toBeCloseTo(10);
    expect(zoomToward(base, 1000, null, 100).distance).toBe(MIN_DISTANCE);
    expect(zoomToward(base, 0.001, null, 100).distance).toBe(100);
  });

  it("l'orbite tourne librement mais limite l'inclinaison", () => {
    const turned = orbitBy(base, Math.PI * 3, 0);
    expect(turned.azimuth).toBeCloseTo(
      normalizeAngle(DEFAULT_AZIMUTH + Math.PI),
    );
    expect(orbitBy(base, 0, 10).polar).toBe(MAX_POLAR);
    expect(orbitBy(base, 0, -10).polar).toBe(MIN_POLAR);
  });

  it("les flèches déplacent dans les axes de l'écran", () => {
    const { forward, right } = groundAxes(base);
    expect(forward.x * right.x + forward.z * right.z).toBeCloseTo(0);
    const ahead = panScreen(base, 0, 2);
    expect(ahead.targetX).toBeCloseTo(base.targetX + forward.x * 2);
    // Vers l'avant = en s'éloignant de la caméra
    const position = cameraPosition(base);
    const before = Math.hypot(
      position.x - base.targetX,
      position.z - base.targetZ,
    );
    const after = Math.hypot(
      position.x - ahead.targetX,
      position.z - ahead.targetZ,
    );
    expect(after).toBeGreaterThan(before);
  });

  it("ne perd jamais la carte", () => {
    const lost = clampOrbit(
      { ...base, targetX: -500, targetZ: 900, distance: 1e6, polar: 3 },
      bounds,
      120,
    );
    expect(lost).toMatchObject({
      targetX: 0,
      targetZ: 30,
      distance: 120,
      polar: MAX_POLAR,
    });
  });

  it("trouve le point du sol visé par un rayon", () => {
    expect(rayToGround({ x: 0, y: 10, z: 0 }, { x: 1, y: -1, z: 0.5 })).toEqual(
      { x: 10, z: 5 },
    );
    expect(
      rayToGround({ x: 0, y: 10, z: 0 }, { x: 1, y: 0.1, z: 0 }),
    ).toBeNull();
  });

  it("un rayon qui part de la caméra vers le point visé retombe sur le point visé", () => {
    const p = cameraPosition(base);
    const hit = rayToGround(p, {
      x: base.targetX - p.x,
      y: -p.y,
      z: base.targetZ - p.z,
    });
    expect(hit!.x).toBeCloseTo(base.targetX);
    expect(hit!.z).toBeCloseTo(base.targetZ);
  });
});

describe("animations de caméra", () => {
  it("la courbe part de 0, arrive à 1 et reste bornée", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(-2)).toBe(0);
    expect(easeInOutCubic(3)).toBe(1);
  });

  it("interpole tout, et tourne par le plus court chemin", () => {
    const from = { ...base, azimuth: 0.1 };
    const to = {
      ...base,
      azimuth: Math.PI * 2 - 0.1,
      targetX: 30,
      distance: 10,
    };
    const middle = lerpOrbit(from, to, 0.5);
    expect(middle.targetX).toBeCloseTo(25);
    expect(middle.distance).toBeCloseTo(20);
    expect(middle.azimuth).toBeCloseTo(0); // passe par 0, pas par π
    expect(lerpOrbit(from, to, 1).azimuth).toBeCloseTo(to.azimuth);
  });

  it("vole vers une pièce : centrée, plus près, jamais plus loin qu'avant", () => {
    const focused = focusOn(base, { x: 4, y: 6, w: 4, h: 2 });
    expect(focused).toMatchObject({ targetX: 6, targetZ: 7 });
    expect(focused.distance).toBeLessThan(base.distance);
    const close = { ...base, distance: 5 };
    expect(focusOn(close, { x: 0, y: 0, w: 20, h: 20 }).distance).toBe(5);
  });
});
