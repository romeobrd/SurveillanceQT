// Aides pour les tests d'intégration : remise à zéro de la base et jeux de données complets.
// Ne jamais importer hors des tests.
import "server-only";
import { rawPrisma } from "./client";
import {
  seedOrganization,
  type OrganizationSpec,
  type SeededOrganization,
} from "./seed";

if (process.env.NODE_ENV === "production")
  throw new Error("lib/db/testing.ts est interdit en production");

export { rawPrisma as testRawPrisma };

export async function resetDatabase(): Promise<void> {
  await rawPrisma.$executeRawUnsafe(
    `TRUNCATE "DailyMetric","AssetAssignment","AuditLog","PrivacyRequest","PresenceStatus","ProjectStep","Project","Asset","StockMovement","StockItem",` +
      `"Workstation","Zone","Layout","User","Person","Team","LoginAttempt","Organization" CASCADE`,
  );
}

export interface FullFixture extends SeededOrganization {
  ids: Record<string, string>;
}

/** Une entreprise avec au moins une ligne dans CHAQUE table métier. */
export async function seedFullOrganization(
  spec: OrganizationSpec,
): Promise<FullFixture> {
  const base = await seedOrganization(spec);
  const organizationId = base.organizationId;
  const person = base.accounts.employee.personId;
  const zone = await rawPrisma.zone.findFirstOrThrow({
    where: { organizationId },
  });
  const team = await rawPrisma.team.findFirstOrThrow({
    where: { organizationId },
  });
  const stockItem = await rawPrisma.stockItem.create({
    data: {
      organizationId,
      name: "Ramettes A4",
      reference: `REF-${organizationId}`,
      unit: "unités",
      threshold: 5,
      zoneId: zone.id,
    },
  });
  const movement = await rawPrisma.stockMovement.create({
    data: {
      organizationId,
      stockItemId: stockItem.id,
      type: "IN",
      quantity: 10,
      reason: "Réception",
      authorId: base.accounts.manager.userId,
    },
  });
  const asset = await rawPrisma.asset.create({
    data: {
      organizationId,
      type: "Ordinateur",
      brand: "Marque",
      model: "Modèle",
      serialNumber: `SN-${organizationId}`,
      personId: person,
      zoneId: zone.id,
    },
  });
  const assignment = await rawPrisma.assetAssignment.create({
    data: {
      organizationId,
      assetId: asset.id,
      personId: person,
      zoneId: zone.id,
    },
  });
  const project = await rawPrisma.project.create({
    data: { organizationId, name: "Projet test", teamId: team.id },
  });
  const step = await rawPrisma.projectStep.create({
    data: { organizationId, projectId: project.id, name: "Étape 1", order: 1 },
  });
  const presence = await rawPrisma.presenceStatus.create({
    data: {
      organizationId,
      personId: person,
      status: "OFFICE",
      date: new Date(),
    },
  });
  const audit = await rawPrisma.auditLog.create({
    data: {
      organizationId,
      actorId: base.accounts.admin.userId,
      action: "test.fixture",
      resourceType: "Person",
      resourceId: person,
    },
  });
  const privacyRequest = await rawPrisma.privacyRequest.create({
    data: {
      organizationId,
      requesterId: base.accounts.employee.userId,
      type: "ACCESS",
    },
  });
  const metric = await rawPrisma.dailyMetric.create({
    data: {
      organizationId,
      date: new Date("2026-01-05"),
      people: 3,
      workstationsOccupied: 2,
      workstationsTotal: 5,
      lowStock: 1,
      brokenAssets: 0,
    },
  });
  const layout = await rawPrisma.layout.findFirstOrThrow({
    where: { organizationId, isActive: true },
  });
  const workstation = await rawPrisma.workstation.findFirstOrThrow({
    where: { organizationId },
  });

  return {
    ...base,
    ids: {
      Organization: organizationId,
      User: base.accounts.employee.userId,
      Team: team.id,
      Person: person,
      Layout: layout.id,
      Zone: zone.id,
      Workstation: workstation.id,
      StockItem: stockItem.id,
      StockMovement: movement.id,
      Asset: asset.id,
      AssetAssignment: assignment.id,
      Project: project.id,
      ProjectStep: step.id,
      PresenceStatus: presence.id,
      AuditLog: audit.id,
      PrivacyRequest: privacyRequest.id,
      DailyMetric: metric.id,
    },
  };
}

/** Tests e2e : termine l'essai de l'entreprise d'un compte (la date de fin passe dans le passé). */
export async function expireTrial(email: string): Promise<void> {
  const user = await rawPrisma.user.findUniqueOrThrow({
    where: { email: email.toLowerCase() },
    select: { organizationId: true },
  });
  await rawPrisma.organization.update({
    where: { id: user.organizationId },
    data: {
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() - 60_000),
    },
  });
}
