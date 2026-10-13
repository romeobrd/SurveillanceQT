// Versions de carte : enregistrement d'un aménagement (validé côté serveur), réaffectation sans perte,
// historique et restauration. Zones et postes gardent des identifiants stables d'une version à l'autre.
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import { CATALOG } from "@/lib/map/catalog";
import { computeRemovals, LIMITS, validateForSave } from "@/lib/map/edit/save";
import {
  ReassignmentPlanSchema,
  isImpactEmpty,
  type LayoutImpact,
  type ReassignmentPlan,
} from "@/lib/map/edit/plan";
import { LayoutSchema, type Layout } from "@/lib/map/schema";
import { recordAudit } from "../audit";
import { NotFoundError, StaleLayoutError } from "../errors";
import type { Prisma } from "../generated/client";
import type { TenantDb } from "../tenant";
import { recordAssignmentChange } from "./asset-history";

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

export interface SaveOptions {
  plan?: unknown;
  /** Version active vue à l'ouverture de l'éditeur : refuse d'écraser un travail plus récent. */
  baseVersion?: number | null;
  audit?: "layout.save" | "layout.restore";
}

/** Une carte reçue du navigateur n'est jamais crue : taille, schéma, cohérence et accessibilité sont revérifiés. */
export function parseSubmittedLayout(input: unknown): Layout {
  const size = JSON.stringify(input ?? null).length;
  if (size > LIMITS.maxJsonBytes)
    throw new InvalidLayoutError(["carte trop volumineuse"]);
  const layout = LayoutSchema.parse(input);
  const problems = validateForSave(layout);
  if (problems.length > 0) {
    throw new InvalidLayoutError(
      problems.map(
        (problem) =>
          `${problem.code}${problem.detail ? ` (${problem.detail})` : ""}`,
      ),
    );
  }
  return layout;
}

const stationLabel = (layout: Layout, elementKey: string): string => {
  const element = layout.elements.find(
    (candidate) => candidate.id === elementKey,
  );
  return `${(element && CATALOG[element.catalogKey]?.name) ?? "Poste"} (${elementKey})`;
};

export function layoutsRepository(db: TenantDb, context: AccessContext) {
  async function active(): Promise<StoredLayout | null> {
    const row = await db.layout.findFirst({ where: { isActive: true } });
    return row
      ? {
          id: row.id,
          version: row.version,
          layout: LayoutSchema.parse(row.data),
        }
      : null;
  }

  async function computeImpact(next: Layout): Promise<LayoutImpact> {
    const current = await active();
    const removals = current
      ? computeRemovals(current.layout, next)
      : { removedZoneKeys: [], removedWorkstationKeys: [] };

    const assigned = removals.removedWorkstationKeys.length
      ? await db.workstation.findMany({
          where: {
            elementKey: { in: removals.removedWorkstationKeys },
            personId: { not: null },
          },
          select: {
            elementKey: true,
            zone: { select: { name: true } },
            person: { select: { firstName: true, lastName: true } },
          },
          orderBy: { elementKey: "asc" },
        })
      : [];
    const zones = removals.removedZoneKeys.length
      ? await db.zone.findMany({
          where: { key: { in: removals.removedZoneKeys } },
          select: { id: true, key: true, name: true },
        })
      : [];
    const impactedZones: LayoutImpact["zones"] = [];
    for (const zone of zones) {
      const [stockCount, assetCount] = await Promise.all([
        db.stockItem.count({ where: { zoneId: zone.id } }),
        db.asset.count({ where: { zoneId: zone.id } }),
      ]);
      if (stockCount + assetCount > 0) {
        impactedZones.push({
          zoneKey: zone.key,
          name: zone.name,
          stockCount,
          assetCount,
        });
      }
    }

    // Destinations : postes de la nouvelle carte libres (ou nouveaux), pièces de la nouvelle carte
    const occupied = new Set(
      (
        await db.workstation.findMany({
          where: { personId: { not: null } },
          select: { elementKey: true },
        })
      ).map((row) => row.elementKey),
    );
    const zoneNames = new Map(next.zones.map((zone) => [zone.id, zone.name]));
    return {
      workstations: assigned.map((row) => ({
        elementKey: row.elementKey,
        label: current
          ? stationLabel(current.layout, row.elementKey)
          : row.elementKey,
        zoneName: row.zone.name,
        personName: row.person
          ? `${row.person.firstName} ${row.person.lastName}`
          : "",
      })),
      zones: impactedZones,
      targets: {
        workstations: next.elements
          .filter(
            (element) =>
              CATALOG[element.catalogKey]?.isWorkstation &&
              !occupied.has(element.id),
          )
          .map((element) => ({
            elementKey: element.id,
            label: stationLabel(next, element.id),
            zoneName: zoneNames.get(element.zoneId) ?? "",
          })),
        zones: next.zones.map((zone) => ({ key: zone.id, name: zone.name })),
      },
    };
  }

  /** Écrit une version : crée zones et postes, applique le plan de réaffectation, puis supprime le reste. */
  async function commit(
    layout: Layout,
    options: SaveOptions,
  ): Promise<{ id: string; version: number }> {
    const plan: ReassignmentPlan = ReassignmentPlanSchema.parse(
      options.plan ?? {},
    );
    const saved = await db.$transaction(async (tx) => {
      const current = await tx.layout.findFirst({
        where: { isActive: true },
        select: { version: true },
      });
      if (
        options.baseVersion !== undefined &&
        (current?.version ?? null) !== options.baseVersion
      ) {
        throw new StaleLayoutError();
      }
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

      // Zones : création / mise à jour par identifiant stable
      const existingZones = await tx.zone.findMany({
        select: { id: true, key: true },
      });
      const keptKeys = new Set(layout.zones.map((zone) => zone.id));
      const removedZones = existingZones.filter(
        (zone) => !keptKeys.has(zone.key),
      );
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

      // Postes : création / mise à jour par identifiant d'élément
      const wanted = layout.elements.filter(
        (element) => CATALOG[element.catalogKey]?.isWorkstation,
      );
      const wantedKeys = new Set(wanted.map((element) => element.id));
      const stationIdByKey = new Map<string, string>();
      for (const element of wanted) {
        const zoneId = zoneIdByKey.get(element.zoneId);
        if (!zoneId) continue;
        const row = await tx.workstation.upsert({
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
          select: { id: true },
        });
        stationIdByKey.set(element.id, row.id);
      }

      // Rien ne disparaît sans décision : on rassemble d'abord tout ce qui bloque
      const existingStations = await tx.workstation.findMany({
        select: { id: true, elementKey: true, personId: true },
      });
      const removedStations = existingStations.filter(
        (station) => !wantedKeys.has(station.elementKey),
      );
      const blockers: string[] = [];
      const claimedTargets = new Set<string>();
      const stationMoves: Array<{
        fromId: string;
        toId: string;
        personId: string;
      }> = [];
      for (const station of removedStations) {
        if (!station.personId) continue;
        const choice = plan.workstations[station.elementKey];
        if (!choice) {
          blockers.push(`poste ${station.elementKey}`);
          continue;
        }
        if (choice.action === "move") {
          const targetId = stationIdByKey.get(choice.toElementKey);
          const target = existingStations.find(
            (candidate) => candidate.id === targetId,
          );
          if (
            !targetId ||
            claimedTargets.has(targetId) ||
            (target?.personId && target.personId !== station.personId)
          ) {
            blockers.push(`destination du poste ${station.elementKey}`);
            continue;
          }
          claimedTargets.add(targetId);
          stationMoves.push({
            fromId: station.id,
            toId: targetId,
            personId: station.personId,
          });
        }
      }
      const zoneMoves: Array<{ zoneId: string; targetId: string | null }> = [];
      for (const zone of removedZones) {
        const [stockCount, assetCount] = await Promise.all([
          tx.stockItem.count({ where: { zoneId: zone.id } }),
          tx.asset.count({ where: { zoneId: zone.id } }),
        ]);
        if (stockCount + assetCount === 0) continue;
        const choice = plan.zones[zone.key];
        if (!choice) {
          blockers.push(`zone ${zone.key}`);
          continue;
        }
        const targetId =
          choice.action === "move"
            ? (zoneIdByKey.get(choice.toZoneKey) ?? undefined)
            : null;
        if (targetId === undefined) {
          blockers.push(`destination de la zone ${zone.key}`);
          continue;
        }
        zoneMoves.push({ zoneId: zone.id, targetId });
      }
      if (blockers.length > 0) throw new ReassignmentRequiredError(blockers);

      // Application du plan
      for (const move of stationMoves) {
        await tx.workstation.update({
          where: { id: move.fromId },
          data: { personId: null },
        });
        await tx.workstation.update({
          where: { id: move.toId },
          data: { personId: move.personId },
        });
      }
      for (const move of zoneMoves) {
        await tx.stockItem.updateMany({
          where: { zoneId: move.zoneId },
          data: { zoneId: move.targetId },
        });
        const assets = await tx.asset.findMany({
          where: { zoneId: move.zoneId },
          select: { id: true, personId: true },
        });
        for (const asset of assets) {
          await tx.asset.update({
            where: { id: asset.id },
            data: { zoneId: move.targetId },
          });
          await recordAssignmentChange(tx, context.organizationId, asset.id, {
            personId: asset.personId,
            zoneId: move.targetId,
          });
        }
      }
      // L'historique d'affectation garde la personne mais perd la pièce supprimée
      if (removedZones.length > 0) {
        await tx.assetAssignment.updateMany({
          where: { zoneId: { in: removedZones.map((zone) => zone.id) } },
          data: { zoneId: null },
        });
      }
      if (removedStations.length > 0) {
        await tx.workstation.deleteMany({
          where: { id: { in: removedStations.map((station) => station.id) } },
        });
      }
      if (removedZones.length > 0) {
        await tx.zone.deleteMany({
          where: { id: { in: removedZones.map((zone) => zone.id) } },
        });
      }
      return created;
    });
    await recordAudit(db, context, {
      action: options.audit ?? "layout.save",
      resourceType: "Layout",
      resourceId: saved.id,
    });
    return saved;
  }

  return {
    async getActive(): Promise<StoredLayout | null> {
      assertPermission(context, "map:read");
      return active();
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

    /** Contenu d'une version, pour l'ouvrir dans l'éditeur ou la restaurer. */
    async getVersion(
      id: string,
    ): Promise<(StoredLayout & { isActive: boolean }) | null> {
      assertPermission(context, "layout:write");
      const row = await db.layout.findUnique({ where: { id } });
      return row
        ? {
            id: row.id,
            version: row.version,
            isActive: row.isActive,
            layout: LayoutSchema.parse(row.data),
          }
        : null;
    },

    /** Ce qui serait supprimé par l'enregistrement de cette carte (postes attribués, stock et matériel rangés). */
    async previewImpact(input: unknown): Promise<LayoutImpact> {
      assertPermission(context, "layout:write");
      const layout = LayoutSchema.parse(input);
      const impact = await computeImpact(layout);
      await recordAudit(db, context, {
        action: "layout.impact",
        resourceType: "Layout",
      });
      return impact;
    },

    /** Enregistre une nouvelle version active (carte revalidée, plan de réaffectation appliqué). */
    async saveNewVersion(
      input: unknown,
      options: SaveOptions = {},
    ): Promise<{ id: string; version: number }> {
      assertPermission(context, "layout:write");
      return commit(parseSubmittedLayout(input), options);
    },

    /** Restaure une ancienne version : crée une NOUVELLE version identique (rien n'est effacé de l'historique). */
    async restoreVersion(
      versionId: string,
      options: Omit<SaveOptions, "audit"> = {},
    ): Promise<{ id: string; version: number }> {
      assertPermission(context, "layout:write");
      const row = await db.layout.findUnique({ where: { id: versionId } });
      if (!row) throw new NotFoundError("Version");
      return commit(parseSubmittedLayout(row.data), {
        ...options,
        audit: "layout.restore",
      });
    },

    /** Impact de la restauration d'une version. */
    async previewRestore(versionId: string): Promise<LayoutImpact> {
      assertPermission(context, "layout:write");
      const row = await db.layout.findUnique({ where: { id: versionId } });
      if (!row) throw new NotFoundError("Version");
      return computeImpact(LayoutSchema.parse(row.data));
    },
  };
}

export { isImpactEmpty };
