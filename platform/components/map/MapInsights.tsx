"use client";

import Link from "next/link";
import type { MapKpis, ZoneAlert } from "@/features/map/insights";
import { summarizeZone } from "@/features/map/insights";
import type { MapData } from "@/features/map/types";
import type { ProjectFn } from "@/components/MapView";
import { fr } from "@/lib/i18n/fr";
import type { Zone } from "@/lib/map/schema";
import { ZONE_LABELS } from "@/lib/map/zoneTypes";

const t = fr.map.insights;
const card =
  "pointer-events-auto rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur";

/** Centre (grille) du premier rectangle d'une pièce. */
function zoneCenter(zone: Zone) {
  const rect = zone.rects[0];
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** Indicateurs posés en haut de la carte (totaux uniquement, aucune donnée personnelle). */
export function MapKpiBar({ kpis }: { kpis: MapKpis }) {
  const items = [
    {
      label: t.people,
      value: String(kpis.people),
      href: "/collaborateurs",
      alert: false,
    },
    {
      label: t.occupied,
      value: `${kpis.workstationsOccupied} / ${kpis.workstationsTotal}`,
      href: "/postes",
      alert: false,
    },
    {
      label: t.lowStock,
      value: String(kpis.lowStock),
      href: "/stock?alert=low",
      alert: kpis.lowStock > 0,
    },
    {
      label: t.broken,
      value: String(kpis.brokenAssets),
      href: "/materiel?state=BROKEN",
      alert: kpis.brokenAssets > 0,
    },
  ];
  return (
    <ul
      aria-label={t.label}
      data-testid="map-kpis"
      className="absolute top-3 left-3 flex max-w-[calc(100%-5rem)] flex-wrap gap-2"
    >
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className={`${card} focus-visible:outline-brand-600 flex flex-col px-3 py-1.5 hover:bg-white focus-visible:outline-2`}
          >
            <span
              className={`text-lg leading-tight font-semibold ${item.alert ? "text-red-700" : "text-slate-900"}`}
            >
              {item.value}
            </span>
            <span className="text-xs text-slate-600">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Épingles rouges au-dessus des pièces qui demandent une action (stock bas, panne). */
export function ZonePins({
  alerts,
  zones,
  project,
  onSelectZone,
}: {
  alerts: readonly ZoneAlert[];
  zones: readonly Zone[];
  project: ProjectFn;
  onSelectZone: (zoneId: string) => void;
}) {
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  return (
    <ul aria-label={t.alertsLabel}>
      {alerts.map((alert) => {
        const zone = byId.get(alert.zoneId);
        if (!zone) return null;
        const center = zoneCenter(zone);
        const point = project(center.x, center.y, 1.4);
        if (!point) return null;
        const count = alert.lowStock + alert.brokenAssets;
        return (
          <li
            key={alert.zoneId}
            className="absolute"
            style={{
              left: point.x,
              top: point.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <button
              type="button"
              data-testid="zone-pin"
              aria-label={t.pin
                .replace("{zone}", zone.name)
                .replace("{count}", String(count))}
              onClick={() => onSelectZone(zone.id)}
              className="pointer-events-auto flex flex-col items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1.5 text-xs font-bold text-white shadow-md">
                {count}
              </span>
              <span
                aria-hidden="true"
                className="-mt-0.5 h-2.5 w-0.5 rounded-b bg-red-600"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Fiche flottante d'une pièce, posée près de la pièce sélectionnée. */
export function ZoneCard({
  zone,
  data,
  project,
  onClose,
}: {
  zone: Zone;
  data: MapData;
  project: ProjectFn;
  onClose: () => void;
}) {
  const center = zoneCenter(zone);
  const point = project(center.x, center.y, 1.2);
  if (!point) return null;
  const summary = summarizeZone(data, zone.id);
  return (
    <section
      aria-label={zone.name}
      data-testid="zone-card"
      className={`${card} absolute flex w-72 flex-col gap-2 p-3`}
      style={{
        left: `clamp(8px, ${point.x + 24}px, calc(100% - 296px))`,
        top: `clamp(8px, ${point.y - 140}px, calc(100% - 300px))`,
      }}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="leading-tight font-semibold">{zone.name}</p>
          <p className="text-xs text-slate-600">{ZONE_LABELS[zone.type]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.cardClose}
          className="focus-visible:outline-brand-600 rounded-md px-2 py-0.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-2"
        >
          ×
        </button>
      </header>
      {summary.workstations > 0 && (
        <p className="text-sm">
          {t.occupied} :{" "}
          <strong>
            {summary.occupied} / {summary.workstations}
          </strong>
        </p>
      )}
      {summary.brokenAssets > 0 && (
        <p className="text-sm font-medium text-red-700">
          {t.brokenHere.replace("{count}", String(summary.brokenAssets))}
        </p>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold tracking-wide text-slate-600 uppercase">{t.inventory}</p>
        {summary.stock.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noInventory}</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {summary.stock.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{item.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${item.low ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}
                  >
                    {item.low ? t.lowBadge : t.inStock}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {summary.lowStock > 0 && (
        <Link
          href="/stock?alert=low"
          className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-lg px-3 py-2 text-center text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t.showMissing}
        </Link>
      )}
    </section>
  );
}
