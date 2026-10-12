"use client";

import { useEffect, useRef, useState } from "react";
import { fr } from "@/lib/i18n/fr";
import type { EditOverlayData } from "@/lib/map-renderer/draw";
import { MapRenderer, type EditorBridge } from "@/lib/map-renderer/MapRenderer";
import type { PersonMarker } from "@/lib/map/scene";
import type { Layout } from "@/lib/map/schema";

interface MapViewProps {
  layout: Layout;
  people: readonly PersonMarker[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string | null) => void;
  /** Passerelle de l'éditeur (mode Aménager) : reçoit les gestes au lieu de la sélection de zone. */
  editor?: EditorBridge | null;
  overlay?: EditOverlayData | null;
  /** Survol d'un élément du catalogue glissé au-dessus de la carte. */
  onDragHover?: (tile: { x: number; y: number } | null) => void;
  /** Élément du catalogue déposé sur la carte. */
  onDropItem?: (tile: { x: number; y: number }, catalogKey: string) => void;
}

/** Type de données du glisser-déposer depuis le catalogue. */
export const CATALOG_DRAG_TYPE = "application/x-catalog-key";

declare global {
  interface Window {
    /** Outils de diagnostic, disponibles hors production uniquement. */
    __mapDebug?: {
      zoneCenter: (zoneId: string) => { x: number; y: number } | null;
      tileCenter: (x: number, y: number) => { x: number; y: number };
      gridPoint: (gx: number, gy: number) => { x: number; y: number };
      benchmark: (frames?: number) => ReturnType<MapRenderer["benchmark"]>;
      stats: () => ReturnType<MapRenderer["getStats"]>;
    };
  }
}

const controlClass =
  "flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-lg font-semibold text-slate-900 shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500";

export default function MapView({
  layout,
  people,
  selectedZoneId,
  onSelectZone,
  editor = null,
  overlay = null,
  onDragHover,
  onDropItem,
}: MapViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelectZone);
  const [renderer, setRenderer] = useState<MapRenderer | null>(null);
  const [failed, setFailed] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const layoutRef = useRef(layout);

  useEffect(() => {
    selectRef.current = onSelectZone;
    layoutRef.current = layout;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let created: MapRenderer | null = null;
    MapRenderer.create({
      host,
      onZoneClick: (zoneId) => selectRef.current(zoneId),
      onZoneHover: (zoneId) =>
        setHoveredName(
          layoutRef.current.zones.find((zone) => zone.id === zoneId)?.name ??
            null,
        ),
    })
      .then((instance) => {
        if (cancelled) {
          instance.destroy();
          return;
        }
        created = instance;
        setRenderer(instance);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      created?.destroy();
      setRenderer(null);
    };
  }, []);

  // La vue n'est recadrée qu'au premier affichage ; ensuite l'éditeur garde la caméra de l'utilisateur
  const sceneLoaded = useRef(false);
  useEffect(() => {
    sceneLoaded.current = false;
  }, [renderer]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setScene(layout, people, {
      keepView: sceneLoaded.current && editor !== null,
    });
    sceneLoaded.current = true;
    // `editor` n'est lu que pour décider du recadrage : sa seule présence ne doit pas redessiner la scène
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, layout, people]);

  useEffect(() => {
    renderer?.setEditor(editor);
  }, [renderer, editor]);

  useEffect(() => {
    renderer?.setEditOverlay(overlay);
  }, [renderer, overlay]);

  useEffect(() => {
    renderer?.setSelectedZone(selectedZoneId);
  }, [renderer, selectedZoneId]);

  useEffect(() => {
    if (!renderer || process.env.NODE_ENV === "production") return;
    window.__mapDebug = {
      zoneCenter: (zoneId) => renderer.getZoneScreenCenter(zoneId),
      tileCenter: (x, y) => renderer.getTileScreenCenter(x, y),
      gridPoint: (gx, gy) => renderer.getGridScreenPoint(gx, gy),
      benchmark: (frames) => renderer.benchmark(frames),
      stats: () => renderer.getStats(),
    };
    return () => {
      delete window.__mapDebug;
    };
  }, [renderer]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-800">
      <div
        ref={hostRef}
        role="application"
        aria-label={fr.map.canvasLabel}
        tabIndex={0}
        data-testid="map-host"
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(CATALOG_DRAG_TYPE)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          onDragHover?.(
            renderer?.clientToTile(event.clientX, event.clientY) ?? null,
          );
        }}
        onDragLeave={() => onDragHover?.(null)}
        onDrop={(event) => {
          const key = event.dataTransfer.getData(CATALOG_DRAG_TYPE);
          if (!key) return;
          event.preventDefault();
          const tile = renderer?.clientToTile(event.clientX, event.clientY);
          if (tile) onDropItem?.(tile, key);
        }}
        className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-500"
      />
      {!renderer && !failed && (
        <p className="absolute inset-0 flex items-center justify-center text-slate-200">
          {fr.map.loading}
        </p>
      )}
      {failed && (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-200"
        >
          {fr.map.error}
        </p>
      )}
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <button
          type="button"
          className={controlClass}
          aria-label={fr.map.zoomIn}
          onClick={() => renderer?.zoomBy(1.25)}
        >
          +
        </button>
        <button
          type="button"
          className={controlClass}
          aria-label={fr.map.zoomOut}
          onClick={() => renderer?.zoomBy(0.8)}
        >
          −
        </button>
        <button
          type="button"
          className={controlClass}
          aria-label={fr.map.resetView}
          onClick={() => renderer?.resetView()}
        >
          ⌂
        </button>
      </div>
      {hoveredName && (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-slate-900/85 px-3 py-1.5 text-sm text-white"
        >
          {hoveredName}
        </p>
      )}
    </div>
  );
}
