// Aménagement des locaux : versions de carte, zones et postes de travail (identifiants stables).
import { z } from "zod";
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import { CATALOG } from "@/lib/map/catalog";
import { LayoutSchema, type Layout } from "@/lib/map/schema";
import { validateLayout } from "@/lib/map/validate";
import { recordAudit } from "../audit";
import type { Prisma } from "../generated/client";
import type { TenantDb } from "../tenant";

/** Une zone ou un poste retiré de la carte est encore utilisé : il faut d'abord réaffecter (SPEC §6.4). */
export class ReassignmentRequiredError extends Error {
  constructor(public readonly blockers: string[]) {
    super(
      `Réaffectation nécessaire avant suppression : ${blockers.join(", ")}`,
    );
    this.name = "ReassignmentRequiredError";
  }
}

export class InvalidLayoutError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Carte invalide : ${problems.join(" ; ")}`);
    this.name = "InvalidLayoutError";
  }
}

export interface StoredLayout {
  id: string;
  version: number;
  layout: Layout;
}

export function layoutsRepository(db: TenantDb, context: AccessContext) {
  return {
    async getActive(): Promise<StoredLayout | null> {
      assertPermission(context, "map:read");
      const row = await db.layout.findFirst({ where: { isActive: true } });
      if (!row) return null;
      return {
        id: row.id,
        version: row.version,
        layout: LayoutSchema.parse(row.data),
      };
    },

    async listVersions(): Promise<
      Array<{ id: string; version: number; isActive: boolean; createdAt: Date }>
    > {
      assertPermission(context, "map:read");
      return db.layout.findMany({
        select: { id: true, version: true, isActive: true, createdAt: true },
        orderBy: { version: "desc" },
      });
    },

    /** Enregistre une nouvelle version active et synchronise zones et postes (identifiants stables). */
    async saveNewVersion(
      input: Layout,
    ): Promise<{ id: string; version: number }> {
      assertPermission(context, "layout:write");
      const layout = LayoutSchema.parse(input);
      const problems = validateLayout(layout);
      if (problems.length > 0) throw new InvalidLayoutError(problems);

      const saved = await db.$transaction(async (tx) => {
        const last = await tx.layout.findFirst({
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await tx.layout.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        const created = await tx.layout.create({
          data: {
            organizationId: context.organizationId,
            version: (last?.version ?? 0) + 1,
            data: layout as unknown as Prisma.InputJsonValue,
            authorId: context.userId,
            isActive: true,
          },
          select: { id: true, version: true },
        });

        // Zones : mise à jour par clé stable, suppression refusée si du stock ou du matériel y est rangé
        const existingZones = await tx.zone.findMany({
          select: { id: true, key: true },
        });
        const keptKeys = new Set(layout.zones.map((zone) => zone.id));
        const removedZones = existingZones.filter(
          (zone) => !keptKeys.has(zone.key),
        );
        const blockers: string[] = [];
        for (const zone of removedZones) {
          const stock = await tx.stockItem.count({
            where: { zoneId: zone.id },
          });
          const assets = await tx.asset.count({ where: { zoneId: zone.id } });
          if (stock + assets > 0) blockers.push(`zone ${zone.key}`);
        }
        const zoneIdByKey = new Map<string, string>();
        for (const zone of layout.zones) {
          const row = await tx.zone.upsert({
            where: {
              organizationId_key: {
                organizationId: context.organizationId,
                key: zone.id,
              },
            },
            create: {
              organizationId: context.organizationId,
              key: zone.id,
              name: zone.name,
              type: zone.type,
            },
            update: { name: zone.name, type: zone.type },
            select: { id: true },
          });
          zoneIdByKey.set(zone.id, row.id);
        }

        // Postes : ceux qui disparaissent ne doivent plus être attribués
        const wanted = layout.elements.filter(
          (element) => CATALOG[element.catalogKey]?.isWorkstation,
        );
        const wantedKeys = new Set(wanted.map((element) => element.id));
        const existing = await tx.workstation.findMany({
          select: { id: true, elementKey: true, personId: true },
        });
        for (const workstation of existing) {
          if (!wantedKeys.has(workstation.elementKey) && workstation.personId) {
            blockers.push(`poste ${workstation.elementKey}`);
          }
        }
        if (blockers.length > 0) throw new ReassignmentRequiredError(blockers);

        for (const element of wanted) {
          const zoneId = zoneIdByKey.get(element.zoneId);
          if (!zoneId) continue;
          await tx.workstation.upsert({
            where: {
              organizationId_elementKey: {
                organizationId: context.organizationId,
                elementKey: element.id,
              },
            },
            create: {
              organizationId: context.organizationId,
              elementKey: element.id,
              zoneId,
            },
            update: { zoneId },
          });
        }
        await tx.workstation.deleteMany({
          where: { elementKey: { notIn: [...wantedKeys] } },
        });
        await tx.zone.deleteMany({
          where: { id: { in: removedZones.map((zone) => zone.id) } },
        });
        return created;
      });

      await recordAudit(db, context, {
        action: "layout.save",
        resourceType: "Layout",
        resourceId: saved.id,
      });
      return saved;
    },
  };
}

export const WorkstationAssignmentSchema = z.object({
  workstationId: z.string().min(1),
  personId: z.string().min(1).nullable(),
});

export function workstationsRepository(db: TenantDb, context: AccessContext) {
  return {
    async list(): Promise<
      Array<{
        id: string;
        elementKey: string;
        zoneId: string;
        personId: string | null;
      }>
    > {
      assertPermission(context, "workstation:read");
      return db.workstation.findMany({
        select: { id: true, elementKey: true, zoneId: true, personId: true },
        orderBy: { elementKey: "asc" },
      });
    },

    /** Attribue (ou libère) un poste. La base refuse une personne d'une autre entreprise. */
    async assign(
      input: z.infer<typeof WorkstationAssignmentSchema>,
    ): Promise<void> {
      assertPermission(context, "workstation:assign");
      const { workstationId, personId } =
        WorkstationAssignmentSchema.parse(input);
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
