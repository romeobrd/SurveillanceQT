// Construction de la scène à dessiner : murs, portes, éléments et personnages triés en profondeur.
import { CATALOG, getFootprint } from "./catalog";
import { sortByDepth, type DepthItem, type Footprint } from "./depth";
import { gridToScreen } from "./iso";
import type { Edge, Layout } from "./schema";
import { findSeatTile } from "./seats";
import type { WorldRect } from "./viewport";

/** Hauteur d'une unité de hauteur du catalogue, en pixels (à zoom 1). */
export const HEIGHT_UNIT = 28;
export const WALL_HEIGHT = 1.3;

export interface PersonMarker {
  /** Identifiant de l'élément "poste" occupé. */
  workstationElementId: string;
  /** Couleur de vêtement (#rrggbb), purement décorative. */
  color: string;
}

export type SceneItem = DepthItem &
  (
    | { kind: "wall"; edge: Edge }
    | { kind: "door"; edge: Edge }
    | {
        kind: "element";
        elementId: string;
        catalogKey: string;
        rotation: 0 | 90 | 180 | 270;
      }
    | { kind: "person"; color: string }
  );

const LAYER = { wall: 0, door: 0, element: 1, person: 2 } as const;

function edgeFootprint(edge: Edge): Footprint {
  return edge.side === "N"
    ? { x: edge.x, y: edge.y, w: 1, h: 0 }
    : { x: edge.x, y: edge.y, w: 0, h: 1 };
}

export function buildScene(
  layout: Layout,
  people: readonly PersonMarker[],
): SceneItem[] {
  const items: SceneItem[] = [];
  for (const edge of layout.walls) {
    items.push({
      kind: "wall",
      edge,
      footprint: edgeFootprint(edge),
      layer: LAYER.wall,
    });
  }
  for (const edge of layout.doors) {
    items.push({
      kind: "door",
      edge,
      footprint: edgeFootprint(edge),
      layer: LAYER.door,
    });
  }
  for (const element of layout.elements) {
    const entry = CATALOG[element.catalogKey];
    if (!entry) continue;
    const { w, h } = getFootprint(entry, element.rotation);
    items.push({
      kind: "element",
      elementId: element.id,
      catalogKey: element.catalogKey,
      rotation: element.rotation,
      footprint: { x: element.x, y: element.y, w, h },
      layer: LAYER.element,
    });
  }
  const byId = new Map(layout.elements.map((element) => [element.id, element]));
  for (const person of people) {
    const workstation = byId.get(person.workstationElementId);
    const seat = workstation ? findSeatTile(layout, workstation) : null;
    if (!seat) continue;
    items.push({
      kind: "person",
      color: person.color,
      footprint: { x: seat.x, y: seat.y, w: 1, h: 1 },
      layer: LAYER.person,
    });
  }
  return sortByDepth(items);
}

/** Rectangle monde (px) occupé par une carte de width × height tuiles, murs compris. */
export function getWorldBounds(layout: Layout): WorldRect {
  const corners = [
    gridToScreen(0, 0),
    gridToScreen(layout.width, 0),
    gridToScreen(layout.width, layout.height),
    gridToScreen(0, layout.height),
  ];
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)) - WALL_HEIGHT * HEIGHT_UNIT,
    maxY: Math.max(...corners.map((c) => c.y)),
  };
}
