// Purge planifiée (SPEC §8.2 et §8.6) : applique, pour chaque entreprise, ses durées de conservation.
// Lancée chaque nuit par une tâche planifiée (script `npm run purge` ou point d'entrée protégé).
import "server-only";
import { retentionCutoff, todayInParis } from "@/lib/privacy/retention";
import { rawPrisma } from "./client";
import {
  computeCurrentMetrics,
  METRICS_RETENTION_DAYS,
  recordDailyMetrics,
} from "./metrics";
import { anonymizePerson } from "./privacy-core";
import { createTenantDb } from "./tenant";

export interface OrganizationPurgeReport {
  organizationId: string;
  auditLogs: number;
  privacyRequests: number;
  anonymizedPeople: number;
  presenceStatuses: number;
}

export interface PurgeReport {
  organizations: OrganizationPurgeReport[];
  loginAttempts: number;
}

/**
 * Purge idempotente : relancée, elle ne trouve plus rien à supprimer. `now` est injectable pour les tests.
 * Une entreprise après l'autre ; une erreur sur l'une n'empêche pas de purger les autres (elle est relancée à la fin).
 */
export async function runPurge(now: Date = new Date()): Promise<PurgeReport> {
  const organizations = await rawPrisma.organization.findMany({
    select: {
      id: true,
      presenceEnabled: true,
      auditRetentionDays: true,
      privacyRequestRetentionDays: true,
      departedPersonRetentionDays: true,
    },
  });
  const today = todayInParis(now);
  const reports: OrganizationPurgeReport[] = [];
  const failures: unknown[] = [];

  for (const organization of organizations) {
    try {
      const organizationId = organization.id;

      // Présence : jamais d'historique (tout ce qui précède aujourd'hui) ; rien du tout si la fonction est désactivée
      const presence = await rawPrisma.presenceStatus.deleteMany({
        where: organization.presenceEnabled
          ? { organizationId, date: { lt: today } }
          : { organizationId },
      });

      const auditLogs = await rawPrisma.auditLog.deleteMany({
        where: {
          organizationId,
          createdAt: {
            lt: retentionCutoff(now, organization.auditRetentionDays),
          },
        },
      });

      const requestCutoff = retentionCutoff(
        now,
        organization.privacyRequestRetentionDays,
      );
      const privacyRequests = await rawPrisma.privacyRequest.deleteMany({
        where: {
          organizationId,
          status: { in: ["DONE", "REJECTED"] },
          OR: [
            { resolvedAt: { lt: requestCutoff } },
            { resolvedAt: null, createdAt: { lt: requestCutoff } },
          ],
        },
      });

      const departedCutoff = retentionCutoff(
        now,
        organization.departedPersonRetentionDays,
      );
      const due = await rawPrisma.person.findMany({
        where: {
          organizationId,
          status: "DEPARTED",
          anonymizedAt: null,
          departedAt: { lte: departedCutoff },
        },
        select: { id: true },
      });
      for (const person of due)
        await anonymizePerson(organizationId, person.id, now);

      // Relevé quotidien des indicateurs (totaux, pour les tendances), puis suppression des relevés trop anciens
      const tenantDb = createTenantDb(organizationId);
      await recordDailyMetrics(
        tenantDb,
        today,
        await computeCurrentMetrics(tenantDb),
      );
      await rawPrisma.dailyMetric.deleteMany({
        where: {
          organizationId,
          date: { lt: retentionCutoff(now, METRICS_RETENTION_DAYS) },
        },
      });

      const report: OrganizationPurgeReport = {
        organizationId,
        auditLogs: auditLogs.count,
        privacyRequests: privacyRequests.count,
        anonymizedPeople: due.length,
        presenceStatuses: presence.count,
      };
      reports.push(report);

      // Trace de l'exécution (identifiants seulement) : une ligne par entreprise ayant eu quelque chose à purger
      if (
        report.auditLogs +
          report.privacyRequests +
          report.anonymizedPeople +
          report.presenceStatuses >
        0
      ) {
        await rawPrisma.auditLog.create({
          data: {
            organizationId,
            actorId: null,
            action: "purge.run",
            resourceType: "Organization",
            resourceId: organizationId,
          },
        });
      }
    } catch (error) {
      failures.push(error);
    }
  }

  // Compteurs de connexion anciens et non verrouillés (clé = empreinte d'e-mail : rien de personnel, mais inutile à garder)
  const loginAttempts = await rawPrisma.loginAttempt.deleteMany({
    where: {
      updatedAt: { lt: retentionCutoff(now, 1) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
  });

  if (failures.length > 0)
    throw new AggregateError(
      failures,
      `Purge incomplète : ${failures.length} entreprise(s) en erreur`,
    );
  return { organizations: reports, loginAttempts: loginAttempts.count };
}
