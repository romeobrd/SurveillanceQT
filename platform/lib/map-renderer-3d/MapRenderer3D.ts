// Moteur de rendu 3D de la carte (Three.js, composant client uniquement).
// Même contrat que l'ancien moteur isométrique : l'éditeur et les pages n'en voient que l'interface publique.
// Toute la logique (caméra, modèles, zones) est dans lib/map, en code pur ; ici on ne fait qu'afficher.
import {
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Frustum,
  Group,
  InstancedMesh,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import {
  cameraPosition,
  clampOrbit,
  easeInOutCubic,
  fitCamera,
  focusOn,
  lerpOrbit,
  fitDistance,
  orbitBy,
  panBetween,
  panScreen,
  rayToGround,
  zoomToward,
  type GroundBounds,
  type OrbitCamera,
} from "../map/camera3d";
import { mixHex } from "../map/color";
import type { EditOverlayData } from "../map/edit-overlay";
import {
  catalogParts,
  doorParts,
  partsTop,
  personParts,
  wallParts,
  type Part,
} from "../map/models";
import { buildScene, type PersonMarker } from "../map/scene";
import type { Layout } from "../map/schema";
import { buildZoneLookup, zoneIdAtTile } from "../map/zones";
import {
  buildBatches,
  createGeometries,
  disposeGeometries,
  type SharedGeometries,
} from "./batches";
import { buildFloorMarks } from "./floorMarks";
import { disposeOverlay, editOverlay, zoneHighlight } from "./overlays";
import type {
  BenchmarkResult,
  EditorBridge,
  EditorPointer,
  MapRendererOptions,
  RenderQuality,
} from "./types";

export type {
  BenchmarkResult,
  EditorBridge,
  EditorPointer,
  MapRendererOptions,
  RenderQuality,
} from "./types";

const FOV = 35;
const CLICK_TOLERANCE_PX = 5;
const ORBIT_SPEED = 0.008;
const KEY_ROTATE = Math.PI / 8;
const BASE_COLOR = "#fbfbfa";
const BASE_THICKNESS = 0.35;
/** Au-delà de ce temps moyen par image, le moteur passe en qualité basse (sans ombres). */
const SLOW_FRAME_MS = 28;

interface ItemBounds {
  box: Box3;
}

export class MapRenderer3D {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera3d = new PerspectiveCamera(FOV, 1, 0.1, 2000);
  private readonly sun = new DirectionalLight("#ffffff", 2.4);
  private readonly geometries: SharedGeometries = createGeometries();
  private readonly solidMaterial = new MeshStandardMaterial({
    roughness: 0.78,
    metalness: 0,
  });
  private readonly glassMaterial = new MeshStandardMaterial({
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  private readonly ghostMaterial = new MeshStandardMaterial({
    roughness: 0.6,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private readonly floorMaterials = new Map<string, MeshStandardMaterial>();
  /** Ressources partagées : jamais libérées par le nettoyage d'un calque. */
  private readonly shared: Set<unknown>;

  private readonly mapGroup = new Group();
  private readonly highlightGroup = new Group();
  private readonly editGroup = new Group();

  private editor: EditorBridge | null = null;
  private editorCapture = false;
  private spaceHeld = false;
  private lastOverlayKey = "";

  private layout: Layout | null = null;
  private zoneLookup: Int16Array = new Int16Array(0);
  private bounds: GroundBounds = {
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    height: 1,
  };
  private items: ItemBounds[] = [];
  private orbit: OrbitCamera = {
    targetX: 0,
    targetZ: 0,
    distance: 10,
    azimuth: Math.PI / 4,
    polar: 0.95,
  };
  private hoverZoneId: string | null = null;
  private hoverElementId: string | null = null;
  private pendingHover: PointerEvent | null = null;
  private animation: {
    from: OrbitCamera;
    to: OrbitCamera;
    start: number;
    duration: number;
  } | null = null;
  private selectedZoneId: string | null = null;
  private emphasizedZoneIds: ReadonlySet<string> = new Set();
  private quality: RenderQuality = "high";
  /** Largeur (px) masquée à droite par un panneau flottant : la vue se centre dans l'espace libre. */
  private insetRight = 0;
  private slowFrames = 0;
  private measuredFrames = 0;

  private dirty = true;
  private destroyed = false;
  private frameHandle = 0;
  private visibleItems = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved = false;
  private dragMode: "pan" | "orbit" = "pan";
  private pinchDistance = 0;
  private readonly raycaster = new Raycaster();

  private constructor(
    renderer: WebGLRenderer,
    private readonly options: MapRendererOptions,
  ) {
    this.renderer = renderer;
    this.shared = new Set<unknown>([
      ...Object.values(this.geometries),
      this.solidMaterial,
      this.glassMaterial,
      this.ghostMaterial,
    ]);

    // Lumière douce venant du ciel et du sol, plus un « soleil » qui porte les ombres
    this.scene.add(new HemisphereLight("#ffffff", "#c9d0da", 1.9));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.mapGroup, this.highlightGroup, this.editGroup);

    const canvas = this.renderer.domElement;
    canvas.style.touchAction = "none";
    canvas.style.display = "block";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.onContextMenu);
    options.host.addEventListener("keydown", this.onKeyDown);
    options.host.addEventListener("keyup", this.onKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.host);
    this.resize();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  static async create(options: MapRendererOptions): Promise<MapRenderer3D> {
    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    options.host.appendChild(renderer.domElement);
    return new MapRenderer3D(renderer, options);
  }

  /**
   * Charge une carte et les occupants des postes. La vue est recadrée sauf si `keepView`
   * (mises à jour de l'éditeur, où l'utilisateur garde sa caméra).
   */
  setScene(
    layout: Layout,
    people: readonly PersonMarker[],
    options: { keepView?: boolean } = {},
  ): void {
    this.layout = layout;
    this.zoneLookup = buildZoneLookup(layout);
    this.hoverZoneId = null;
    disposeOverlay(this.mapGroup, this.shared);

    const solid: Part[] = [];
    const glass: Part[] = [];
    this.items = [];
    let top = 1;
    for (const item of buildScene(layout, people)) {
      const f = item.footprint;
      const parts =
        item.kind === "wall"
          ? wallParts(item.edge)
          : item.kind === "door"
            ? doorParts(item.edge)
            : item.kind === "element"
              ? catalogParts(item.catalogKey, f.x, f.y, item.rotation).map(
                  (part) => ({ ...part, owner: item.elementId }),
                )
              : personParts(f.x, f.y, item.color);
      for (const part of parts) (part.glass ? glass : solid).push(part);
      const box = new Box3();
      for (const part of parts) {
        box.expandByPoint(
          new Vector3(
            part.x - part.sx / 2,
            part.y - part.sy / 2,
            part.z - part.sz / 2,
          ),
        );
        box.expandByPoint(
          new Vector3(
            part.x + part.sx / 2,
            part.y + part.sy / 2,
            part.z + part.sz / 2,
          ),
        );
      }
      this.items.push({ box });
      top = Math.max(top, partsTop(parts));
    }

    this.mapGroup.add(this.buildBase(layout), this.buildFloors(layout));
    this.mapGroup.add(this.buildGrid(layout), buildFloorMarks(layout.zones));
    const shadows = this.quality === "high";
    for (const mesh of buildBatches(
      solid,
      this.geometries,
      this.solidMaterial,
      {
        shadows,
      },
    ))
      this.mapGroup.add(mesh);
    for (const mesh of buildBatches(
      glass,
      this.geometries,
      this.glassMaterial,
      {
        shadows: false,
      },
    )) {
      mesh.renderOrder = 1;
      this.mapGroup.add(mesh);
    }

    this.bounds = {
      minX: 0,
      maxX: layout.width,
      minZ: 0,
      maxZ: layout.height,
      height: top,
    };
    this.placeSun();
    this.redrawHighlights();
    if (options.keepView) this.setOrbit(this.orbit);
    else this.resetView();
  }

  /** Branche (ou débranche) l'éditeur : les gestes lui sont transmis au lieu de sélectionner des zones. */
  setEditor(bridge: EditorBridge | null): void {
    this.editor = bridge;
    this.editorCapture = false;
    if (!bridge) this.setEditOverlay(null);
    this.setHover(null);
  }

  /** Fantômes, sélection, arête visée… dessinés par-dessus la carte. */
  setEditOverlay(overlay: EditOverlayData | null): void {
    const key = JSON.stringify(overlay);
    if (key === this.lastOverlayKey) return;
    this.lastOverlayKey = key;
    disposeOverlay(this.editGroup, this.shared);
    if (overlay)
      this.editGroup.add(
        editOverlay(overlay, this.geometries, this.ghostMaterial),
      );
    this.dirty = true;
  }

  /** Coordonnées de grille (fractionnaires) du point du sol sous un point de l'écran. */
  clientToGrid(clientX: number, clientY: number): { x: number; y: number } {
    const hit = this.groundAt(clientX, clientY);
    return hit ? { x: hit.x, y: hit.z } : { x: -1, y: -1 };
  }

  /** Tuile sous un point de l'écran (null hors du plan). */
  clientToTile(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    if (!this.layout) return null;
    const grid = this.clientToGrid(clientX, clientY);
    const x = Math.floor(grid.x);
    const y = Math.floor(grid.y);
    return x >= 0 && y >= 0 && x < this.layout.width && y < this.layout.height
      ? { x, y }
      : null;
  }

  /** Point de la grille (fractionnaire, au sol) en pixels relatifs au canvas (utile aux tests). */
  getGridScreenPoint(gx: number, gy: number): { x: number; y: number } {
    return this.project(new Vector3(gx, 0, gy));
  }

  /** Centre d'une tuile en pixels relatifs au canvas (utile aux tests). */
  getTileScreenCenter(x: number, y: number): { x: number; y: number } {
    return this.getGridScreenPoint(x + 0.5, y + 0.5);
  }

  setSelectedZone(zoneId: string | null): void {
    if (zoneId === this.selectedZoneId) return;
    this.selectedZoneId = zoneId;
    this.redrawHighlights();
  }

  /** Pièces mises en évidence (ex. où travaille l'équipe du projet affiché). */
  setEmphasizedZones(zoneIds: readonly string[]): void {
    const next = new Set(zoneIds);
    if (
      next.size === this.emphasizedZoneIds.size &&
      [...next].every((id) => this.emphasizedZoneIds.has(id))
    )
      return;
    this.emphasizedZoneIds = next;
    this.redrawHighlights();
  }

  zoomBy(factor: number): void {
    this.setOrbit(zoomToward(this.orbit, factor, null, this.maxDistance()));
  }

  /** Réserve une bande à droite (panneau posé sur la carte) : recadrage et centre de la vue en tiennent compte. */
  setViewInset(rightPx: number): void {
    const inset = Math.max(0, Math.min(rightPx, this.viewWidth * 0.6));
    if (inset === this.insetRight) return;
    this.insetRight = inset;
    this.resize();
    // Changement de disposition (rare) : on recadre la carte dans le nouvel espace libre
    if (this.layout) this.resetView();
  }

  /** La caméra vole jusqu'à une pièce (instantané si l'utilisateur préfère réduire les animations). */
  flyToZone(zoneId: string): void {
    const zone = this.layout?.zones.find(
      (candidate) => candidate.id === zoneId,
    );
    if (!zone) return;
    const minX = Math.min(...zone.rects.map((r) => r.x));
    const minY = Math.min(...zone.rects.map((r) => r.y));
    const maxX = Math.max(...zone.rects.map((r) => r.x + r.w));
    const maxY = Math.max(...zone.rects.map((r) => r.y + r.h));
    const to = clampOrbit(
      focusOn(this.orbit, { x: minX, y: minY, w: maxX - minX, h: maxY - minY }),
      this.bounds,
      this.maxDistance(),
    );
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      this.setOrbit(to);
      return;
    }
    this.animation = {
      from: this.orbit,
      to,
      start: performance.now(),
      duration: 550,
    };
    this.dirty = true;
  }

  /** Élément de la carte (bureau, étagère…) visible sous un point de l'écran, ou null. */
  pickElement(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera3d);
    const meshes = this.mapGroup.children.filter(
      (child): child is InstancedMesh =>
        child instanceof InstancedMesh && Array.isArray(child.userData.owners),
    );
    for (const hit of this.raycaster.intersectObjects(meshes, false)) {
      const owners = hit.object.userData.owners as Array<string | null>;
      if (hit.instanceId === undefined) continue;
      // Le premier objet touché masque ceux de derrière : on s'arrête dès qu'on touche quelque chose
      return owners[hit.instanceId] ?? null;
    }
    return null;
  }

  /** Tourne la vue autour du point visé (radians, sens trigonométrique vu de dessus). */
  rotateBy(angle: number): void {
    this.setOrbit(orbitBy(this.orbit, angle, 0));
  }

  resetView(): void {
    const fitted = fitCamera(this.bounds, this.fovY(), this.aspect());
    this.setOrbit({ ...fitted, distance: this.tightDistance(fitted) });
  }

  /**
   * Distance la plus courte qui garde les coins de la carte à l'écran (avec une marge) : la sphère
   * englobante utilisée par fitCamera est trop prudente pour une carte vue de trois quarts.
   */
  private tightDistance(orbit: OrbitCamera): number {
    const { maxX, maxZ, height } = this.bounds;
    const corners = [0, maxX].flatMap((x) =>
      [0, maxZ].flatMap((z) => [0, height].map((y) => new Vector3(x, y, z))),
    );
    // Espace libre (hors panneau) en coordonnées normalisées : centré en -inset/largeur
    const centerX = -this.insetRight / this.viewWidth;
    const halfWidth = 1 - this.insetRight / this.viewWidth;
    const fits = (distance: number) => {
      this.applyOrbit({ ...orbit, distance });
      return corners.every((corner) => {
        const ndc = corner.clone().project(this.camera3d);
        return (
          Math.abs(ndc.x - centerX) <= halfWidth * 0.92 &&
          Math.abs(ndc.y) <= 0.9 &&
          ndc.z < 1
        );
      });
    };
    let low = 1;
    let high = orbit.distance;
    if (!fits(high)) return high;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (fits(middle)) high = middle;
      else low = middle;
    }
    return high;
  }

  /** Position du centre d'une zone, en pixels relatifs au canvas (utile aux tests). */
  getZoneScreenCenter(zoneId: string): { x: number; y: number } | null {
    const zone = this.layout?.zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    const rect = zone.rects[0];
    return this.getGridScreenPoint(rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  /** Position écran d'un point du sol, ou null s'il est derrière la caméra (pour les panneaux flottants). */
  projectGround(
    gx: number,
    gy: number,
    height = 0,
  ): { x: number; y: number } | null {
    const point = new Vector3(gx, height, gy);
    const view = point.clone().applyMatrix4(this.camera3d.matrixWorldInverse);
    if (view.z > 0) return null;
    return this.project(point);
  }

  getStats() {
    const fit = fitDistance(this.bounds, this.fovY(), this.aspect());
    return {
      visibleItems: this.visibleItems,
      totalItems: this.items.length,
      // Zoom relatif : 1 = carte entière à l'écran, plus grand = plus près
      zoom: fit / this.orbit.distance,
      quality: this.quality,
    };
  }

  getQuality(): RenderQuality {
    return this.quality;
  }

  /** Qualité haute (ombres, pleine résolution) ou basse (machines modestes). */
  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    const high = quality === "high";
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.renderer.setPixelRatio(
      high ? Math.min(window.devicePixelRatio || 1, 2) : 1,
    );
    this.mapGroup.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = high && object.material === this.solidMaterial;
        object.receiveShadow = high;
      }
    });
    for (const material of [
      this.solidMaterial,
      ...this.floorMaterials.values(),
    ])
      material.needsUpdate = true;
    this.resize();
    this.dirty = true;
  }

  /** Mesure le temps de rendu par image en tournant autour de la carte. */
  benchmark(frames = 120): BenchmarkResult {
    const initial = this.orbit;
    const durations: number[] = [];
    for (let i = 0; i < frames; i++) {
      this.applyOrbit(orbitBy(initial, (i / frames) * Math.PI * 0.5, 0));
      const start = performance.now();
      this.countVisible();
      this.renderer.render(this.scene, this.camera3d);
      durations.push(performance.now() - start);
    }
    this.setOrbit(initial);
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      frames,
      averageMs: durations.reduce((sum, d) => sum + d, 0) / frames,
      p95Ms: sorted[Math.floor(frames * 0.95)],
      visibleItems: this.visibleItems,
      totalItems: this.items.length,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.options.host.removeEventListener("keydown", this.onKeyDown);
    this.options.host.removeEventListener("keyup", this.onKeyUp);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("contextmenu", this.onContextMenu);
    for (const group of [this.mapGroup, this.highlightGroup, this.editGroup])
      disposeOverlay(group, this.shared);
    disposeGeometries(this.geometries);
    for (const material of [
      this.solidMaterial,
      this.glassMaterial,
      this.ghostMaterial,
      ...this.floorMaterials.values(),
    ])
      material.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---- Construction de la scène ----

  /** Socle blanc sous la carte : effet « maquette » posée sur la table. */
  private buildBase(layout: Layout): Mesh {
    const base = new Mesh(
      new BoxGeometry(layout.width + 0.6, BASE_THICKNESS, layout.height + 0.6),
      this.floorMaterial(BASE_COLOR),
    );
    base.position.set(
      layout.width / 2,
      -BASE_THICKNESS / 2 - 0.002,
      layout.height / 2,
    );
    base.receiveShadow = this.quality === "high";
    return base;
  }

  /** Sols des pièces : la couleur de la zone, très adoucie (rendu clair). */
  private buildFloors(layout: Layout): Group {
    const group = new Group();
    for (const zone of layout.zones) {
      const material = this.floorMaterial(
        mixHex(zone.floorColor, "#ffffff", 0.8),
      );
      for (const rect of zone.rects) {
        const floor = new Mesh(new PlaneGeometry(rect.w, rect.h), material);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(rect.x + rect.w / 2, 0, rect.y + rect.h / 2);
        floor.receiveShadow = this.quality === "high";
        group.add(floor);
      }
    }
    return group;
  }

  /** Quadrillage discret des tuiles (repère pour l'aménagement). */
  private buildGrid(layout: Layout): LineSegments {
    const positions: number[] = [];
    for (const zone of layout.zones) {
      for (const rect of zone.rects) {
        for (let i = 1; i < rect.w; i++)
          positions.push(
            rect.x + i,
            0.003,
            rect.y,
            rect.x + i,
            0.003,
            rect.y + rect.h,
          );
        for (let j = 1; j < rect.h; j++)
          positions.push(
            rect.x,
            0.003,
            rect.y + j,
            rect.x + rect.w,
            0.003,
            rect.y + j,
          );
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: "#64748b",
        transparent: true,
        opacity: 0.05,
      }),
    );
  }

  private floorMaterial(color: string): MeshStandardMaterial {
    let material = this.floorMaterials.get(color);
    if (!material) {
      material = new MeshStandardMaterial({
        color: new Color(color),
        roughness: 0.92,
      });
      this.floorMaterials.set(color, material);
      this.shared.add(material);
    }
    return material;
  }

  /** Le soleil vient du haut à gauche ; sa zone d'ombre couvre toute la carte. */
  private placeSun(): void {
    const { maxX, maxZ, height } = this.bounds;
    const cx = maxX / 2;
    const cz = maxZ / 2;
    const size = Math.max(maxX, maxZ);
    this.sun.position.set(
      cx - size * 0.35,
      size * 0.9 + height,
      cz + size * 0.15,
    );
    this.sun.target.position.set(cx, 0, cz);
    const half = size * 0.75;
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -half;
    shadowCamera.right = half;
    shadowCamera.top = half;
    shadowCamera.bottom = -half;
    shadowCamera.near = 0.5;
    shadowCamera.far = size * 3 + height;
    shadowCamera.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }

  private redrawHighlights(): void {
    disposeOverlay(this.highlightGroup, this.shared);
    const find = (id: string | null) =>
      this.layout?.zones.find((zone) => zone.id === id);
    for (const zone of this.layout?.zones ?? []) {
      if (
        this.emphasizedZoneIds.has(zone.id) &&
        zone.id !== this.selectedZoneId
      )
        this.highlightGroup.add(zoneHighlight(zone.rects, "emphasis"));
    }
    const selected = find(this.selectedZoneId);
    if (selected)
      this.highlightGroup.add(zoneHighlight(selected.rects, "selected"));
    const hovered = find(this.hoverZoneId);
    if (hovered && hovered.id !== this.selectedZoneId)
      this.highlightGroup.add(zoneHighlight(hovered.rects, "hover"));
    this.dirty = true;
  }

  // ---- Caméra ----

  private get viewWidth() {
    return Math.max(1, this.options.host.clientWidth);
  }

  private get viewHeight() {
    return Math.max(1, this.options.host.clientHeight);
  }

  private aspect(): number {
    return this.viewWidth / this.viewHeight;
  }

  private fovY(): number {
    return (FOV * Math.PI) / 180;
  }

  private maxDistance(): number {
    return fitDistance(this.bounds, this.fovY(), this.aspect()) * 2.5;
  }

  private resize(): void {
    if (this.destroyed) return;
    this.renderer.setSize(this.viewWidth, this.viewHeight);
    this.camera3d.aspect = this.aspect();
    if (this.insetRight > 0)
      this.camera3d.setViewOffset(
        this.viewWidth,
        this.viewHeight,
        this.insetRight / 2,
        0,
        this.viewWidth,
        this.viewHeight,
      );
    else this.camera3d.clearViewOffset();
    this.camera3d.updateProjectionMatrix();
    this.applyOrbit(this.orbit);
  }

  private setOrbit(orbit: OrbitCamera): void {
    this.applyOrbit(clampOrbit(orbit, this.bounds, this.maxDistance()));
  }

  private applyOrbit(orbit: OrbitCamera): void {
    this.orbit = orbit;
    const position = cameraPosition(orbit);
    this.camera3d.position.set(position.x, position.y, position.z);
    this.camera3d.near = Math.max(0.05, orbit.distance / 100);
    this.camera3d.far = orbit.distance * 10 + 100;
    this.camera3d.lookAt(orbit.targetX, 0, orbit.targetZ);
    this.camera3d.updateProjectionMatrix();
    this.camera3d.updateMatrixWorld();
    this.dirty = true;
    this.options.onViewChange?.();
  }

  private project(point: Vector3): { x: number; y: number } {
    const ndc = point.clone().project(this.camera3d);
    return {
      x: ((ndc.x + 1) / 2) * this.viewWidth,
      y: ((1 - ndc.y) / 2) * this.viewHeight,
    };
  }

  /** Point du sol sous un point de l'écran. */
  private groundAt(
    clientX: number,
    clientY: number,
  ): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera3d);
    const { origin, direction } = this.raycaster.ray;
    return rayToGround(origin, direction);
  }

  private countVisible(): void {
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(
        this.camera3d.projectionMatrix,
        this.camera3d.matrixWorldInverse,
      ),
    );
    let visible = 0;
    for (const item of this.items)
      if (frustum.intersectsBox(item.box)) visible++;
    this.visibleItems = visible;
  }

  private readonly frame = (): void => {
    if (this.destroyed) return;
    if (this.pendingHover) {
      const event = this.pendingHover;
      this.pendingHover = null;
      this.setElementHover(
        this.pickElement(event.clientX, event.clientY),
        event,
      );
    }
    if (this.animation) {
      const { from, to, start, duration } = this.animation;
      const t = Math.min(1, (performance.now() - start) / duration);
      this.applyOrbit(lerpOrbit(from, to, easeInOutCubic(t)));
      if (t >= 1) this.animation = null;
    }
    if (this.dirty) {
      this.dirty = false;
      this.countVisible();
      const start = performance.now();
      this.renderer.render(this.scene, this.camera3d);
      this.watchPerformance(performance.now() - start);
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  /** Passe en qualité basse si les images sont durablement trop lentes (vieux ordinateurs). */
  private watchPerformance(ms: number): void {
    if (this.quality === "low" || this.measuredFrames > 240) return;
    this.measuredFrames++;
    // Les premières images compilent les shaders : on les ignore
    if (this.measuredFrames < 5) return;
    this.slowFrames = ms > SLOW_FRAME_MS ? this.slowFrames + 1 : 0;
    if (this.slowFrames >= 8) this.setQuality("low");
  }

  // ---- Zones et gestes ----

  private zoneAt(clientX: number, clientY: number): string | null {
    if (!this.layout) return null;
    const grid = this.clientToGrid(clientX, clientY);
    return zoneIdAtTile(
      this.layout,
      this.zoneLookup,
      Math.floor(grid.x),
      Math.floor(grid.y),
    );
  }

  /** Pièce visée : celle de l'objet touché s'il y en a un (une étagère haute peut masquer le sol voisin), sinon celle du sol. */
  private zoneUnder(clientX: number, clientY: number): string | null {
    const elementId = this.pickElement(clientX, clientY);
    const element = elementId
      ? this.layout?.elements.find((candidate) => candidate.id === elementId)
      : undefined;
    return element?.zoneId ?? this.zoneAt(clientX, clientY);
  }

  private setElementHover(
    elementId: string | null,
    event: PointerEvent | null,
  ): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const point = event
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : null;
    if (elementId === this.hoverElementId && elementId === null) return;
    this.hoverElementId = elementId;
    this.renderer.domElement.style.cursor = elementId ? "pointer" : "";
    this.options.onElementHover?.(elementId, elementId ? point : null);
  }

  private setHover(zoneId: string | null): void {
    if (zoneId === this.hoverZoneId) return;
    this.hoverZoneId = zoneId;
    this.redrawHighlights();
    this.options.onZoneHover?.(zoneId);
  }

  private editorPointer(event: PointerEvent): EditorPointer {
    return {
      tile: this.clientToTile(event.clientX, event.clientY),
      grid: this.clientToGrid(event.clientX, event.clientY),
      shift: event.shiftKey,
    };
  }

  private readonly onContextMenu = (event: Event): void => {
    // Clic droit = tourner la vue : pas de menu contextuel sur la carte
    event.preventDefault();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.animation = null;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.options.host.focus({ preventScroll: true });
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const orbitGesture =
      event.button === 2 || event.button === 1 || event.altKey;
    // Clic gauche (hors Espace) en édition : l'éditeur décide s'il prend le geste ; sinon la caméra bouge
    if (
      this.editor &&
      event.button === 0 &&
      !orbitGesture &&
      !this.spaceHeld &&
      this.pointers.size === 1
    ) {
      this.editorCapture = this.editor.onPointerDown(this.editorPointer(event));
      if (this.editorCapture) return;
    }
    if (this.pointers.size === 1) {
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.dragMoved = false;
      this.dragMode = orbitGesture ? "orbit" : "pan";
    } else if (this.pointers.size === 2) {
      this.pinchDistance = this.currentPinchDistance();
      this.dragMoved = true;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (this.editor && this.pointers.size <= 1) {
      this.editor.onPointerMove(this.editorPointer(event));
      if (this.editorCapture) {
        if (previous)
          this.pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
        return;
      }
    }
    if (!previous) {
      if (this.editor) return;
      const mouse = event.pointerType === "mouse";
      this.setHover(mouse ? this.zoneAt(event.clientX, event.clientY) : null);
      // Le lancer de rayon sur les objets est fait une fois par image au plus (voir frame)
      this.pendingHover = mouse ? event : null;
      if (!mouse) this.setElementHover(null, null);
      return;
    }
    const current = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    if (this.pointers.size === 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0) {
        const [a, b] = [...this.pointers.values()];
        const anchor = this.groundAt((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.setOrbit(
          zoomToward(
            this.orbit,
            distance / this.pinchDistance,
            anchor,
            this.maxDistance(),
          ),
        );
      }
      this.pinchDistance = distance;
      return;
    }

    if (this.dragStart && !this.dragMoved) {
      const moved = Math.hypot(
        current.x - this.dragStart.x,
        current.y - this.dragStart.y,
      );
      if (moved > CLICK_TOLERANCE_PX) this.dragMoved = true;
    }
    if (!this.dragMoved) return;
    if (this.dragMode === "orbit") {
      this.setOrbit(
        orbitBy(
          this.orbit,
          (current.x - previous.x) * ORBIT_SPEED,
          -(current.y - previous.y) * ORBIT_SPEED * 0.6,
        ),
      );
    } else {
      const from = this.groundAt(previous.x, previous.y);
      const to = this.groundAt(current.x, current.y);
      if (from && to) this.setOrbit(panBetween(this.orbit, from, to));
    }
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(event.pointerId);
    this.renderer.domElement.style.cursor = "";
    if (this.editorCapture) {
      this.editorCapture = false;
      this.editor?.onPointerUp(this.editorPointer(event));
      if (this.pointers.size === 0) this.dragStart = null;
      return;
    }
    if (wasSingle && !this.dragMoved && !this.editor && event.button === 0)
      this.options.onZoneClick?.(this.zoneUnder(event.clientX, event.clientY));
    if (this.pointers.size === 0) this.dragStart = null;
    this.pinchDistance = 0;
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.editorCapture) {
      this.editorCapture = false;
      this.editor?.onCancel();
    }
    this.dragStart = null;
    this.pinchDistance = 0;
    this.renderer.domElement.style.cursor = "";
  };

  private readonly onPointerLeave = (): void => {
    if (this.pointers.size === 0) {
      this.pendingHover = null;
      this.setHover(null);
      this.setElementHover(null, null);
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.animation = null;
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
    this.setOrbit(
      zoomToward(
        this.orbit,
        factor,
        this.groundAt(event.clientX, event.clientY),
        this.maxDistance(),
      ),
    );
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === " ") this.spaceHeld = false;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.editor) {
      // Espace maintenu + glisser = déplacer la carte sans quitter l'outil
      if (event.key === " ") {
        this.spaceHeld = true;
        event.preventDefault();
        return;
      }
      if (this.editor.onKeyDown(event)) {
        event.preventDefault();
        return;
      }
    }
    const step = this.orbit.distance * 0.06;
    switch (event.key) {
      case "ArrowLeft":
        this.setOrbit(panScreen(this.orbit, -step, 0));
        break;
      case "ArrowRight":
        this.setOrbit(panScreen(this.orbit, step, 0));
        break;
      case "ArrowUp":
        this.setOrbit(panScreen(this.orbit, 0, step));
        break;
      case "ArrowDown":
        this.setOrbit(panScreen(this.orbit, 0, -step));
        break;
      case "+":
      case "=":
        this.zoomBy(1.2);
        break;
      case "-":
        this.zoomBy(1 / 1.2);
        break;
      case "q":
      case "Q":
        this.rotateBy(-KEY_ROTATE);
        break;
      case "e":
      case "E":
        this.rotateBy(KEY_ROTATE);
        break;
      case "0":
        this.resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
