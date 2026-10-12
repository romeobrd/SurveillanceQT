// Point d'entrée de la couche d'accès aux données : tout passe par un contexte vérifié.
import "server-only";
import type { AccessContext } from "@/lib/auth/permissions";
import {
  layoutsRepository,
  workstationsRepository,
} from "./repositories/layouts";
import { peopleRepository, teamsRepository } from "./repositories/people";
import { createTenantDb } from "./tenant";

export function getRepositories(context: AccessContext) {
  const db = createTenantDb(context.organizationId);
  return {
    people: peopleRepository(db, context),
    teams: teamsRepository(db, context),
    layouts: layoutsRepository(db, context),
    workstations: workstationsRepository(db, context),
  };
}

export type Repositories = ReturnType<typeof getRepositories>;
export { ForbiddenError } from "@/lib/auth/permissions";
export {
  ReassignmentRequiredError,
  InvalidLayoutError,
} from "./repositories/layouts";
export type { Role } from "./types";
