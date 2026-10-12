// Point d'entrée de la couche d'accès aux données : tout passe par un contexte vérifié.
import "server-only";
import type { AccessContext } from "@/lib/auth/permissions";
import { assetsRepository } from "./repositories/assets";
import { dashboardRepository } from "./repositories/dashboard";
import {
  layoutsRepository,
  workstationsRepository,
  zonesRepository,
} from "./repositories/layouts";
import { mapDataRepository } from "./repositories/map-data";
import { peopleRepository, teamsRepository } from "./repositories/people";
import { projectsRepository } from "./repositories/projects";
import { stockRepository } from "./repositories/stock";
import { createTenantDb } from "./tenant";

export function getRepositories(context: AccessContext) {
  const db = createTenantDb(context.organizationId);
  return {
    people: peopleRepository(db, context),
    teams: teamsRepository(db, context),
    layouts: layoutsRepository(db, context),
    workstations: workstationsRepository(db, context),
    zones: zonesRepository(db, context),
    stock: stockRepository(db, context),
    assets: assetsRepository(db, context),
    projects: projectsRepository(db, context),
    dashboard: dashboardRepository(db, context),
    map: mapDataRepository(db, context),
  };
}

export type Repositories = ReturnType<typeof getRepositories>;
export { ForbiddenError } from "@/lib/auth/permissions";
export {
  DuplicateError,
  InUseError,
  InsufficientStockError,
  InvalidOperationError,
  NotFoundError,
  StaleLayoutError,
} from "./errors";
export {
  ReassignmentRequiredError,
  InvalidLayoutError,
} from "./repositories/layouts";
export type { Role } from "./types";
