"use client";

import { useEffect, useRef, useState } from "react";
import { fr } from "@/lib/i18n/fr";
import { MapRenderer } from "@/lib/map-renderer/MapRenderer";
import type { PersonMarker } from "@/lib/map/scene";
import type { Layout } from "@/lib/map/schema";

interface MapViewProps {
  layout: Layout;
  people: readonly PersonMarker[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string | null) => void;
}

declare global {
  interface Window {
    /** Outils de diagnostic, disponibles hors production uniquement. */
    __mapDebug?: {
      zoneCenter: (zoneId: string) => { x: number; y: number } | null;
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

  useEffect(() => {
    renderer?.setScene(layout, people);
  }, [renderer, layout, people]);

  useEffect(() => {
    renderer?.setSelectedZone(selectedZoneId);
  }, [renderer, selectedZoneId]);

  useEffect(() => {
    if (!renderer || process.env.NODE_ENV === "production") return;
    window.__mapDebug = {
      zoneCenter: (zoneId) => renderer.getZoneScreenCenter(zoneId),
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
