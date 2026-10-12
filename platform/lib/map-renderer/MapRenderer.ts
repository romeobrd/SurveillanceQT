// Moteur de rendu PixiJS de la carte isométrique (composant client uniquement, jamais côté serveur).
import { Application, Container, Graphics } from "pixi.js";
import { getZoneCenter } from "./zoneCenter";
import {
  drawFloor,
  drawSceneItem,
  drawZoneOverlay,
  footprintBounds,
  itemHeightUnits,
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
    this.overlayLayer.addChild(this.selectedGraphics, this.hoverGraphics);
    this.app.stage.addChild(this.world);

    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    options.host.addEventListener("keydown", this.onKeyDown);

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

  /** Charge une carte et les occupants des postes, puis recadre la vue. */
  setScene(layout: Layout, people: readonly PersonMarker[]): void {
    this.layout = layout;
    this.zoneLookup = buildZoneLookup(layout);
    this.worldBounds = getWorldBounds(layout);
    this.hoverZoneId = null;

    for (const layer of [this.floorLayer, this.itemLayer]) {
      for (const child of layer.removeChildren()) child.destroy();
    }
    this.cullEntries = [];

    for (const zone of layout.zones) {
      const floor = new Graphics();
      drawFloor(floor, zone);
      this.floorLayer.addChild(floor);
    }
    for (const item of buildScene(layout, people)) {
      const graphics = new Graphics();
      drawSceneItem(graphics, item);
      this.itemLayer.addChild(graphics);
      this.cullEntries.push({
        bounds: footprintBounds(item.footprint, itemHeightUnits(item)),
      });
    }
    this.redrawOverlays();
    this.resetView();
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

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.app.canvas.setPointerCapture(event.pointerId);
    this.options.host.focus({ preventScroll: true });
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
    if (!previous) {
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
    if (wasSingle && !this.dragMoved)
      this.options.onZoneClick?.(this.zoneAt(event.clientX, event.clientY));
    if (this.pointers.size === 0) this.dragStart = null;
    this.pinchDistance = 0;
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
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

  private readonly onKeyDown = (event: KeyboardEvent): void => {
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
