// Regroupement des formes en maillages instanciés : un seul appel de dessin par type de forme, quelle que soit la taille de la carte.
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Part, PartShape } from "../map/models";

/** Géométries unitaires partagées (créées une fois, mises à l'échelle par instance). */
export interface SharedGeometries {
  box: BufferGeometry;
  rounded: BufferGeometry;
  cylinder: BufferGeometry;
  sphere: BufferGeometry;
}

export function createGeometries(): SharedGeometries {
  return {
    box: new BoxGeometry(1, 1, 1),
    rounded: new RoundedBoxGeometry(1, 1, 1, 3, 0.12),
    cylinder: new CylinderGeometry(0.5, 0.5, 1, 20),
    sphere: new SphereGeometry(0.5, 20, 14),
  };
}

export function disposeGeometries(geometries: SharedGeometries): void {
  for (const geometry of Object.values(geometries)) geometry.dispose();
}

const SHAPES: PartShape[] = ["box", "rounded", "cylinder", "sphere"];

/**
 * Crée un maillage instancié par type de forme. La couleur est portée par chaque instance ;
 * le matériau est partagé (seul le maillage est à libérer).
 */
export function buildBatches(
  parts: readonly Part[],
  geometries: SharedGeometries,
  material: Material,
  options: { shadows: boolean },
): InstancedMesh[] {
  const meshes: InstancedMesh[] = [];
  const matrix = new Matrix4();
  const color = new Color();
  for (const shape of SHAPES) {
    const ofShape = parts.filter((part) => part.shape === shape);
    if (ofShape.length === 0) continue;
    const mesh = new InstancedMesh(geometries[shape], material, ofShape.length);
    ofShape.forEach((part, index) => {
      matrix.makeScale(part.sx, part.sy, part.sz);
      matrix.setPosition(part.x, part.y, part.z);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(part.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    // Propriétaire de chaque instance : retrouve l'élément de la carte touché par un rayon
    mesh.userData.owners = ofShape.map((part) => part.owner ?? null);
    mesh.castShadow = options.shadows;
    mesh.receiveShadow = options.shadows;
    meshes.push(mesh);
  }
  return meshes;
}
