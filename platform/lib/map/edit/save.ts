// Contrôle avant enregistrement (client ET serveur) et calcul des suppressions entre deux versions.
import { CATALOG } from "../catalog";
import { buildDoorKeepFree } from "../grid";
import {
  areAllZonesAccessible,
  findUnreachableComponents,
  getEntranceTiles,
  MAX_ENCLOSED_POCKET,
} from "../reachability";
import type { Layout } from "../schema";
import { validateLayout } from "../validate";
import { MAX_ZONE_NAME } from "./zones";

export const LIMITS = {
  maxElements: 3000,
  maxZones: 300,
  maxEdges: 20_000,
  maxJsonBytes: 900_000,
} as const;

export interface SaveProblem {
  code:
    | "invalid"
    | "no_zone"
    | "no_entrance"
    | "unreachable"
    | "near_door"
    | "too_large";
  detail?: string;
}

/** Problèmes qui interdisent l'enregistrement (liste vide = carte enregistrable). */
export function validateForSave(layout: Layout): SaveProblem[] {
  const problems: SaveProblem[] = [];
  if (
    layout.elements.length > LIMITS.maxElements ||
    layout.zones.length > LIMITS.maxZones ||
    layout.walls.length + layout.doors.length > LIMITS.maxEdges
  ) {
    return [{ code: "too_large" }];
  }
  for (const detail of validateLayout(layout))
    problems.push({ code: "invalid", detail });
  for (const zone of layout.zones) {
    if (zone.name.length > MAX_ZONE_NAME)
      problems.push({
        code: "invalid",
        detail: `nom de zone trop long : ${zone.id}`,
      });
  }
  if (layout.zones.length === 0) problems.push({ code: "no_zone" });
  if (getEntranceTiles(layout).length === 0)
    problems.push({ code: "no_entrance" });
  else {
    // Toute pièce doit être accessible, et aucune partie de pièce ne doit être coupée du reste.
    // Une petite alcôve fermée (moins de MAX_ENCLOSED_POCKET tuiles) est tolérée.
    const isolated = findUnreachableComponents(layout).filter(
      (size) => size >= MAX_ENCLOSED_POCKET,
    );
    if (isolated.length > 0 || !areAllZonesAccessible(layout)) {
      problems.push({
        code: "unreachable",
        detail: String(isolated.reduce((sum, size) => sum + size, 0)),
      });
    }
  }
  const keepFree = buildDoorKeepFree(layout);
  const blocking = layout.elements.some((element) => {
    const entry = CATALOG[element.catalogKey];
    if (!entry) return false;
    const w =
      element.rotation === 90 || element.rotation === 270 ? entry.h : entry.w;
    const h =
      element.rotation === 90 || element.rotation === 270 ? entry.w : entry.h;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const x = element.x + dx;
        const y = element.y + dy;
        if (
          x < layout.width &&
          y < layout.height &&
          keepFree[y * layout.width + x]
        )
          return true;
      }
    }
    return false;
  });
  if (blocking) problems.push({ code: "near_door" });
  return problems;
}

export interface Removals {
  removedZoneKeys: string[];
  removedWorkstationKeys: string[];
}

/** Zones et postes de travail présents dans l'ancienne carte et absents de la nouvelle. */
export function computeRemovals(previous: Layout, next: Layout): Removals {
  const keptZones = new Set(next.zones.map((zone) => zone.id));
  const keptStations = new Set(
    next.elements
      .filter((element) => CATALOG[element.catalogKey]?.isWorkstation)
      .map((element) => element.id),
  );
  return {
    removedZoneKeys: previous.zones
      .filter((zone) => !keptZones.has(zone.id))
      .map((zone) => zone.id),
    removedWorkstationKeys: previous.elements
      .filter(
        (element) =>
          CATALOG[element.catalogKey]?.isWorkstation &&
          !keptStations.has(element.id),
      )
      .map((element) => element.id),
  };
}
