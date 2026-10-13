// Point d'entrée de la couche d'accès aux données : tout passe par un contexte vérifié.
import "server-only";
import type { AccessContext } from "@/lib/auth/permissions";
import { accountsRepository } from "./repositories/accounts";
import { assetsRepository } from "./repositories/assets";
import { dashboardRepository } from "./repositories/dashboard";
import {
  layoutsRepository,
  workstationsRepository,
  zonesRepository,
} from "./repositories/layouts";
import { mapDataRepository } from "./repositories/map-data";
import { peopleRepository, teamsRepository } from "./repositories/people";
import {
  auditRepository,
  presenceRepository,
  privacyRepository,
  settingsRepository,
} from "./repositories/privacy";
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
    privacy: privacyRepository(db, context),
    presence: presenceRepository(db, context),
    settings: settingsRepository(db, context),
    audit: auditRepository(db, context),
    accounts: accountsRepository(db, context),
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
  WrongPasswordError,
} from "./errors";
export {
  ReassignmentRequiredError,
  InvalidLayoutError,
} from "./repositories/layouts";
export type { Role } from "./types";
