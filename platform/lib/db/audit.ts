// Journal d'audit : n'enregistre que des identifiants, jamais de données personnelles.
import type { AccessContext } from "@/lib/auth/permissions";
import type { TenantDb } from "./tenant";

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
}

type AuditWriter = Pick<TenantDb, "auditLog">;

export async function recordAudit(
  db: AuditWriter,
  context: AccessContext,
  entry: AuditEntry,
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: context.organizationId,
      actorId: context.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
    },
  });
}
