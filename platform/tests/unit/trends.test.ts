import { describe, expect, it } from "vitest";
import {
  computeTrends,
  formatDelta,
  pickBaseline,
  type MetricSnapshot,
} from "@/features/dashboard/trends";

const today = new Date("2026-10-20T00:00:00Z");
const snap = (date: string, lowStock: number): MetricSnapshot => ({
  date: new Date(`${date}T00:00:00Z`),
  people: 20,
  workstationsOccupied: 15,
  workstationsTotal: 30,
  lowStock,
  brokenAssets: 1,
});

describe("tendances des indicateurs", () => {
  it("compare au relevé le plus récent vieux de 7 à 14 jours", () => {
    const history = [
      snap("2026-10-19", 9),
      snap("2026-10-13", 2),
      snap("2026-10-10", 4),
      snap("2026-10-01", 7),
    ];
    expect(pickBaseline(history, today)?.date.toISOString()).toBe(
      "2026-10-13T00:00:00.000Z",
    );
    expect(pickBaseline([snap("2026-10-19", 1)], today)).toBeNull(); // trop récent
    expect(pickBaseline([snap("2026-09-01", 1)], today)).toBeNull(); // trop ancien
  });

  it("calcule les écarts et l'âge du relevé", () => {
    const current = {
      people: 22,
      workstationsOccupied: 15,
      workstationsTotal: 30,
      lowStock: 1,
      brokenAssets: 3,
    };
    expect(computeTrends(current, snap("2026-10-13", 4), today)).toEqual({
      days: 7,
      people: 2,
      workstationsOccupied: 0,
      lowStock: -3,
      brokenAssets: 2,
    });
    expect(computeTrends(current, null, today)).toBeNull();
  });

  it("affiche les écarts lisiblement", () => {
    expect(formatDelta(3)).toBe("+3");
    expect(formatDelta(-2)).toBe("−2");
    expect(formatDelta(0)).toBe("=");
  });
});
