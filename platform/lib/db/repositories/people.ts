// Collaborateurs et équipes. Champs strictement limités à SPEC §4.
import { z } from "zod";
import {
  assertPermission,
  can,
  type AccessContext,
} from "@/lib/auth/permissions";
import { recordAudit } from "../audit";
import type { TenantDb } from "../tenant";

export const PersonInputSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  workEmail: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  jobTitle: z.string().trim().min(1).max(120),
  teamId: z.string().min(1).nullable().optional(),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

export interface DirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  teamId: string | null;
  /** Réservé aux rôles autorisés (people:readDetails). */
  workEmail?: string;
}

export function peopleRepository(db: TenantDb, context: AccessContext) {
  const withDetails = can(context.role, "people:readDetails");
  const select = {
    id: true,
    firstName: true,
    lastName: true,
    jobTitle: true,
    teamId: true,
    workEmail: withDetails,
  } as const;

  const strip = (
    row: DirectoryEntry & { workEmail: string },
  ): DirectoryEntry => {
    const { workEmail, ...rest } = row;
    return withDetails ? { ...rest, workEmail } : rest;
  };

  return {
    /** Annuaire minimal (les e-mails ne sont visibles que des rôles autorisés). */
    async listDirectory(): Promise<DirectoryEntry[]> {
      assertPermission(context, "people:readDirectory");
      const rows = await db.person.findMany({
        where: { status: "ACTIVE" },
        select,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      await recordAudit(db, context, {
        action: "person.list",
        resourceType: "Person",
      });
      return rows.map((row) =>
        strip(row as DirectoryEntry & { workEmail: string }),
      );
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
      return strip(row as DirectoryEntry & { workEmail: string });
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
  };
}

export function teamsRepository(db: TenantDb, context: AccessContext) {
  return {
    async list(): Promise<Array<{ id: string; name: string }>> {
      assertPermission(context, "people:readDirectory");
      return db.team.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    },

    async create(name: string): Promise<{ id: string }> {
      assertPermission(context, "people:write");
      const parsed = z.string().trim().min(1).max(80).parse(name);
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
    },
  };
}
