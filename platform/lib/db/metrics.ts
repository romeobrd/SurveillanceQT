// Relevé quotidien des indicateurs d'une entreprise (totaux uniquement) : partagé par le tableau de bord et la purge.
import "server-only";
import type { MetricValues } from "@/features/dashboard/trends";
import { isBelowThreshold } from "@/features/stock/quantity";
import { quantitiesByItem } from "./repositories/stock";
import type { TenantDb } from "./tenant";

/** Durée de conservation des relevés (non personnels) : un peu plus d'un an. */
export const METRICS_RETENTION_DAYS = 400;

export async function computeCurrentMetrics(
  db: TenantDb,
): Promise<MetricValues> {
  const [people, workstationsTotal, workstationsOccupied, items, brokenAssets] =
    await Promise.all([
      db.person.count({ where: { status: "ACTIVE" } }),
      db.workstation.count(),
      db.workstation.count({ where: { personId: { not: null } } }),
      db.stockItem.findMany({ select: { id: true, threshold: true } }),
      db.asset.count({ where: { state: "BROKEN" } }),
    ]);
  const quantities = await quantitiesByItem(
    db,
    items.map((item) => item.id),
  );
  const lowStock = items.filter((item) =>
    isBelowThreshold(quantities.get(item.id) ?? 0, item.threshold),
  ).length;
  return {
    people,
    workstationsOccupied,
    workstationsTotal,
    lowStock,
    brokenAssets,
  };
}

/** Enregistre (ou met à jour) le relevé du jour. */
export async function recordDailyMetrics(
  db: TenantDb,
  date: Date,
  values: MetricValues,
): Promise<void> {
  await db.dailyMetric.upsert({
    where: { organizationId_date: { organizationId: db.organizationId, date } },
    create: { organizationId: db.organizationId, date, ...values },
    update: values,
  });
}
