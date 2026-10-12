// Aménagement des locaux : versions de carte, zones et postes de travail (identifiants stables).
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import { CATALOG } from "@/lib/map/catalog";
import { LayoutSchema } from "@/lib/map/schema";
import {
  WorkstationAssignmentSchema,
  WorkstationQuerySchema,
  type WorkstationQuery,
} from "@/features/people/schemas";
import { recordAudit } from "../audit";
import { InvalidOperationError, NotFoundError } from "../errors";
import type { TenantDb } from "../tenant";

export {
  InvalidLayoutError,
  layoutsRepository,
  ReassignmentRequiredError,
} from "./layout-versions";

export interface WorkstationView {
  id: string;
  elementKey: string;
  /** Nom lisible du poste (type d'élément du catalogue + identifiant sur la carte). */
  label: string;
  zoneId: string;
  zoneKey: string;
  zoneName: string;
  personId: string | null;
  personName: string | null;
}

export function workstationsRepository(db: TenantDb, context: AccessContext) {
  return {
    /** Liste des postes (libres / occupés) avec leur zone et leur occupant. */
    async list(
      input: Partial<WorkstationQuery> = {},
    ): Promise<WorkstationView[]> {
      assertPermission(context, "workstation:read");
      const query = WorkstationQuerySchema.parse(input);
      const rows = await db.workstation.findMany({
        where: {
          ...(query.zoneId ? { zoneId: query.zoneId } : {}),
          ...(query.status === "free" ? { personId: null } : {}),
          ...(query.status === "occupied" ? { personId: { not: null } } : {}),
          ...(query.search
            ? {
                OR: [
                  {
                    elementKey: { contains: query.search, mode: "insensitive" },
                  },
                  {
                    zone: {
                      name: { contains: query.search, mode: "insensitive" },
                    },
                  },
                  {
                    person: {
                      lastName: { contains: query.search, mode: "insensitive" },
                    },
                  },
                  {
                    person: {
                      firstName: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          elementKey: true,
          zoneId: true,
          personId: true,
          zone: { select: { key: true, name: true } },
          person: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ zone: { name: "asc" } }, { elementKey: "asc" }],
      });
      await recordAudit(db, context, {
        action: "workstation.list",
        resourceType: "Workstation",
      });
      const active = await db.layout.findFirst({
        where: { isActive: true },
        select: { data: true },
      });
      const catalogKeys = new Map<string, string>(
        active
          ? LayoutSchema.parse(active.data).elements.map((element) => [
              element.id,
              element.catalogKey,
            ])
          : [],
      );
      return rows.map((row) => ({
        id: row.id,
        elementKey: row.elementKey,
        label: `${CATALOG[catalogKeys.get(row.elementKey) ?? ""]?.name ?? "Poste"} (${row.elementKey})`,
        zoneId: row.zoneId,
        zoneKey: row.zone.key,
        zoneName: row.zone.name,
        personId: row.personId,
        personName: row.person
          ? `${row.person.firstName} ${row.person.lastName}`
          : null,
      }));
    },

    /** Attribue (ou libère) un poste. La base refuse une personne d'une autre entreprise. */
    async assign(input: {
      workstationId: string;
      personId?: string | null;
    }): Promise<void> {
      assertPermission(context, "workstation:assign");
      const { workstationId, personId } =
        WorkstationAssignmentSchema.parse(input);
      if (personId) {
        const person = await db.person.findUnique({
          where: { id: personId },
          select: { status: true },
        });
        if (!person) throw new NotFoundError("Collaborateur");
        if (person.status !== "ACTIVE")
          throw new InvalidOperationError("Le collaborateur n'est plus actif");
      }
      await db.workstation.update({
        where: { id: workstationId },
        data: { personId },
      });
      await recordAudit(db, context, {
        action: personId ? "workstation.assign" : "workstation.release",
        resourceType: "Workstation",
        resourceId: workstationId,
      });
    },
  };
}

export function zonesRepository(db: TenantDb, context: AccessContext) {
  return {
    async list(): Promise<
      Array<{ id: string; key: string; name: string; type: string }>
    > {
      assertPermission(context, "map:read");
      return db.zone.findMany({
        select: { id: true, key: true, name: true, type: true },
        orderBy: { name: "asc" },
      });
    },
  };
}
