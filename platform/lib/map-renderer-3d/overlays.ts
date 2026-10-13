// Calques posés sur la carte : survol et sélection de zone, aperçus de l'éditeur (fantômes, sélection, arête…).
import {
  BoxGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Material,
  type Object3D,
} from "three";
import { catalogParts, elementSize, WALL_HEIGHT_3D } from "../map/models";
import type { EditOverlayData } from "../map/edit-overlay";
import type { Rect } from "../map/schema";
import { buildBatches, type SharedGeometries } from "./batches";

export const OVERLAY_COLORS = {
  good: "#2f9e44",
  bad: "#e03131",
  selected: "#e8590c",
  hover: "#ffffff",
  marquee: "#1c7ed6",
} as const;

/** Libère tout ce qu'un groupe de calques a créé (géométries et matériaux propres au calque). */
export function disposeOverlay(
  group: Object3D,
  keep: ReadonlySet<unknown>,
): void {
  group.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    if (object instanceof InstancedMesh) object.dispose();
    if (!keep.has(object.geometry)) object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials)
      if (!keep.has(material)) material.dispose();
  });
  group.clear();
}

/** Rectangle de tuiles posé à plat sur le sol, avec un contour épais. */
export function flatRect(
  rect: Rect,
  color: string,
  fillOpacity: number,
  outlineOpacity: number,
  y = 0.015,
  outlineWidth = 0.07,
): Group {
  const group = new Group();
  const fill = new Mesh(
    new PlaneGeometry(rect.w, rect.h),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: fillOpacity,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(rect.x + rect.w / 2, y, rect.y + rect.h / 2);
  fill.renderOrder = 2;
  group.add(fill);
  const lineMaterial = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: outlineOpacity,
    depthWrite: false,
  });
  const t = outlineWidth;
  const sides: Array<[number, number, number, number]> = [
    [rect.x + rect.w / 2, rect.y, rect.w + t, t],
    [rect.x + rect.w / 2, rect.y + rect.h, rect.w + t, t],
    [rect.x, rect.y + rect.h / 2, t, rect.h + t],
    [rect.x + rect.w, rect.y + rect.h / 2, t, rect.h + t],
  ];
  for (const [cx, cz, sx, sz] of sides) {
    const line = new Mesh(new BoxGeometry(sx, 0.01, sz), lineMaterial);
    line.position.set(cx, y + 0.005, cz);
    line.renderOrder = 3;
    group.add(line);
  }
  return group;
}

/** Calque de survol / sélection d'une zone. */
export function zoneHighlight(
  rects: readonly Rect[],
  mode: "hover" | "selected",
): Group {
  const group = new Group();
  for (const rect of rects) {
    group.add(
      mode === "selected"
        ? flatRect(rect, OVERLAY_COLORS.selected, 0.16, 0.95)
        : flatRect(rect, OVERLAY_COLORS.hover, 0.3, 0.9),
    );
  }
  return group;
}

/** Aperçus de l'éditeur. Les fantômes utilisent le matériau translucide fourni (partagé). */
export function editOverlay(
  overlay: EditOverlayData,
  geometries: SharedGeometries,
  ghostMaterial: Material,
): Group {
  const group = new Group();
  const ghostParts = [];
  for (const ghost of overlay.ghosts) {
    const { w, h } = elementSize(ghost.catalogKey, ghost.rotation);
    const color = ghost.valid ? OVERLAY_COLORS.good : OVERLAY_COLORS.bad;
    group.add(
      flatRect({ x: ghost.x, y: ghost.y, w, h }, color, 0.4, 0.95, 0.02),
    );
    ghostParts.push(
      ...catalogParts(ghost.catalogKey, ghost.x, ghost.y, ghost.rotation),
    );
  }
  for (const mesh of buildBatches(ghostParts, geometries, ghostMaterial, {
    shadows: false,
  })) {
    mesh.renderOrder = 4;
    group.add(mesh);
  }
  for (const rect of overlay.selection)
    group.add(flatRect(rect, OVERLAY_COLORS.selected, 0.18, 1, 0.025, 0.09));
  if (overlay.rect) {
    const color = overlay.rect.valid ? OVERLAY_COLORS.good : OVERLAY_COLORS.bad;
    group.add(flatRect(overlay.rect.rect, color, 0.28, 0.95, 0.025, 0.09));
  }
  if (overlay.marquee)
    group.add(
      flatRect(overlay.marquee, OVERLAY_COLORS.marquee, 0.18, 0.95, 0.03),
    );
  if (overlay.edge) {
    const { edge, valid } = overlay.edge;
    const color = valid ? OVERLAY_COLORS.good : OVERLAY_COLORS.bad;
    const north = edge.side === "N";
    const x = north ? edge.x + 0.5 : edge.x;
    const z = north ? edge.y : edge.y + 0.5;
    const pane = new Mesh(
      new BoxGeometry(north ? 1 : 0.04, WALL_HEIGHT_3D, north ? 0.04 : 1),
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    pane.position.set(x, WALL_HEIGHT_3D / 2, z);
    pane.renderOrder = 4;
    const bar = new Mesh(
      new BoxGeometry(north ? 1.04 : 0.14, 0.03, north ? 0.14 : 1.04),
      new MeshBasicMaterial({ color }),
    );
    bar.position.set(x, 0.02, z);
    group.add(pane, bar);
  }
  return group;
}
