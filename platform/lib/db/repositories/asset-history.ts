// Historique d'affectation du matériel : une ligne ouverte par affectation en cours.
import type { TenantDb } from "../tenant";

type Writer = Pick<TenantDb, "assetAssignment">;

/** Ferme l'affectation en cours et en ouvre une nouvelle si l'actif a une personne ou une zone. */
export async function recordAssignmentChange(
  db: Writer,
  organizationId: string,
  assetId: string,
  next: { personId: string | null; zoneId: string | null },
): Promise<void> {
  const now = new Date();
  await db.assetAssignment.updateMany({
    where: { assetId, releasedAt: null },
    data: { releasedAt: now },
  });
  if (next.personId || next.zoneId) {
    await db.assetAssignment.create({
      data: {
        organizationId,
        assetId,
        personId: next.personId,
        zoneId: next.zoneId,
        assignedAt: now,
      },
    });
  }
}
