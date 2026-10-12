// Matrice des droits par rôle (SPEC §2). Vérifiée côté serveur, dans chaque dépôt de données.
import type { Role } from "@/lib/db/types";

export const PERMISSIONS = {
  "map:read": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "layout:write": ["ADMIN", "MANAGER"],
  "people:readDirectory": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "people:readDetails": ["ADMIN", "MANAGER"],
  "people:write": ["ADMIN"],
  "workstation:read": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "workstation:assign": ["ADMIN", "MANAGER"],
  "stock:read": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "stock:write": ["ADMIN", "MANAGER"],
  "asset:read": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "asset:write": ["ADMIN", "MANAGER"],
  "project:read": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "project:write": ["ADMIN", "MANAGER"],
  "audit:read": ["ADMIN"],
  "org:settings": ["ADMIN"],
  "users:manage": ["ADMIN"],
  "privacy:manageRequests": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Identité vérifiée côté serveur : n'est construite que depuis la session (jamais depuis une entrée utilisateur). */
export interface AccessContext {
  userId: string;
  organizationId: string;
  role: Role;
  personId: string | null;
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Droit insuffisant : ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function assertPermission(
  context: Pick<AccessContext, "role">,
  permission: Permission,
): void {
  if (!can(context.role, permission)) throw new ForbiddenError(permission);
}
