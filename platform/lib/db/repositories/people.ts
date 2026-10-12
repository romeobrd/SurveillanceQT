// Collaborateurs et équipes. Champs strictement limités à SPEC §4.
import {
  assertPermission,
  can,
  type AccessContext,
} from "@/lib/auth/permissions";
import {
  PeopleQuerySchema,
  PersonInputSchema,
  TeamNameSchema,
  type PeopleQuery,
  type PersonInput,
} from "@/features/people/schemas";
import { recordAudit } from "../audit";
import {
  DuplicateError,
  InUseError,
  InvalidOperationError,
  NotFoundError,
  rethrowUnique,
} from "../errors";
import type { TenantDb } from "../tenant";
import { recordAssignmentChange } from "./asset-history";

export { PersonInputSchema, type PersonInput };

export interface DirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  teamId: string | null;
  teamName: string | null;
  /** Zone du poste attribué (lien « voir sur la carte »), null sans poste. */
  zoneKey: string | null;
  /** Réservés aux rôles autorisés (people:readDetails). */
  workEmail?: string;
  status?: "ACTIVE" | "DEPARTED";
}

export function peopleRepository(db: TenantDb, context: AccessContext) {
  const withDetails = can(context.role, "people:readDetails");
  const select = {
    id: true,
    firstName: true,
    lastName: true,
    jobTitle: true,
    teamId: true,
    team: { select: { name: true } },
    workstations: { select: { zone: { select: { key: true } } }, take: 1 },
    workEmail: withDetails,
    status: withDetails,
  } as const;

  type Row = {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    teamId: string | null;
    team: { name: string } | null;
    workstations: Array<{ zone: { key: string } }>;
    workEmail?: string;
    status?: "ACTIVE" | "DEPARTED";
  };

  const toEntry = (row: Row): DirectoryEntry => {
    const { team, workstations, workEmail, status, ...rest } = row;
    return {
      ...rest,
      teamName: team?.name ?? null,
      zoneKey: workstations[0]?.zone.key ?? null,
      ...(withDetails ? { workEmail, status } : {}),
    };
  };

  return {
    /** Liste avec recherche, filtres et tri. Les employés ne voient que les collaborateurs actifs. */
    async list(input: Partial<PeopleQuery> = {}): Promise<DirectoryEntry[]> {
      assertPermission(context, "people:readDirectory");
      const query = PeopleQuerySchema.parse(input);
      const status = withDetails ? query.status : "ACTIVE";
      const search = query.search;
      const rows = await db.person.findMany({
        where: {
          ...(status === "ALL" ? {} : { status }),
          ...(query.teamId ? { teamId: query.teamId } : {}),
          ...(search
            ? {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { jobTitle: { contains: search, mode: "insensitive" } },
                  ...(withDetails
                    ? [
                        {
                          workEmail: {
                            contains: search,
                            mode: "insensitive" as const,
                          },
                        },
                      ]
                    : []),
                ],
              }
            : {}),
        },
        select,
        orderBy: [
          { [query.sort]: query.dir },
          { lastName: "asc" },
          { firstName: "asc" },
          { id: "asc" },
        ],
      });
      await recordAudit(db, context, {
        action: "person.list",
        resourceType: "Person",
      });
      return (rows as Row[]).map(toEntry);
    },

    /** Annuaire minimal (compatibilité) : collaborateurs actifs. */
    listDirectory(): Promise<DirectoryEntry[]> {
      return this.list({});
    },

    async getById(id: string): Promise<DirectoryEntry | null> {
      assertPermission(context, "people:readDirectory");
      const row = await db.person.findUnique({ where: { id }, select });
      if (!row) return null;
      await recordAudit(db, context, {
        action: "person.read",
        resourceType: "Person",
        resourceId: id,
      });
      return toEntry(row as Row);
    },

    async create(input: PersonInput): Promise<{ id: string }> {
      assertPermission(context, "people:write");
      const data = PersonInputSchema.parse(input);
      const person = await db.person.create({
        data: {
          ...data,
          teamId: data.teamId ?? null,
          organizationId: context.organizationId,
        },
        select: { id: true },
      });
      await recordAudit(db, context, {
        action: "person.create",
        resourceType: "Person",
        resourceId: person.id,
      });
      return person;
    },

    async update(id: string, input: PersonInput): Promise<void> {
      assertPermission(context, "people:write");
      const data = PersonInputSchema.parse(input);
      await db.person.update({
        where: { id },
        data: { ...data, teamId: data.teamId ?? null },
      });
      await recordAudit(db, context, {
        action: "person.update",
        resourceType: "Person",
        resourceId: id,
      });
    },

    /**
     * Départ d'un collaborateur : statut « parti », poste libéré, matériel restitué (historique conservé).
     * L'anonymisation de ses données est traitée en phase 6.
     */
    async markDeparted(id: string): Promise<void> {
      assertPermission(context, "people:write");
      await db.$transaction(async (tx) => {
        const person = await tx.person.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!person) throw new NotFoundError("Collaborateur");
        if (person.status === "DEPARTED")
          throw new InvalidOperationError("Collaborateur déjà parti");
        await tx.person.update({ where: { id }, data: { status: "DEPARTED" } });
        await tx.workstation.updateMany({
          where: { personId: id },
          data: { personId: null },
        });
        const assets = await tx.asset.findMany({
          where: { personId: id },
          select: { id: true, zoneId: true },
        });
        for (const asset of assets) {
          await tx.asset.update({
            where: { id: asset.id },
            data: { personId: null },
          });
          await recordAssignmentChange(tx, context.organizationId, asset.id, {
            personId: null,
            zoneId: asset.zoneId,
          });
        }
      });
      await recordAudit(db, context, {
        action: "person.depart",
        resourceType: "Person",
        resourceId: id,
      });
    },
  };
}

export function teamsRepository(db: TenantDb, context: AccessContext) {
  return {
    async list(): Promise<
      Array<{
        id: string;
        name: string;
        peopleCount: number;
        projectCount: number;
      }>
    > {
      assertPermission(context, "people:readDirectory");
      const rows = await db.team.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { people: true, projects: true } },
        },
        orderBy: { name: "asc" },
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        peopleCount: row._count.people,
        projectCount: row._count.projects,
      }));
    },

    async create(name: string): Promise<{ id: string }> {
      assertPermission(context, "people:write");
      const parsed = TeamNameSchema.parse(name);
      try {
        const team = await db.team.create({
          data: { name: parsed, organizationId: context.organizationId },
          select: { id: true },
        });
        await recordAudit(db, context, {
          action: "team.create",
          resourceType: "Team",
          resourceId: team.id,
        });
        return team;
      } catch (error) {
        return rethrowUnique(error, "name");
      }
    },

    async rename(id: string, name: string): Promise<void> {
      assertPermission(context, "people:write");
      const parsed = TeamNameSchema.parse(name);
      try {
        await db.team.update({ where: { id }, data: { name: parsed } });
      } catch (error) {
        return rethrowUnique(error, "name");
      }
      await recordAudit(db, context, {
        action: "team.update",
        resourceType: "Team",
        resourceId: id,
      });
    },

    /** Supprime une équipe vide : refus si des collaborateurs ou des projets y sont rattachés. */
    async delete(id: string): Promise<void> {
      assertPermission(context, "people:write");
      const team = await db.team.findUnique({
        where: { id },
        select: { _count: { select: { people: true, projects: true } } },
      });
      if (!team) throw new NotFoundError("Équipe");
      if (team._count.people > 0)
        throw new InUseError("Équipe", "collaborateurs");
      if (team._count.projects > 0) throw new InUseError("Équipe", "projets");
      await db.team.delete({ where: { id } });
      await recordAudit(db, context, {
        action: "team.delete",
        resourceType: "Team",
        resourceId: id,
      });
    },
  };
}

export { DuplicateError };
