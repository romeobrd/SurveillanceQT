import type { Zone } from "../map/schema";

/** Centre (en coordonnées de grille) du premier rectangle d'une zone. */
export function getZoneCenter(zone: Zone): { x: number; y: number } {
  const rect = zone.rects[0];
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}
