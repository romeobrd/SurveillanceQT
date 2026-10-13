// Modèles 3D des objets de la carte, décrits comme des assemblages de formes simples : code pur, sans Three.js.
// Aucun fichier de modèle externe : tout est généré ici (pas de dépendance ni de téléchargement tiers).
// Repère du monde : X = colonne, Z = ligne, Y = hauteur ; une tuile mesure 1 × 1.
import { CATALOG, getFootprint } from "./catalog";
import type { Edge, MapElement, Rotation } from "./schema";

export type PartShape = "box" | "rounded" | "cylinder" | "sphere";

/** Une forme posée dans le monde, alignée sur les axes (les rotations de la carte sont des quarts de tour). */
export interface Part {
  shape: PartShape;
  /** Centre de la forme. */
  x: number;
  y: number;
  z: number;
  /** Dimensions (diamètre pour les cylindres et sphères). */
  sx: number;
  sy: number;
  sz: number;
  color: string;
  /** Matériau translucide (vitres). */
  glass?: boolean;
}

/** Hauteur des murs en unités de monde (volontairement basse : on voit l'intérieur des pièces). */
export const WALL_HEIGHT_3D = 1;
export const WALL_THICKNESS = 0.1;

/** Couleur d'accent de la marque dans la carte (orange-600, comme les classes brand-* de l'interface). */
export const ACCENT = "#ea580c";

/** Palette de rendu : tout en blanc et gris, l'accent réservé aux éléments forts (racks, assises, comptoir). */
export const PALETTE = {
  wall: "#fbfbfb",
  glass: "#cfe3ee",
  glassFrame: "#a3abb5",
  threshold: "#d5d9de",
  deskTop: "#fafafa",
  deskLeg: "#a7afb8",
  screen: "#2b2f36",
  chair: "#3f4752",
  chairBase: "#2a2f37",
  meetingTop: "#f1f1ef",
  sofa: ACCENT,
  shelfFrame: ACCENT,
  boxes: ["#e9e4da", "#cfd4db", "#d9cfbf", ACCENT],
  pot: "#e6e3de",
  leaves: ["#5fae6e", "#7cc489"],
  counter: "#ffffff",
  counterTop: ACCENT,
  server: "#2d3440",
  led: "#38d27a",
  coffee: "#3a3f47",
  legs: "#3b4252",
  skin: "#f1c7a0",
} as const;

/** Forme locale, dans le repère de l'élément NON tourné (x ∈ [0, w], z ∈ [0, h]). */
type LocalPart = Omit<Part, "x" | "z"> & { x: number; z: number };

const box = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  shape: PartShape = "rounded",
): LocalPart => ({ shape, x, y, z, sx, sy, sz, color });

/** Plateau posé sur quatre pieds. */
function table(w: number, h: number, height: number, top: string): LocalPart[] {
  const inset = 0.12;
  const legs: LocalPart[] = [];
  for (const [lx, lz] of [
    [inset, inset],
    [w - inset, inset],
    [inset, h - inset],
    [w - inset, h - inset],
  ])
    legs.push(
      box(lx, height / 2, lz, 0.06, height, 0.06, PALETTE.deskLeg, "box"),
    );
  return [
    box(w / 2, height - 0.03, h / 2, w - 0.08, 0.06, h - 0.1, top),
    ...legs,
  ];
}

/** Bureau : plateau, pieds, et un écran sur une tuile sur deux (même règle que l'affichage des places). */
function desk(w: number, h: number, height: number): LocalPart[] {
  const parts = table(w, h, height, PALETTE.deskTop);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if ((i + j) % 2 !== 0) continue;
      parts.push(
        box(i + 0.5, height + 0.17, j + 0.22, 0.46, 0.28, 0.04, PALETTE.screen),
        box(i + 0.5, height + 0.02, j + 0.25, 0.14, 0.04, 0.1, PALETTE.deskLeg),
      );
    }
  }
  return parts;
}

/** Étagère / rack : montants, tablettes et cartons de couleurs variées (déterministes). */
function shelf(w: number, h: number, height: number): LocalPart[] {
  const parts: LocalPart[] = [];
  const levels = 3;
  for (const lx of [0.06, w - 0.06])
    parts.push(
      box(
        lx,
        height / 2,
        h / 2,
        0.06,
        height,
        h - 0.1,
        PALETTE.shelfFrame,
        "box",
      ),
    );
  for (let level = 0; level < levels; level++) {
    const y = 0.1 + (level * (height - 0.15)) / levels;
    parts.push(
      box(w / 2, y, h / 2, w - 0.1, 0.04, h - 0.1, PALETTE.shelfFrame, "box"),
    );
    const count = Math.max(1, Math.round(w * 2));
    for (let k = 0; k < count; k++) {
      const color = PALETTE.boxes[(k + level * 3) % PALETTE.boxes.length];
      const size = 0.28 + ((k * 7 + level * 5) % 3) * 0.04;
      parts.push(
        box(
          0.2 + ((k + 0.5) * (w - 0.4)) / count,
          y + 0.02 + size / 2,
          h / 2,
          (w - 0.5) / count,
          size,
          Math.min(0.6, h - 0.25),
          color,
        ),
      );
    }
  }
  return parts;
}

function localParts(catalogKey: string): LocalPart[] {
  const entry = CATALOG[catalogKey];
  if (!entry) return [];
  const { w, h } = entry;
  switch (catalogKey) {
    case "bureau_simple":
    case "bureau_double":
    case "ilot_4":
      return desk(w, h, 0.5);
    case "poste_debout":
      return desk(w, h, 0.85);
    case "chaise":
      return [
        box(0.5, 0.06, 0.5, 0.36, 0.06, 0.36, PALETTE.chairBase, "cylinder"),
        box(0.5, 0.2, 0.5, 0.05, 0.25, 0.05, PALETTE.chairBase, "cylinder"),
        box(0.5, 0.35, 0.5, 0.5, 0.08, 0.48, PALETTE.chair),
        box(0.5, 0.58, 0.76, 0.48, 0.42, 0.08, PALETTE.chair),
      ];
    case "table_reunion":
      return table(w, h, 0.5, PALETTE.meetingTop);
    case "table_cafeteria":
      return [
        box(
          w / 2,
          0.47,
          h / 2,
          w - 0.3,
          0.06,
          h - 0.3,
          PALETTE.deskTop,
          "cylinder",
        ),
        box(w / 2, 0.23, h / 2, 0.12, 0.46, 0.12, PALETTE.deskLeg, "cylinder"),
        box(w / 2, 0.02, h / 2, 0.6, 0.04, 0.6, PALETTE.deskLeg, "cylinder"),
      ];
    case "canape":
      return [
        box(w / 2, 0.15, h / 2, w - 0.1, 0.26, h - 0.15, PALETTE.sofa),
        box(w / 2, 0.42, h - 0.18, w - 0.1, 0.36, 0.2, PALETTE.sofa),
        box(0.12, 0.3, h / 2, 0.16, 0.24, h - 0.15, PALETTE.sofa),
        box(w - 0.12, 0.3, h / 2, 0.16, 0.24, h - 0.15, PALETTE.sofa),
      ];
    case "etagere":
      return shelf(w, h, 1.5);
    case "plante":
      return [
        box(0.5, 0.15, 0.5, 0.36, 0.3, 0.36, PALETTE.pot, "cylinder"),
        box(0.5, 0.52, 0.5, 0.56, 0.5, 0.56, PALETTE.leaves[0], "sphere"),
        box(0.42, 0.74, 0.44, 0.34, 0.32, 0.34, PALETTE.leaves[1], "sphere"),
      ];
    case "comptoir_accueil":
      return [
        box(w / 2, 0.45, h / 2, w - 0.1, 0.9, h - 0.2, PALETTE.counter),
        box(w / 2, 0.93, h / 2, w - 0.02, 0.06, h - 0.1, PALETTE.counterTop),
      ];
    case "baie_serveur":
      return [
        box(0.5, 0.9, 0.5, 0.8, 1.8, 0.8, PALETTE.server),
        ...[0.5, 0.9, 1.3].map((y) =>
          box(0.5, y, 0.1, 0.5, 0.05, 0.02, PALETTE.led, "box"),
        ),
      ];
    case "machine_cafe":
      return [
        box(0.5, 0.45, 0.5, 0.6, 0.9, 0.6, PALETTE.deskTop),
        box(0.5, 0.95, 0.5, 0.5, 0.25, 0.5, PALETTE.coffee),
      ];
    default:
      return [
        box(
          w / 2,
          entry.height / 2,
          h / 2,
          w - 0.1,
          entry.height,
          h - 0.1,
          entry.color,
        ),
      ];
  }
}

/** Passe du repère de l'élément non tourné au repère de son emprise tournée (quart de tour horaire). */
function rotateLocal(
  part: LocalPart,
  w: number,
  h: number,
  rotation: Rotation,
): LocalPart {
  switch (rotation) {
    case 0:
      return part;
    case 90:
      return { ...part, x: h - part.z, z: part.x, sx: part.sz, sz: part.sx };
    case 180:
      return { ...part, x: w - part.x, z: h - part.z };
    case 270:
      return { ...part, x: part.z, z: w - part.x, sx: part.sz, sz: part.sx };
  }
}

/** Formes d'un objet du catalogue posé en (x, y) avec une rotation, dans le repère du monde. */
export function catalogParts(
  catalogKey: string,
  x: number,
  y: number,
  rotation: Rotation,
): Part[] {
  const entry = CATALOG[catalogKey];
  if (!entry) return [];
  return localParts(catalogKey).map((part) => {
    const turned = rotateLocal(part, entry.w, entry.h, rotation);
    return { ...turned, x: x + turned.x, z: y + turned.z };
  });
}

export function elementParts(element: MapElement): Part[] {
  return catalogParts(
    element.catalogKey,
    element.x,
    element.y,
    element.rotation,
  );
}

/** Emprise (tuiles) d'un élément après rotation. */
export function elementSize(catalogKey: string, rotation: Rotation) {
  const entry = CATALOG[catalogKey];
  return entry ? getFootprint(entry, rotation) : { w: 1, h: 1 };
}

/** Mur plein ou cloison vitrée sur une arête de tuile. */
export function wallParts(edge: Edge): Part[] {
  const glass = edge.kind === "glass";
  const h = WALL_HEIGHT_3D;
  const t = WALL_THICKNESS;
  const north = edge.side === "N";
  const center = north
    ? { x: edge.x + 0.5, z: edge.y }
    : { x: edge.x, z: edge.y + 0.5 };
  const size = (along: number, across: number) =>
    north ? { sx: along, sz: across } : { sx: across, sz: along };
  if (!glass)
    return [
      {
        shape: "box",
        ...center,
        y: h / 2,
        ...size(1 + t, t),
        sy: h,
        color: PALETTE.wall,
      },
    ];
  return [
    {
      shape: "box",
      ...center,
      y: h / 2,
      ...size(1, t * 0.4),
      sy: h - 0.08,
      color: PALETTE.glass,
      glass: true,
    },
    {
      shape: "box",
      ...center,
      y: h - 0.03,
      ...size(1 + t, t),
      sy: 0.06,
      color: PALETTE.glassFrame,
    },
    {
      shape: "box",
      ...center,
      y: 0.03,
      ...size(1 + t, t),
      sy: 0.06,
      color: PALETTE.glassFrame,
    },
  ];
}

/** Porte : un seuil au sol marque le passage. */
export function doorParts(edge: Edge): Part[] {
  const north = edge.side === "N";
  return [
    {
      shape: "box",
      x: north ? edge.x + 0.5 : edge.x,
      y: 0.006,
      z: north ? edge.y : edge.y + 0.5,
      sx: north ? 0.86 : 0.18,
      sy: 0.012,
      sz: north ? 0.18 : 0.86,
      color: PALETTE.threshold,
    },
  ];
}

/** Figurine posée au centre d'une tuile (affectation d'un poste, jamais une présence réelle). */
export function personParts(
  tileX: number,
  tileY: number,
  color: string,
): Part[] {
  const x = tileX + 0.5;
  const z = tileY + 0.5;
  return [
    {
      shape: "cylinder",
      x,
      y: 0.22,
      z,
      sx: 0.26,
      sy: 0.44,
      sz: 0.26,
      color: PALETTE.legs,
    },
    { shape: "rounded", x, y: 0.64, z, sx: 0.38, sy: 0.42, sz: 0.26, color },
    {
      shape: "sphere",
      x,
      y: 1.0,
      z,
      sx: 0.26,
      sy: 0.26,
      sz: 0.26,
      color: PALETTE.skin,
    },
  ];
}

/** Hauteur maximale atteinte par un ensemble de formes. */
export function partsTop(parts: readonly Part[]): number {
  return parts.reduce((top, part) => Math.max(top, part.y + part.sy / 2), 0);
}
