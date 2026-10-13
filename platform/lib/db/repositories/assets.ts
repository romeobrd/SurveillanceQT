// Parc informatique : matériel, état, affectation (personne et/ou zone) et historique.
import {
  assertPermission,
  can,
  type AccessContext,
} from "@/lib/auth/permissions";
import {
  AssetInputSchema,
  AssetQuerySchema,
  ASSET_STATES,
  type AssetInput,
  type AssetQuery,
} from "@/features/assets/schemas";
import { recordAudit } from "../audit";
import { InvalidOperationError, NotFoundError, rethrowUnique } from "../errors";
import type { TenantDb } from "../tenant";
import { recordAssignmentChange } from "./asset-history";

export interface AssetView {
  id: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  state: (typeof ASSET_STATES)[number];
  purchaseDate: Date | null;
  personId: string | null;
  personName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  zoneKey: string | null;
}

const select = {
  id: true,
  type: true,
  brand: true,
  model: true,
  serialNumber: true,
  state: true,
  purchaseDate: true,
  personId: true,
  zoneId: true,
  person: { select: { firstName: true, lastName: true } },
  zone: { select: { name: true, key: true } },
} as const;

type Row = {
  id: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  state: AssetView["state"];
  purchaseDate: Date | null;
  personId: string | null;
  zoneId: string | null;
  person: { firstName: string; lastName: string } | null;
  zone: { name: string; key: string } | null;
};

const toView = (row: Row): AssetView => ({
  id: row.id,
  type: row.type,
  brand: row.brand,
  model: row.model,
  serialNumber: row.serialNumber,
  state: row.state,
  purchaseDate: row.purchaseDate,
  personId: row.personId,
  personName: row.person
    ? `${row.person.firstName} ${row.person.lastName}`
    : null,
  zoneId: row.zoneId,
  zoneName: row.zone?.name ?? null,
  zoneKey: row.zone?.key ?? null,
});

export function assetsRepository(db: TenantDb, context: AccessContext) {
  const seesAll = can(context.role, "asset:write");

  /** Un employé ne voit que son propre matériel. */
  const ownershipFilter = seesAll
    ? {}
    : { personId: context.personId ?? "__aucun__" };

  async function assertPersonActive(
    personId: string | null | undefined,
  ): Promise<void> {
    if (!personId) return;
    const person = await db.person.findUnique({
      where: { id: personId },
      select: { status: true },
    });
    if (!person) throw new NotFoundError("Collaborateur");
    if (person.status !== "ACTIVE")
      throw new InvalidOperationError("Le collaborateur n'est plus actif");
  }

  return {
    async list(input: Partial<AssetQuery> = {}): Promise<AssetView[]> {
      assertPermission(context, "asset:read");
      const query = AssetQuerySchema.parse(input);
      const rows = await db.asset.findMany({
        where: {
          ...ownershipFilter,
          ...(query.state === "ALL" ? {} : { state: query.state }),
          ...(query.zoneId ? { zoneId: query.zoneId } : {}),
          ...(query.personId && seesAll ? { personId: query.personId } : {}),
          ...(query.search
            ? {
                OR: [
                  { type: { contains: query.search, mode: "insensitive" } },
                  { brand: { contains: query.search, mode: "insensitive" } },
                  { model: { contains: query.search, mode: "insensitive" } },
                  {
                    serialNumber: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },
        select,
        orderBy: [{ [query.sort]: query.dir }, { id: "asc" }],
      });
      await recordAudit(db, context, {
        action: "asset.list",
        resourceType: "Asset",
      });
      return (rows as Row[]).map(toView);
    },

    async getDetail(id: string) {
      assertPermission(context, "asset:read");
      const row = await db.asset.findFirst({
        where: { id, ...ownershipFilter },
        select,
      });
      if (!row) return null;
      const history = await db.assetAssignment.findMany({
        where: { assetId: id },
        select: {
          id: true,
          assignedAt: true,
          releasedAt: true,
          person: { select: { firstName: true, lastName: true } },
          zone: { select: { name: true } },
        },
        orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      });
      await recordAudit(db, context, {
        action: "asset.read",
        resourceType: "Asset",
        resourceId: id,
      });
      return {
        asset: toView(row as Row),
        history: history.map((entry) => ({
          id: entry.id,
          assignedAt: entry.assignedAt,
          releasedAt: entry.releasedAt,
          personName: entry.person
            ? `${entry.person.firstName} ${entry.person.lastName}`
            : null,
          zoneName: entry.zone?.name ?? null,
        })),
      };
    },

    async create(input: AssetInput): Promise<{ id: string }> {
      assertPermission(context, "asset:write");
      const data = AssetInputSchema.parse(input);
      await assertPersonActive(data.personId);
      try {
        const id = await db.$transaction(async (tx) => {
          const asset = await tx.asset.create({
            data: {
              ...data,
              personId: data.personId ?? null,
              zoneId: data.zoneId ?? null,
              organizationId: context.organizationId,
            },
            select: { id: true },
          });
          await recordAssignmentChange(tx, context.organizationId, asset.id, {
            personId: data.personId ?? null,
            zoneId: data.zoneId ?? null,
          });
          return asset.id;
        });
        await recordAudit(db, context, {
          action: "asset.create",
          resourceType: "Asset",
          resourceId: id,
        });
        return { id };
      } catch (error) {
        return rethrowUnique(error, "serialNumber");
      }
    },

    async update(id: string, input: AssetInput): Promise<void> {
      assertPermission(context, "asset:write");
      const data = AssetInputSchema.parse(input);
      const next = {
        personId: data.personId ?? null,
        zoneId: data.zoneId ?? null,
      };
      try {
        await db.$transaction(async (tx) => {
          const current = await tx.asset.findUnique({
            where: { id },
            select: { personId: true, zoneId: true },
          });
          if (!current) throw new NotFoundError("Matériel");
          if (next.personId && next.personId !== current.personId) {
            const person = await tx.person.findUnique({
              where: { id: next.personId },
              select: { status: true },
            });
            if (!person) throw new NotFoundError("Collaborateur");
            if (person.status !== "ACTIVE")
              throw new InvalidOperationError(
                "Le collaborateur n'est plus actif",
              );
          }
          await tx.asset.update({ where: { id }, data: { ...data, ...next } });
          if (
            current.personId !== next.personId ||
            current.zoneId !== next.zoneId
          ) {
            await recordAssignmentChange(tx, context.organizationId, id, next);
          }
        });
      } catch (error) {
        return rethrowUnique(error, "serialNumber");
      }
      await recordAudit(db, context, {
        action: "asset.update",
        resourceType: "Asset",
        resourceId: id,
      });
    },

    async setState(
      id: string,
      state: (typeof ASSET_STATES)[number],
    ): Promise<void> {
      assertPermission(context, "asset:write");
      const parsed = AssetInputSchema.shape.state.parse(state);
      await db.asset.update({ where: { id }, data: { state: parsed } });
      await recordAudit(db, context, {
        action: "asset.state",
        resourceType: "Asset",
        resourceId: id,
      });
    },

    async delete(id: string): Promise<void> {
      assertPermission(context, "asset:write");
      const existing = await db.asset.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError("Matériel");
      await db.asset.delete({ where: { id } });
      await recordAudit(db, context, {
        action: "asset.delete",
        resourceType: "Asset",
        resourceId: id,
      });
    },
  };
}
