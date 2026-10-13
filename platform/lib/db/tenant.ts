// Couche d'accès multi-tenant : seul point d'entrée vers les données métier.
import "server-only";
import { rawPrisma } from "./client";
import { scopeArgs } from "./scope";

const MODEL_NAMES = [
  "organization",
  "user",
  "team",
  "person",
  "layout",
  "zone",
  "workstation",
  "stockItem",
  "stockMovement",
  "asset",
  "assetAssignment",
  "project",
  "projectStep",
  "presenceStatus",
  "auditLog",
  "privacyRequest",
  "dailyMetric",
  "emailToken",
] as const;

function extend(organizationId: string) {
  return rawPrisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args, organizationId));
        },
      },
    },
  });
}

type Extended = ReturnType<typeof extend>;

/**
 * Accès aux données limité à une entreprise. Ne donne accès qu'aux modèles (pas au SQL brut) :
 * l'identifiant d'entreprise vient toujours de la session, jamais d'une entrée utilisateur.
 */
export type TenantDb = Pick<
  Extended,
  (typeof MODEL_NAMES)[number] | "$transaction"
> & {
  readonly organizationId: string;
};

export function createTenantDb(organizationId: string): TenantDb {
  const extended = extend(organizationId);
  const facade: Record<string, unknown> = { organizationId };
  for (const name of MODEL_NAMES) facade[name] = extended[name];
  facade.$transaction = extended.$transaction.bind(extended);
  return facade as TenantDb;
}
