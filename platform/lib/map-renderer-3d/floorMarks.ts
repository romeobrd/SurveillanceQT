// Marquages peints au sol : contour discret de chaque pièce et nom de la pièce écrit par terre.
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import type { Zone } from "../map/schema";

const MARK_COLOR = "#cdd3da";
const LABEL_COLOR = "#8a94a0";
const LINE_WIDTH = 0.05;
const INSET = 0.18;

/** Liseré peint à l'intérieur de chaque rectangle de la pièce. */
function outline(zone: Zone, material: MeshBasicMaterial): Mesh[] {
  const meshes: Mesh[] = [];
  for (const rect of zone.rects) {
    const x0 = rect.x + INSET;
    const z0 = rect.y + INSET;
    const w = rect.w - 2 * INSET;
    const h = rect.h - 2 * INSET;
    if (w <= 0.3 || h <= 0.3) continue;
    const sides: Array<[number, number, number, number]> = [
      [x0 + w / 2, z0, w, LINE_WIDTH],
      [x0 + w / 2, z0 + h, w, LINE_WIDTH],
      [x0, z0 + h / 2, LINE_WIDTH, h],
      [x0 + w, z0 + h / 2, LINE_WIDTH, h],
    ];
    for (const [cx, cz, sx, sz] of sides) {
      const line = new Mesh(new PlaneGeometry(sx, sz), material);
      line.rotation.x = -Math.PI / 2;
      line.position.set(cx, 0.003, cz);
      meshes.push(line);
    }
  }
  return meshes;
}

/** Nom de la pièce, en capitales, peint près du bord avant (côté caméra) du premier rectangle. */
function label(zone: Zone): Mesh | null {
  const rect = zone.rects[0];
  if (rect.w < 2 || rect.h < 2) return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const text = zone.name.toUpperCase();
  const fontSize = 96;
  const font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
  context.font = font;
  const textWidth = Math.ceil(context.measureText(text).width) + 24;
  canvas.width = textWidth;
  canvas.height = Math.ceil(fontSize * 1.3);
  context.font = font;
  context.fillStyle = LABEL_COLOR;
  context.textBaseline = "middle";
  context.fillText(text, 12, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const aspect = canvas.width / canvas.height;
  let height = Math.min(0.6, Math.max(0.3, Math.min(rect.w, rect.h) * 0.14));
  let width = height * aspect;
  const maxWidth = rect.w - 2 * INSET - 0.4;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }
  const mesh = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(
    rect.x + INSET + 0.2 + width / 2,
    0.004,
    rect.y + rect.h - INSET - 0.15 - height / 2,
  );
  return mesh;
}

export function buildFloorMarks(zones: readonly Zone[]): Group {
  const group = new Group();
  const lineMaterial = new MeshBasicMaterial({ color: MARK_COLOR });
  for (const zone of zones) {
    for (const mesh of outline(zone, lineMaterial)) group.add(mesh);
    const name = label(zone);
    if (name) group.add(name);
  }
  return group;
}
