// Relevés quotidiens : totaux seulement, par entreprise, tendances sur une semaine, purge des anciens.
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, getRepositories } from "@/lib/db";
import { runPurge } from "@/lib/db/purge";
import { testRawPrisma, type FullFixture } from "@/lib/db/testing";
import { prepareTwoOrganizations } from "../support/fixtures";

let a: FullFixture;
let b: FullFixture;

beforeEach(async () => {
  ({ a, b } = await prepareTwoOrganizations());
  await testRawPrisma.dailyMetric.deleteMany();
});

const now = new Date("2026-10-20T10:00:00Z");

describe("relevés quotidiens et tendances", () => {
  it("consulter enregistre le relevé du jour de SON entreprise, une seule ligne par jour", async () => {
    const dashboard = getRepositories(a.accounts.employee.context).dashboard;
    const first = await dashboard.trends(now);
    await dashboard.trends(now);
    const rows = await testRawPrisma.dailyMetric.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: a.organizationId,
      people: first.current.people,
    });
    expect(first.trends).toBeNull(); // pas encore d'historique
    // Rien que des nombres : aucune colonne personnelle
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "brokenAssets",
        "date",
        "id",
        "lowStock",
        "organizationId",
        "people",
        "workstationsOccupied",
        "workstationsTotal",
      ].sort(),
    );
  });

  it("compare au relevé d'il y a une semaine, sans jamais mélanger les entreprises", async () => {
    const weekAgo = new Date("2026-10-13T00:00:00Z");
    for (const fixture of [a, b])
      await testRawPrisma.dailyMetric.create({
        data: {
          organizationId: fixture.organizationId,
          date: weekAgo,
          people: fixture === a ? 0 : 500,
          workstationsOccupied: 0,
          workstationsTotal: 0,
          lowStock: 0,
          brokenAssets: 0,
        },
      });
    const { current, trends } = await getRepositories(
      a.accounts.manager.context,
    ).dashboard.trends(now);
    expect(trends).toMatchObject({ days: 7, people: current.people });
  });

  it("la purge nocturne relève chaque entreprise et supprime les relevés de plus de 400 jours", async () => {
    await testRawPrisma.dailyMetric.create({
      data: {
        organizationId: a.organizationId,
        date: new Date("2025-01-01T00:00:00Z"),
        people: 1,
        workstationsOccupied: 1,
        workstationsTotal: 1,
        lowStock: 1,
        brokenAssets: 1,
      },
    });
    await runPurge(now);
    const rows = await testRawPrisma.dailyMetric.findMany({
      orderBy: { organizationId: "asc" },
    });
    expect(rows.map((row) => row.date.toISOString().slice(0, 10))).toEqual([
      "2026-10-20",
      "2026-10-20",
    ]);
    expect(new Set(rows.map((row) => row.organizationId))).toEqual(
      new Set([a.organizationId, b.organizationId]),
    );
  });

  it("exige au moins le droit de lire la carte", async () => {
    await expect(
      getRepositories({
        ...a.accounts.employee.context,
        role: "NOBODY" as never,
      }).dashboard.trends(now),
    ).rejects.toThrow(ForbiddenError);
  });
});
