// Stock : articles et mouvements. La quantité est calculée à partir des mouvements.
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import {
  computeQuantity,
  isBelowThreshold,
  movementDelta,
  type MovementKind,
} from "@/features/stock/quantity";
import {
  MovementInputSchema,
  StockItemInputSchema,
  StockQuerySchema,
  type MovementInput,
  type StockItemInput,
  type StockQuery,
} from "@/features/stock/schemas";
import { recordAudit } from "../audit";
import {
  InsufficientStockError,
  InvalidOperationError,
  NotFoundError,
  rethrowUnique,
} from "../errors";
import type { TenantDb } from "../tenant";

export interface StockItemView {
  id: string;
  name: string;
  reference: string;
  unit: string;
  threshold: number;
  zoneId: string | null;
  zoneName: string | null;
  zoneKey: string | null;
  quantity: number;
  isLow: boolean;
}

type Reader = Pick<TenantDb, "stockMovement">;

async function quantitiesByItem(
  db: Reader,
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const sums = await db.stockMovement.groupBy({
    by: ["stockItemId", "type"],
    where: { stockItemId: { in: itemIds } },
    _sum: { quantity: true },
  });
  const grouped = new Map<
    string,
    Array<{ type: MovementKind; quantity: number }>
  >();
  for (const row of sums) {
    const list = grouped.get(row.stockItemId) ?? [];
    list.push({ type: row.type, quantity: row._sum.quantity ?? 0 });
    grouped.set(row.stockItemId, list);
  }
  return new Map(
    itemIds.map((id) => [id, computeQuantity(grouped.get(id) ?? [])]),
  );
}

const itemSelect = {
  id: true,
  name: true,
  reference: true,
  unit: true,
  threshold: true,
  zoneId: true,
  zone: { select: { name: true, key: true } },
} as const;

export function stockRepository(db: TenantDb, context: AccessContext) {
  async function listItems(
    input: Partial<StockQuery> = {},
  ): Promise<StockItemView[]> {
    assertPermission(context, "stock:read");
    const query = StockQuerySchema.parse(input);
    const rows = await db.stockItem.findMany({
      where: {
        ...(query.zoneId ? { zoneId: query.zoneId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { reference: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: itemSelect,
    });
    const quantities = await quantitiesByItem(
      db,
      rows.map((row) => row.id),
    );
    const items: StockItemView[] = rows.map((row) => {
      const quantity = quantities.get(row.id) ?? 0;
      return {
        id: row.id,
        name: row.name,
        reference: row.reference,
        unit: row.unit,
        threshold: row.threshold,
        zoneId: row.zoneId,
        zoneName: row.zone?.name ?? null,
        zoneKey: row.zone?.key ?? null,
        quantity,
        isLow: isBelowThreshold(quantity, row.threshold),
      };
    });
    const filtered =
      query.alert === "low" ? items.filter((item) => item.isLow) : items;
    const factor = query.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const primary =
        query.sort === "quantity"
          ? a.quantity - b.quantity
          : a[query.sort].localeCompare(b[query.sort], "fr");
      return (
        factor * primary ||
        a.name.localeCompare(b.name, "fr") ||
        a.id.localeCompare(b.id)
      );
    });
  }

  return {
    listItems,

    async getItem(id: string) {
      assertPermission(context, "stock:read");
      const row = await db.stockItem.findUnique({
        where: { id },
        select: itemSelect,
      });
      if (!row) return null;
      const quantity = (await quantitiesByItem(db, [id])).get(id) ?? 0;
      const movements = await db.stockMovement.findMany({
        where: { stockItemId: id },
        select: {
          id: true,
          type: true,
          quantity: true,
          reason: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      });
      const view: StockItemView = {
        id: row.id,
        name: row.name,
        reference: row.reference,
        unit: row.unit,
        threshold: row.threshold,
        zoneId: row.zoneId,
        zoneName: row.zone?.name ?? null,
        zoneKey: row.zone?.key ?? null,
        quantity,
        isLow: isBelowThreshold(quantity, row.threshold),
      };
      return { item: view, movements };
    },

    async createItem(input: StockItemInput): Promise<{ id: string }> {
      assertPermission(context, "stock:write");
      const data = StockItemInputSchema.parse(input);
      try {
        const item = await db.stockItem.create({
          data: {
            ...data,
            zoneId: data.zoneId ?? null,
            organizationId: context.organizationId,
          },
          select: { id: true },
        });
        await recordAudit(db, context, {
          action: "stock.create",
          resourceType: "StockItem",
          resourceId: item.id,
        });
        return item;
      } catch (error) {
        return rethrowUnique(error, "reference");
      }
    },

    async updateItem(id: string, input: StockItemInput): Promise<void> {
      assertPermission(context, "stock:write");
      const data = StockItemInputSchema.parse(input);
      try {
        await db.stockItem.update({
          where: { id },
          data: { ...data, zoneId: data.zoneId ?? null },
        });
      } catch (error) {
        return rethrowUnique(error, "reference");
      }
      await recordAudit(db, context, {
        action: "stock.update",
        resourceType: "StockItem",
        resourceId: id,
      });
    },

    /** Supprime l'article et son historique de mouvements (après confirmation côté interface). */
    async deleteItem(id: string): Promise<void> {
      assertPermission(context, "stock:write");
      await db.$transaction(async (tx) => {
        const item = await tx.stockItem.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!item) throw new NotFoundError("Article");
        await tx.stockMovement.deleteMany({ where: { stockItemId: id } });
        await tx.stockItem.delete({ where: { id } });
      });
      await recordAudit(db, context, {
        action: "stock.delete",
        resourceType: "StockItem",
        resourceId: id,
      });
    },

    /** Enregistre un mouvement. Refuse un stock négatif ; sérialisé pour résister aux accès concurrents. */
    async addMovement(
      input: MovementInput,
    ): Promise<{ id: string; quantity: number }> {
      assertPermission(context, "stock:write");
      const data = MovementInputSchema.parse(input);
      const delta = movementDelta(data.type, data.quantity);
      if (data.type !== "ADJUSTMENT" && data.quantity <= 0) {
        throw new InvalidOperationError(
          "La quantité d'une entrée ou d'une sortie doit être positive",
        );
      }
      if (data.type === "ADJUSTMENT" && data.quantity === 0) {
        throw new InvalidOperationError("Un ajustement ne peut pas être nul");
      }

      for (let attempt = 0; ; attempt++) {
        try {
          const result = await db.$transaction(
            async (tx) => {
              const item = await tx.stockItem.findUnique({
                where: { id: data.stockItemId },
                select: { id: true },
              });
              if (!item) throw new NotFoundError("Article");
              const current =
                (await quantitiesByItem(tx, [item.id])).get(item.id) ?? 0;
              if (current + delta < 0)
                throw new InsufficientStockError(current, Math.abs(delta));
              const movement = await tx.stockMovement.create({
                data: {
                  organizationId: context.organizationId,
                  stockItemId: item.id,
                  type: data.type,
                  quantity: data.quantity,
                  reason: data.reason,
                  authorId: context.userId,
                },
                select: { id: true },
              });
              return { id: movement.id, quantity: current + delta };
            },
            { isolationLevel: "Serializable" },
          );
          await recordAudit(db, context, {
            action: "stock.movement",
            resourceType: "StockMovement",
            resourceId: result.id,
          });
          return result;
        } catch (error) {
          // Conflit de sérialisation (P2034) : on réessaie quelques fois
          const code = (error as { code?: string }).code;
          if (code === "P2034" && attempt < 3) continue;
          throw error;
        }
      }
    },
  };
}
