"use client";

import Link from "next/link";
import { formatDelta, type Trends } from "@/features/dashboard/trends";
import type { MapKpis, ZoneAlert } from "@/features/map/insights";
import type { ProjectFn } from "@/components/MapView";
import { fr } from "@/lib/i18n/fr";
import type { Zone } from "@/lib/map/schema";

const t = fr.map.insights;
const card =
  "pointer-events-auto rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur";

/** Centre (grille) du premier rectangle d'une pièce. */
function zoneCenter(zone: Zone) {
  const rect = zone.rects[0];
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

type IconName = "people" | "desk" | "box" | "wrench";

/** Icônes dessinées en SVG dans le code (aucune police ni image externe). */
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    people:
      "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 19c0-3 2.7-5 6-5s6 2 6 5M14 14.5c.6-.3 1.3-.5 2-.5 2.8 0 5 1.8 5 4.5",
    desk: "M3 10h18M5 10v9M19 10v9M8 10V6h8v4M9 14h6",
    box: "M4 8l8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8",
    wrench: "M14.5 5.5a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2Z",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Indicateurs posés en haut de la carte (totaux uniquement, aucune donnée personnelle). */
export function MapKpiBar({
  kpis,
  trends = null,
}: {
  kpis: MapKpis;
  trends?: Trends | null;
}) {
  // Évolution sur une semaine ; pour les alertes, une hausse est une mauvaise nouvelle
  const trend = (delta: number | undefined, badWhenUp: boolean) =>
    trends && delta !== undefined
      ? {
          text: t.trend
            .replace("{delta}", formatDelta(delta))
            .replace("{days}", String(trends.days)),
          tone:
            delta === 0 || !badWhenUp
              ? "text-slate-500"
              : delta > 0
                ? "text-red-700"
                : "text-green-700",
        }
      : null;
  const items: Array<{
    label: string;
    value: string;
    detail: string;
    href: string;
    alert: boolean;
    icon: IconName;
    trend: { text: string; tone: string } | null;
  }> = [
    {
      label: t.people,
      value: String(kpis.people),
      detail: t.peopleDetail,
      href: "/collaborateurs",
      alert: false,
      icon: "people",
      trend: trend(trends?.people, false),
    },
    {
      label: t.occupied,
      value: `${kpis.workstationsOccupied} / ${kpis.workstationsTotal}`,
      detail: t.occupiedDetail.replace(
        "{rate}",
        String(
          kpis.workstationsTotal
            ? Math.round(
                (kpis.workstationsOccupied / kpis.workstationsTotal) * 100,
              )
            : 0,
        ),
      ),
      href: "/postes",
      alert: false,
      icon: "desk",
      trend: trend(trends?.workstationsOccupied, false),
    },
    {
      label: t.lowStock,
      value: String(kpis.lowStock),
      detail: t.lowStockDetail,
      href: "/stock?alert=low",
      alert: kpis.lowStock > 0,
      icon: "box",
      trend: trend(trends?.lowStock, true),
    },
    {
      label: t.broken,
      value: String(kpis.brokenAssets),
      detail: t.brokenDetail,
      href: "/materiel?state=BROKEN",
      alert: kpis.brokenAssets > 0,
      icon: "wrench",
      trend: trend(trends?.brokenAssets, true),
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
            className={`${card} focus-visible:outline-brand-600 flex items-center gap-3 px-3 py-2 hover:bg-white focus-visible:outline-2`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.alert ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}
            >
              <Icon name={item.icon} />
            </span>
            <span className="flex flex-col">
              <span className="text-xs font-medium text-slate-600">
                {item.label}
              </span>
              <span
                className={`text-lg leading-tight font-semibold tabular-nums ${item.alert ? "text-red-700" : "text-slate-900"}`}
              >
                {item.value}
              </span>
              <span
                className={`text-[11px] ${item.trend ? item.trend.tone : "text-slate-500"}`}
                data-testid={item.trend ? "kpi-trend" : undefined}
              >
                {item.trend ? item.trend.text : item.detail}
              </span>
            </span>
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
