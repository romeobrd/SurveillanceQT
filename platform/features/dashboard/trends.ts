// Tendances des indicateurs : comparaison avec le relevé d'il y a environ une semaine (calculs purs).

export interface MetricValues {
  people: number;
  workstationsOccupied: number;
  workstationsTotal: number;
  lowStock: number;
  brokenAssets: number;
}

export interface MetricSnapshot extends MetricValues {
  /** Jour du relevé (minuit UTC, colonne DATE). */
  date: Date;
}

export interface Trends {
  /** Écart en jours avec le relevé de comparaison. */
  days: number;
  people: number;
  workstationsOccupied: number;
  lowStock: number;
  brokenAssets: number;
}

const DAY = 86_400_000;
/** Fenêtre de comparaison : un relevé vieux de 7 à 14 jours (le plus récent possible). */
const MIN_DAYS = 7;
const MAX_DAYS = 14;

export function pickBaseline(
  snapshots: readonly MetricSnapshot[],
  today: Date,
): MetricSnapshot | null {
  let best: MetricSnapshot | null = null;
  for (const snapshot of snapshots) {
    const days = Math.round((today.getTime() - snapshot.date.getTime()) / DAY);
    if (days < MIN_DAYS || days > MAX_DAYS) continue;
    if (!best || snapshot.date > best.date) best = snapshot;
  }
  return best;
}

export function computeTrends(
  current: MetricValues,
  baseline: MetricSnapshot | null,
  today: Date,
): Trends | null {
  if (!baseline) return null;
  return {
    days: Math.round((today.getTime() - baseline.date.getTime()) / DAY),
    people: current.people - baseline.people,
    workstationsOccupied:
      current.workstationsOccupied - baseline.workstationsOccupied,
    lowStock: current.lowStock - baseline.lowStock,
    brokenAssets: current.brokenAssets - baseline.brokenAssets,
  };
}

/** Écart affiché : « +3 », « −2 », « = » (signe moins typographique). */
export function formatDelta(delta: number): string {
  if (delta === 0) return "=";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
