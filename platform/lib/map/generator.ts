// Génération aléatoire déterministe d'un aménagement : même seed = même carte.
import { partition, rectBoundaryEdges, sharedEdges } from "./bsp";
import { furnishLayout } from "./furnish";
import { createRng, type Rng } from "./prng";
import {
  LayoutSchema,
  MAP_FORMAT_VERSION,
  type Edge,
  type Layout,
  type Rect,
  type Zone,
  type ZoneType,
} from "./schema";
import { ZONE_FLOOR_COLORS, ZONE_LABELS } from "./zoneTypes";

export interface GenerateOptions {
  /** Largeur en tuiles (20 à 40 par défaut, tirée au sort si absente). */
  width?: number;
  height?: number;
}

const MIN_SIZE = 20;
const MAX_SIZE = 40;
const MIN_ROOMS = 7;
const MAX_ATTEMPTS = 50;

const edgeKey = (edge: Edge) => `${edge.side}:${edge.x}:${edge.y}`;

/** Associe un type à chaque pièce : l'accueil touche le bord sud, les grandes pièces sont les espaces communs. */
function assignTypes(rng: Rng, rooms: Rect[], height: number): ZoneType[] {
  const types: ZoneType[] = new Array(rooms.length);
  const bottom = rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room }) => room.y + room.h === height);
  types[rng.pick(bottom).index] = "accueil";

  const remaining = rooms
    .map((room, index) => ({ area: room.w * room.h, index }))
    .filter(({ index }) => !types[index])
    .sort((a, b) => b.area - a.area || a.index - b.index);

  const fixed: ZoneType[] = ["open_space", "salle_reunion", "cafeteria"];
  const small: ZoneType[] = ["reserve", "salle_serveur"];
  remaining.forEach((entry, position) => {
    const fromEnd = remaining.length - 1 - position;
    if (position < fixed.length) types[entry.index] = fixed[position];
    else if (fromEnd < small.length) types[entry.index] = small[fromEnd];
    else if (position === fixed.length)
      types[entry.index] = "bureau_individuel";
    else {
      const roll = rng.next();
      types[entry.index] =
        roll < 0.3
          ? "open_space"
          : roll < 0.8
            ? "bureau_individuel"
            : "salle_reunion";
    }
  });
  return types;
}

function attemptLayout(
  seed: number,
  attemptSeed: number,
  options: GenerateOptions,
): Layout | null {
  const rng = createRng(attemptSeed);
  const width = options.width ?? rng.int(MIN_SIZE, MAX_SIZE);
  const height = options.height ?? rng.int(MIN_SIZE, MAX_SIZE);

  const rects = partition(
    rng,
    { x: 0, y: 0, w: width, h: height },
    { minRoom: 4, maxRoom: 11 },
  );
  if (rects.length < MIN_ROOMS) return null;
  const types = assignTypes(rng, rects, height);

  const counters = new Map<ZoneType, number>();
  const zones: Zone[] = rects.map((rect, index) => {
    const type = types[index];
    const n = (counters.get(type) ?? 0) + 1;
    counters.set(type, n);
    return {
      id: `z${index + 1}`,
      name:
        type === "accueil" ? ZONE_LABELS[type] : `${ZONE_LABELS[type]} ${n}`,
      type,
      rects: [rect],
      floorColor: ZONE_FLOOR_COLORS[type],
    };
  });

  const walls = new Map<string, Edge>();
  for (const rect of rects) {
    for (const edge of rectBoundaryEdges(rect)) walls.set(edgeKey(edge), edge);
  }

  // Portes entre pièces : arbre couvrant (tout est connecté) + quelques boucles
  const links: Array<{ a: number; b: number; edges: Edge[] }> = [];
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const edges = sharedEdges(rects[a], rects[b]);
      if (edges.length > 0) links.push({ a, b, edges });
    }
  }
  const parent = rects.map((_, index) => index);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const doors: Edge[] = [];
  const openDoor = (edges: Edge[]) => {
    const door = rng.pick(edges);
    walls.delete(edgeKey(door));
    doors.push(door);
  };
  for (const link of rng.shuffle(links)) {
    if (find(link.a) !== find(link.b)) {
      parent[find(link.a)] = find(link.b);
      openDoor(link.edges);
    } else if (rng.chance(0.25)) {
      openDoor(link.edges);
    }
  }
  if (new Set(rects.map((_, index) => find(index))).size !== 1) return null;

  // Entrée : une porte sur le bord sud de l'accueil
  const reception = rects[types.indexOf("accueil")];
  const entranceX = rng.int(reception.x, reception.x + reception.w - 1);
  const entrance: Edge = { x: entranceX, y: height, side: "N" };
  walls.delete(edgeKey(entrance));
  doors.push(entrance);

  const base: Layout = {
    version: MAP_FORMAT_VERSION,
    width,
    height,
    seed,
    zones,
    walls: [...walls.values()],
    doors,
    elements: [],
  };
  return { ...base, elements: furnishLayout(base, rng) };
}

/** Génère un aménagement complet (pièces, murs, portes, mobilier) à partir d'un seed. */
export function generateLayout(
  seed: number,
  options: GenerateOptions = {},
): Layout {
  const normalizedSeed = seed >>> 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Seed dérivé pour les nouvelles tentatives : le résultat reste déterministe
    const attemptSeed = (normalizedSeed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    const layout = attemptLayout(normalizedSeed, attemptSeed, options);
    if (layout) return LayoutSchema.parse(layout);
  }
  throw new Error(`Impossible de générer une carte pour le seed ${seed}`);
}
