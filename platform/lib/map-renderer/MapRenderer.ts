// Moteur de rendu PixiJS de la carte isométrique (composant client uniquement, jamais côté serveur).
// Variante de PixiJS sans new Function() : compatible avec une CSP sans 'unsafe-eval'
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics } from "pixi.js";
import { getZoneCenter } from "./zoneCenter";
import {
  drawEditOverlay,
  drawFloor,
  drawSceneItem,
  drawZoneOverlay,
  floorKey,
  footprintBounds,
  itemHeightUnits,
  sceneItemKey,
  type EditOverlayData,
} from "./draw";
import { gridToScreen, screenToGrid } from "../map/iso";
import { buildScene, getWorldBounds, type PersonMarker } from "../map/scene";
import type { Layout } from "../map/schema";
import {
  clampCamera,
  fitCamera,
  panBy,
  rectsIntersect,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
  zoomAt,
  type Camera,
  type WorldRect,
} from "../map/viewport";
import { buildZoneLookup, zoneIdAtTile } from "../map/zones";

export interface MapRendererOptions {
  host: HTMLElement;
  onZoneHover?: (zoneId: string | null) => void;
  onZoneClick?: (zoneId: string | null) => void;
}

export interface BenchmarkResult {
  frames: number;
  averageMs: number;
  p95Ms: number;
  visibleItems: number;
  totalItems: number;
}

/** Geste de pointeur traduit en coordonnées de carte, transmis à l'éditeur. */
export interface EditorPointer {
  /** Tuile sous le pointeur, null hors du plan. */
  tile: { x: number; y: number } | null;
  /** Position fractionnaire sur la grille (pour viser une arête). */
  grid: { x: number; y: number };
  shift: boolean;
}

/** Passerelle vers l'éditeur : le moteur de rendu transmet les gestes et laisse l'éditeur décider. */
export interface EditorBridge {
  /** Retourne true si l'éditeur prend le geste (sinon la caméra se déplace). */
  onPointerDown(pointer: EditorPointer): boolean;
  onPointerMove(pointer: EditorPointer): void;
  onPointerUp(pointer: EditorPointer): void;
  /** Retourne true si la touche est gérée (sinon la caméra peut réagir). */
  onKeyDown(event: KeyboardEvent): boolean;
  onCancel(): void;
}

interface CullEntry {
  bounds: WorldRect;
}

const CLICK_TOLERANCE_PX = 5;
const KEY_PAN_PX = 48;

export class MapRenderer {
  private readonly app: Application;
  private readonly world = new Container();
  private readonly floorLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly itemLayer = new Container();
  private readonly hoverGraphics = new Graphics();
  private readonly selectedGraphics = new Graphics();
  // Calque d'édition à part, hors du groupe de rendu de la scène : le redessiner (fantôme qui suit la souris)
  // ne force pas la reconstruction des lots des centaines d'objets de la carte.
  private readonly editWorld = new Container();
  private readonly editLayer = new Container();
  private lastOverlayKey = "";
  private readonly editTiles = new Graphics();
  private readonly editGhosts = new Graphics();
  private readonly editSelection = new Graphics();
  private readonly editMarks = new Graphics();
  // Dessins réutilisés d'une mise à jour à l'autre : seuls les objets modifiés sont redessinés
  private itemCache = new Map<string, Graphics>();
  private floorCache = new Map<string, Graphics>();
  private editor: EditorBridge | null = null;
  private editorCapture = false;
  private spaceHeld = false;

  private layout: Layout | null = null;
  private zoneLookup: Int16Array = new Int16Array(0);
  private worldBounds: WorldRect = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  private cullEntries: CullEntry[] = [];
  private camera: Camera = { x: 0, y: 0, zoom: 1 };
  private hoverZoneId: string | null = null;
  private selectedZoneId: string | null = null;
  private dirty = true;
  private destroyed = false;
  private frameHandle = 0;
  private visibleItems = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved = false;
  private pinchDistance = 0;

  private constructor(
    app: Application,
    private readonly options: MapRendererOptions,
  ) {
    this.app = app;
    // Groupe de rendu : les lots de dessin d'une scène statique sont construits une fois,
    // déplacement et zoom ne modifient que la transformation (pas de reconstruction par image).
    this.world.isRenderGroup = true;
    this.world.addChild(this.floorLayer, this.overlayLayer, this.itemLayer);
    this.editWorld.addChild(this.editLayer);
    this.editLayer.addChild(
      this.editTiles,
      this.editGhosts,
      this.editSelection,
      this.editMarks,
    );
    this.overlayLayer.addChild(this.selectedGraphics, this.hoverGraphics);
    this.app.stage.addChild(this.world, this.editWorld);

    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    options.host.addEventListener("keydown", this.onKeyDown);
    options.host.addEventListener("keyup", this.onKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.host);
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  static async create(options: MapRendererOptions): Promise<MapRenderer> {
    const app = new Application();
    const { host } = options;
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      antialias: true,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
    });
    app.ticker.stop();
    host.appendChild(app.canvas);
    return new MapRenderer(app, options);
  }

  /**
   * Charge une carte et les occupants des postes. Les dessins inchangés sont réutilisés ; la vue est
   * recadrée sauf si `keepView` (mises à jour de l'éditeur).
   */
  setScene(
    layout: Layout,
    people: readonly PersonMarker[],
    options: { keepView?: boolean } = {},
  ): void {
    this.layout = layout;
    this.zoneLookup = buildZoneLookup(layout);
    this.worldBounds = getWorldBounds(layout);
    this.hoverZoneId = null;
    this.cullEntries = [];

    const reuse = (
      cache: Map<string, Graphics>,
      key: string,
      used: Set<string>,
      create: () => Graphics,
    ): { key: string; graphics: Graphics } => {
      // Deux objets de même clé ne partagent jamais le même dessin
      let uniqueKey = key;
      for (let n = 1; used.has(uniqueKey); n++) uniqueKey = `${key}#${n}`;
      used.add(uniqueKey);
      return { key: uniqueKey, graphics: cache.get(uniqueKey) ?? create() };
    };
    const swap = (
      layer: Container,
      cache: Map<string, Graphics>,
      next: Map<string, Graphics>,
    ) => {
      for (const [key, graphics] of cache) {
        if (!next.has(key)) graphics.destroy();
      }
      layer.removeChildren();
      for (const graphics of next.values()) layer.addChild(graphics);
      return next;
    };

    const floors = new Map<string, Graphics>();
    const floorKeys = new Set<string>();
    for (const zone of layout.zones) {
      const { key, graphics } = reuse(
        this.floorCache,
        floorKey(zone),
        floorKeys,
        () => {
          const created = new Graphics();
          drawFloor(created, zone);
          return created;
        },
      );
      floors.set(key, graphics);
    }
    this.floorCache = swap(this.floorLayer, this.floorCache, floors);

    const items = new Map<string, Graphics>();
    const itemKeys = new Set<string>();
    for (const item of buildScene(layout, people)) {
      const { key, graphics } = reuse(
        this.itemCache,
        sceneItemKey(item),
        itemKeys,
        () => {
          const created = new Graphics();
          drawSceneItem(created, item);
          return created;
        },
      );
      items.set(key, graphics);
      this.cullEntries.push({
        bounds: footprintBounds(item.footprint, itemHeightUnits(item)),
      });
    }
    this.itemCache = swap(this.itemLayer, this.itemCache, items);

    this.redrawOverlays();
    if (options.keepView) this.setCamera(this.camera);
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
    // Rien à redessiner si l'aperçu est identique au précédent
    const key = JSON.stringify(overlay);
    if (key === this.lastOverlayKey) return;
    this.lastOverlayKey = key;
    drawEditOverlay(
      {
        tiles: this.editTiles,
        ghosts: this.editGhosts,
        selection: this.editSelection,
        marks: this.editMarks,
      },
      overlay,
    );
    this.dirty = true;
  }

  /** Coordonnées de grille (fractionnaires) sous un point de l'écran. */
  clientToGrid(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const world = screenToWorld(
      this.camera,
      clientX - rect.left,
      clientY - rect.top,
    );
    return screenToGrid(world.x, world.y);
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

  /** Point de la grille (fractionnaire) en pixels relatifs au canvas (utile aux tests). */
  getGridScreenPoint(gx: number, gy: number): { x: number; y: number } {
    const world = gridToScreen(gx, gy);
    return worldToScreen(this.camera, world.x, world.y);
  }

  /** Centre d'une tuile en pixels relatifs au canvas (utile aux tests). */
  getTileScreenCenter(x: number, y: number): { x: number; y: number } {
    return this.getGridScreenPoint(x + 0.5, y + 0.5);
  }

  setSelectedZone(zoneId: string | null): void {
    if (zoneId === this.selectedZoneId) return;
    this.selectedZoneId = zoneId;
    this.redrawOverlays();
  }

  zoomBy(factor: number): void {
    this.setCamera(
      zoomAt(this.camera, factor, this.viewWidth / 2, this.viewHeight / 2),
    );
  }

  resetView(): void {
    this.setCamera(
      fitCamera(this.worldBounds, this.viewWidth, this.viewHeight),
    );
  }

  /** Position du centre d'une zone, en pixels relatifs au canvas (utile aux tests). */
  getZoneScreenCenter(zoneId: string): { x: number; y: number } | null {
    const zone = this.layout?.zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    const center = getZoneCenter(zone);
    const world = gridToScreen(center.x, center.y);
    return worldToScreen(this.camera, world.x, world.y);
  }

  getStats() {
    return {
      visibleItems: this.visibleItems,
      totalItems: this.cullEntries.length,
      zoom: this.camera.zoom,
    };
  }

  /** Mesure le temps de rendu par image en déplaçant la caméra à chaque image. */
  benchmark(frames = 120): BenchmarkResult {
    const initial = this.camera;
    const durations: number[] = [];
    for (let i = 0; i < frames; i++) {
      const t = (i / frames) * Math.PI * 2;
      this.setCamera(
        {
          ...initial,
          x: initial.x + Math.cos(t) * 80,
          y: initial.y + Math.sin(t) * 40,
        },
        false,
      );
      const start = performance.now();
      this.countVisible();
      this.app.render();
      durations.push(performance.now() - start);
    }
    this.setCamera(initial);
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      frames,
      averageMs: durations.reduce((sum, d) => sum + d, 0) / frames,
      p95Ms: sorted[Math.floor(frames * 0.95)],
      visibleItems: this.visibleItems,
      totalItems: this.cullEntries.length,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.options.host.removeEventListener("keydown", this.onKeyDown);
    this.options.host.removeEventListener("keyup", this.onKeyUp);
    const canvas = this.app.canvas;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("wheel", this.onWheel);
    this.app.destroy(true, { children: true });
  }

  private get viewWidth() {
    return this.options.host.clientWidth;
  }

  private get viewHeight() {
    return this.options.host.clientHeight;
  }

  private resize(): void {
    if (this.destroyed || this.viewWidth === 0 || this.viewHeight === 0) return;
    this.app.renderer.resize(this.viewWidth, this.viewHeight);
    this.dirty = true;
  }

  private setCamera(camera: Camera, markDirty = true): void {
    this.camera = clampCamera(
      camera,
      this.worldBounds,
      this.viewWidth,
      this.viewHeight,
    );
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.zoom);
    this.editWorld.position.set(this.camera.x, this.camera.y);
    this.editWorld.scale.set(this.camera.zoom);
    if (markDirty) this.dirty = true;
  }

  /**
   * Compte les objets situés dans la vue. Pas de masquage manuel : changer la visibilité d'un
   * objet reconstruirait les lots du groupe de rendu, plus coûteux que de laisser le GPU découper.
   */
  private countVisible(): void {
    const view = visibleWorldRect(this.camera, this.viewWidth, this.viewHeight);
    let visible = 0;
    for (const entry of this.cullEntries) {
      if (rectsIntersect(view, entry.bounds)) visible++;
    }
    this.visibleItems = visible;
  }

  private readonly frame = (): void => {
    if (this.destroyed) return;
    if (this.dirty) {
      this.dirty = false;
      this.countVisible();
      this.app.render();
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private redrawOverlays(): void {
    this.hoverGraphics.clear();
    this.selectedGraphics.clear();
    const find = (id: string | null) =>
      this.layout?.zones.find((zone) => zone.id === id);
    const selected = find(this.selectedZoneId);
    if (selected)
      drawZoneOverlay(this.selectedGraphics, selected.rects, "selected");
    const hovered = find(this.hoverZoneId);
    if (hovered && hovered.id !== this.selectedZoneId)
      drawZoneOverlay(this.hoverGraphics, hovered.rects, "hover");
    this.dirty = true;
  }

  private zoneAt(clientX: number, clientY: number): string | null {
    if (!this.layout) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const world = screenToWorld(
      this.camera,
      clientX - rect.left,
      clientY - rect.top,
    );
    const grid = screenToGrid(world.x, world.y);
    return zoneIdAtTile(
      this.layout,
      this.zoneLookup,
      Math.floor(grid.x),
      Math.floor(grid.y),
    );
  }

  private setHover(zoneId: string | null): void {
    if (zoneId === this.hoverZoneId) return;
    this.hoverZoneId = zoneId;
    this.redrawOverlays();
    this.options.onZoneHover?.(zoneId);
  }

  private editorPointer(event: PointerEvent): EditorPointer {
    return {
      tile: this.clientToTile(event.clientX, event.clientY),
      grid: this.clientToGrid(event.clientX, event.clientY),
      shift: event.shiftKey,
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.app.canvas.setPointerCapture(event.pointerId);
    this.options.host.focus({ preventScroll: true });
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Clic gauche (hors Espace) en édition : l'éditeur décide s'il prend le geste ; sinon la caméra se déplace
    if (
      this.editor &&
      event.button === 0 &&
      !this.spaceHeld &&
      this.pointers.size === 1
    ) {
      this.editorCapture = this.editor.onPointerDown(this.editorPointer(event));
      if (this.editorCapture) return;
    }
    if (this.pointers.size === 1) {
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.dragMoved = false;
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
      this.setHover(
        event.pointerType === "mouse"
          ? this.zoneAt(event.clientX, event.clientY)
          : null,
      );
      return;
    }
    const current = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    if (this.pointers.size === 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0) {
        const rect = this.app.canvas.getBoundingClientRect();
        const [a, b] = [...this.pointers.values()];
        const midX = (a.x + b.x) / 2 - rect.left;
        const midY = (a.y + b.y) / 2 - rect.top;
        this.setCamera(
          zoomAt(this.camera, distance / this.pinchDistance, midX, midY),
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
    if (this.dragMoved) {
      this.setCamera(
        panBy(this.camera, current.x - previous.x, current.y - previous.y),
      );
      this.app.canvas.style.cursor = "grabbing";
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(event.pointerId);
    this.app.canvas.style.cursor = "";
    if (this.editorCapture) {
      this.editorCapture = false;
      this.editor?.onPointerUp(this.editorPointer(event));
      if (this.pointers.size === 0) this.dragStart = null;
      return;
    }
    if (wasSingle && !this.dragMoved && !this.editor)
      this.options.onZoneClick?.(this.zoneAt(event.clientX, event.clientY));
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
    this.app.canvas.style.cursor = "";
  };

  private readonly onPointerLeave = (): void => {
    if (this.pointers.size === 0) this.setHover(null);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
    this.setCamera(
      zoomAt(
        this.camera,
        factor,
        event.clientX - rect.left,
        event.clientY - rect.top,
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
    const center = { x: this.viewWidth / 2, y: this.viewHeight / 2 };
    switch (event.key) {
      case "ArrowLeft":
        this.setCamera(panBy(this.camera, KEY_PAN_PX, 0));
        break;
      case "ArrowRight":
        this.setCamera(panBy(this.camera, -KEY_PAN_PX, 0));
        break;
      case "ArrowUp":
        this.setCamera(panBy(this.camera, 0, KEY_PAN_PX));
        break;
      case "ArrowDown":
        this.setCamera(panBy(this.camera, 0, -KEY_PAN_PX));
        break;
      case "+":
      case "=":
        this.setCamera(zoomAt(this.camera, 1.2, center.x, center.y));
        break;
      case "-":
        this.setCamera(zoomAt(this.camera, 1 / 1.2, center.x, center.y));
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
