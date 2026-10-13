// Format de carte partagé par le générateur, l'éditeur et le moteur de rendu (SPEC §5).
import { z } from "zod";

export const MAP_FORMAT_VERSION = 1;

export const ZONE_TYPES = [
  "open_space",
  "bureau_individuel",
  "salle_reunion",
  "cafeteria",
  "reserve",
  "salle_serveur",
  "accueil",
] as const;

export const RectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

export const ZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(ZONE_TYPES),
  rects: z.array(RectSchema).min(1),
  floorColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

/**
 * Arête de tuile : "N" = côté nord de la tuile (x, y), "W" = côté ouest.
 * Les arêtes du bord sud/est de la carte utilisent donc y = height ou x = width.
 */
export const EdgeSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  side: z.enum(["N", "W"]),
  /** Nature d'un mur : plein par défaut, ou cloison vitrée (translucide, mais infranchissable). */
  kind: z.enum(["solid", "glass"]).optional(),
});

export const RotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

/** Position (x, y) = coin haut-gauche de l'emprise après rotation. */
export const ElementSchema = z.object({
  id: z.string().min(1),
  catalogKey: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  rotation: RotationSchema,
  zoneId: z.string().min(1),
});

export const LayoutSchema = z.object({
  version: z.literal(MAP_FORMAT_VERSION),
  width: z.number().int().min(4).max(100),
  height: z.number().int().min(4).max(100),
  seed: z.number().int().optional(),
  zones: z.array(ZoneSchema),
  /** Murs pleins. Une arête de porte n'apparaît jamais ici. */
  walls: z.array(EdgeSchema),
  doors: z.array(EdgeSchema),
  elements: z.array(ElementSchema),
});

export type ZoneType = (typeof ZONE_TYPES)[number];
export type Rect = z.infer<typeof RectSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Rotation = z.infer<typeof RotationSchema>;
export type MapElement = z.infer<typeof ElementSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
