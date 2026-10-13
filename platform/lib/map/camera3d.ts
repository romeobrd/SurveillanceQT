// Caméra 3D en orbite autour d'un point du sol : fonctions pures (sans Three.js ni DOM), testées unitairement.
// Repère du monde : X = colonne de la grille, Z = ligne de la grille, Y = hauteur. Une tuile mesure 1 × 1.

export interface OrbitCamera {
  /** Point visé, sur le sol (y = 0). */
  targetX: number;
  targetZ: number;
  /** Distance entre la caméra et le point visé. */
  distance: number;
  /** Angle horizontal (radians) : π/4 regarde la carte depuis le coin (largeur, hauteur), comme l'ancienne vue isométrique. */
  azimuth: number;
  /** Angle depuis la verticale (radians) : 0 = vue de dessus. */
  polar: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Emprise de la carte au sol, et hauteur maximale des objets. */
export interface GroundBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export const DEFAULT_AZIMUTH = Math.PI / 4;
export const DEFAULT_POLAR = 0.95;
export const MIN_POLAR = 0.3;
export const MAX_POLAR = 1.2;
export const MIN_DISTANCE = 3;

/** Position de la caméra dans le monde. */
export function cameraPosition(camera: OrbitCamera): Vec3 {
  const horizontal = Math.sin(camera.polar) * camera.distance;
  return {
    x: camera.targetX + horizontal * Math.cos(camera.azimuth),
    y: Math.cos(camera.polar) * camera.distance,
    z: camera.targetZ + horizontal * Math.sin(camera.azimuth),
  };
}

/** Direction « devant » et « à droite » de la caméra, projetées sur le sol (vecteurs unitaires). */
export function groundAxes(camera: OrbitCamera): {
  forward: { x: number; z: number };
  right: { x: number; z: number };
} {
  const forward = {
    x: -Math.cos(camera.azimuth),
    z: -Math.sin(camera.azimuth),
  };
  return { forward, right: { x: -forward.z, z: forward.x } };
}

/** Distance qui cadre toute la carte dans un champ de vision vertical `fovY` (radians) et un rapport largeur/hauteur. */
export function fitDistance(
  bounds: GroundBounds,
  fovY: number,
  aspect: number,
): number {
  const halfDiagonal = Math.hypot(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ,
    bounds.height,
  );
  const radius = halfDiagonal / 2;
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  const fov = Math.min(fovY, fovX);
  return (radius / Math.sin(fov / 2)) * 1.02;
}

/** Caméra par défaut : toute la carte, vue de trois quarts. */
export function fitCamera(
  bounds: GroundBounds,
  fovY: number,
  aspect: number,
): OrbitCamera {
  return {
    targetX: (bounds.minX + bounds.maxX) / 2,
    targetZ: (bounds.minZ + bounds.maxZ) / 2,
    distance: Math.max(MIN_DISTANCE, fitDistance(bounds, fovY, aspect)),
    azimuth: DEFAULT_AZIMUTH,
    polar: DEFAULT_POLAR,
  };
}

/** Bornes : on ne perd jamais la carte (point visé sur la carte, distance et inclinaison limitées). */
export function clampOrbit(
  camera: OrbitCamera,
  bounds: GroundBounds,
  maxDistance: number,
): OrbitCamera {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  return {
    targetX: clamp(camera.targetX, bounds.minX, bounds.maxX),
    targetZ: clamp(camera.targetZ, bounds.minZ, bounds.maxZ),
    distance: clamp(
      camera.distance,
      MIN_DISTANCE,
      Math.max(MIN_DISTANCE, maxDistance),
    ),
    azimuth: normalizeAngle(camera.azimuth),
    polar: clamp(camera.polar, MIN_POLAR, MAX_POLAR),
  };
}

export function normalizeAngle(angle: number): number {
  const turn = Math.PI * 2;
  return ((angle % turn) + turn) % turn;
}

/** Glisser : le point du sol saisi reste sous le pointeur. */
export function panBetween(
  camera: OrbitCamera,
  from: { x: number; z: number },
  to: { x: number; z: number },
): OrbitCamera {
  return {
    ...camera,
    targetX: camera.targetX + (from.x - to.x),
    targetZ: camera.targetZ + (from.z - to.z),
  };
}

/** Déplacement au clavier, dans les axes de l'écran (dx vers la droite, dz vers l'avant). */
export function panScreen(
  camera: OrbitCamera,
  dx: number,
  dz: number,
): OrbitCamera {
  const { forward, right } = groundAxes(camera);
  return {
    ...camera,
    targetX: camera.targetX + right.x * dx + forward.x * dz,
    targetZ: camera.targetZ + right.z * dx + forward.z * dz,
  };
}

/** Zoom (factor > 1 rapproche) en gardant fixe le point du sol `anchor` (sous le pointeur), s'il est connu. */
export function zoomToward(
  camera: OrbitCamera,
  factor: number,
  anchor: { x: number; z: number } | null,
  maxDistance: number,
): OrbitCamera {
  const distance = Math.min(
    Math.max(MIN_DISTANCE, maxDistance),
    Math.max(MIN_DISTANCE, camera.distance / factor),
  );
  if (!anchor) return { ...camera, distance };
  const ratio = distance / camera.distance;
  return {
    ...camera,
    distance,
    targetX: anchor.x + (camera.targetX - anchor.x) * ratio,
    targetZ: anchor.z + (camera.targetZ - anchor.z) * ratio,
  };
}

export function orbitBy(
  camera: OrbitCamera,
  deltaAzimuth: number,
  deltaPolar: number,
): OrbitCamera {
  return {
    ...camera,
    azimuth: normalizeAngle(camera.azimuth + deltaAzimuth),
    polar: Math.min(MAX_POLAR, Math.max(MIN_POLAR, camera.polar + deltaPolar)),
  };
}

/** Intersection d'un rayon avec le sol (y = 0), ou null s'il ne le touche pas. */
export function rayToGround(
  origin: Vec3,
  direction: Vec3,
): { x: number; z: number } | null {
  if (direction.y >= -1e-9) return null;
  const t = -origin.y / direction.y;
  if (t < 0) return null;
  return { x: origin.x + direction.x * t, z: origin.z + direction.z * t };
}
