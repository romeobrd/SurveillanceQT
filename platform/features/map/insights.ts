// Indicateurs et alertes affichés directement sur la carte : calculs purs à partir des données de la carte.
// Aucune donnée personnelle : seulement des totaux et des alertes sur des objets (stock, matériel).
import { isBelowThreshold } from "@/features/stock/quantity";
import type { MapData } from "./types";

export interface MapKpis {
  people: number;
  workstationsOccupied: number;
  workstationsTotal: number;
  lowStock: number;
  brokenAssets: number;
}

export interface ZoneAlert {
  zoneId: string;
  lowStock: number;
  brokenAssets: number;
}

export function computeMapKpis(data: MapData): MapKpis {
  return {
    people: data.people.length,
    workstationsOccupied: data.workstations.filter((w) => w.personId).length,
    workstationsTotal: data.workstations.length,
    lowStock: data.stock.filter((item) =>
      isBelowThreshold(item.quantity, item.threshold),
    ).length,
    brokenAssets: data.assets.filter((asset) => asset.state === "BROKEN")
      .length,
  };
}

/** Pièces qui demandent une action (stock sous le seuil, matériel en panne), dans l'ordre des zones. */
export function computeZoneAlerts(
  data: MapData,
  zoneIds: readonly string[],
): ZoneAlert[] {
  const alerts: ZoneAlert[] = [];
  for (const zoneId of zoneIds) {
    const lowStock = data.stock.filter(
      (item) =>
        item.zoneId === zoneId &&
        isBelowThreshold(item.quantity, item.threshold),
    ).length;
    const brokenAssets = data.assets.filter(
      (asset) => asset.zoneId === zoneId && asset.state === "BROKEN",
    ).length;
    if (lowStock + brokenAssets > 0)
      alerts.push({ zoneId, lowStock, brokenAssets });
  }
  return alerts;
}

/** Résumé d'une pièce pour la fiche flottante. */
export function summarizeZone(data: MapData, zoneId: string) {
  const workstations = data.workstations.filter((w) => w.zoneId === zoneId);
  const stock = data.stock
    .filter((item) => item.zoneId === zoneId)
    .map((item) => ({
      ...item,
      low: isBelowThreshold(item.quantity, item.threshold),
    }))
    // Les articles à réapprovisionner d'abord
    .sort(
      (a, b) =>
        Number(b.low) - Number(a.low) || a.name.localeCompare(b.name, "fr"),
    );
  const assets = data.assets.filter((asset) => asset.zoneId === zoneId);
  return {
    occupied: workstations.filter((w) => w.personId).length,
    workstations: workstations.length,
    stock,
    lowStock: stock.filter((item) => item.low).length,
    brokenAssets: assets.filter((asset) => asset.state === "BROKEN").length,
    assets: assets.length,
  };
}
