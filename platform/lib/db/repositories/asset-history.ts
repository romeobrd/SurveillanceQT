// Historique d'affectation du matériel : une ligne ouverte par affectation en cours.

/** Ce dont l'historique a besoin : fonctionne avec l'accès multi-tenant comme avec une transaction directe. */
interface AssignmentWriter {
  assetAssignment: {
    updateMany(args: {
      where: { assetId: string; releasedAt: null };
      data: { releasedAt: Date };
    }): Promise<unknown>;
    create(args: {
      data: {
        organizationId: string;
        assetId: string;
        personId: string | null;
        zoneId: string | null;
        assignedAt: Date;
      };
    }): Promise<unknown>;
  };
}

/** Ferme l'affectation en cours et en ouvre une nouvelle si l'actif a une personne ou une zone. */
export async function recordAssignmentChange(
  db: AssignmentWriter,
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
