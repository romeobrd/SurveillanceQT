// Tableau de bord : agrégats sans donnée personnelle (comptes, alertes, avancements).
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import {
  computeTrends,
  pickBaseline,
  type MetricValues,
  type Trends,
} from "@/features/dashboard/trends";
import { todayInParis } from "@/lib/privacy/retention";
import { computeCurrentMetrics, recordDailyMetrics } from "../metrics";
import type { TenantDb } from "../tenant";
import { presenceRepository } from "./privacy";
import { projectsRepository, type ProjectView } from "./projects";
import { stockRepository, type StockItemView } from "./stock";

export interface DashboardData {
  activePeople: number;
  workstations: { total: number; occupied: number; free: number };
  lowStock: StockItemView[];
  assets: {
    broken: number;
    toRenew: number;
    problems: Array<{
      id: string;
      label: string;
      state: "BROKEN" | "TO_RENEW";
      zoneName: string | null;
    }>;
  };
  projects: ProjectView[];
  /** Totaux du jour, jamais par personne ; null quand la présence déclarative est désactivée. */
  presence: { office: number; remote: number; absent: number } | null;
}

export function dashboardRepository(db: TenantDb, context: AccessContext) {
  return {
    /**
     * Indicateurs du jour et leur évolution sur une semaine. Consulter enregistre aussi le relevé du jour
     * (totaux uniquement) : les tendances existent même sans tâche planifiée.
     */
    async trends(
      now: Date = new Date(),
    ): Promise<{ current: MetricValues; trends: Trends | null }> {
      assertPermission(context, "map:read");
      const today = todayInParis(now);
      const current = await computeCurrentMetrics(db);
      await recordDailyMetrics(db, today, current);
      const history = await db.dailyMetric.findMany({
        where: {
          date: {
            gte: new Date(today.getTime() - 14 * 86_400_000),
            lte: new Date(today.getTime() - 7 * 86_400_000),
          },
        },
        orderBy: { date: "desc" },
      });
      return {
        current,
        trends: computeTrends(current, pickBaseline(history, today), today),
      };
    },

    async get(): Promise<DashboardData> {
      assertPermission(context, "map:read");
      const [
        activePeople,
        total,
        occupied,
        lowStock,
        brokenAssets,
        renewAssets,
        projects,
      ] = await Promise.all([
        db.person.count({ where: { status: "ACTIVE" } }),
        db.workstation.count(),
        db.workstation.count({ where: { personId: { not: null } } }),
        stockRepository(db, context).listItems({
          alert: "low",
          sort: "quantity",
        }),
        db.asset.count({ where: { state: "BROKEN" } }),
        db.asset.count({ where: { state: "TO_RENEW" } }),
        projectsRepository(db, context).list({}),
      ]);
      const problems = await db.asset.findMany({
        where: { state: { in: ["BROKEN", "TO_RENEW"] } },
        select: {
          id: true,
          type: true,
          brand: true,
          model: true,
          state: true,
          zone: { select: { name: true } },
        },
        orderBy: [{ state: "asc" }, { type: "asc" }, { id: "asc" }],
        take: 8,
      });
      return {
        activePeople,
        workstations: { total, occupied, free: total - occupied },
        lowStock,
        assets: {
          broken: brokenAssets,
          toRenew: renewAssets,
          problems: problems.map((asset) => ({
            id: asset.id,
            label: `${asset.type} ${asset.brand} ${asset.model}`,
            state: asset.state as "BROKEN" | "TO_RENEW",
            zoneName: asset.zone?.name ?? null,
          })),
        },
        projects,
        presence: await presenceRepository(db, context).todayCounts(),
      };
    },
  };
}
