// Import CSV de collaborateurs, de matériel et d'articles de stock.
// Mêmes règles que les formulaires, plus : doublons avec l'existant, limite de l'offre, import journalisé.
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import { getPlan } from "@/features/billing/plans";
import {
  parseImport,
  type AssetRow,
  type ImportKind,
  type ImportLine,
  type ImportRow,
  type PeopleRow,
  type StockRow,
} from "@/features/import/csv";
import { recordAudit } from "../audit";
import type { TenantDb } from "../tenant";

const PERMISSION: Record<ImportKind, Permission> = {
  collaborateurs: "people:write",
  materiel: "asset:write",
  stock: "stock:write",
};

export interface ImportPreview {
  kind: ImportKind;
  fileErrors: string[];
  total: number;
  valid: number;
  /** Lignes refusées, avec leurs erreurs (les lignes valides ne sont pas renvoyées). */
  rejected: Array<{ line: number; errors: string[] }>;
}

export interface ImportResult {
  created: number;
  skipped: number;
}

export function importRepository(db: TenantDb, context: AccessContext) {
  /** Marque les lignes en conflit avec les données existantes ou au-delà de la limite de l'offre. */
  async function check(kind: ImportKind, csv: string) {
    const parsed = parseImport(kind, csv);
    const lines = parsed.lines as ImportLine<ImportRow>[];
    const reject = (line: ImportLine<ImportRow>, error: string) => {
      line.data = null;
      line.errors.push(error);
    };
    const valid = () => lines.filter((line) => line.data !== null);

    if (kind === "collaborateurs") {
      const emails = valid().map((line) => (line.data as PeopleRow).workEmail);
      const existing = new Set(
        (
          await db.person.findMany({
            where: { workEmail: { in: emails, mode: "insensitive" } },
            select: { workEmail: true },
          })
        ).map((person) => person.workEmail.toLowerCase()),
      );
      for (const line of valid())
        if (existing.has((line.data as PeopleRow).workEmail.toLowerCase()))
          reject(line, "E-mail : collaborateur déjà enregistré");
      // Limite de l'offre : les lignes au-delà de la place restante sont refusées
      const [organization, active] = await Promise.all([
        db.organization.findUnique({
          where: { id: context.organizationId },
          select: { plan: true },
        }),
        db.person.count({ where: { status: "ACTIVE" } }),
      ]);
      const plan = getPlan(organization?.plan ?? "");
      let room = Math.max(0, plan.maxPeople - active);
      for (const line of valid()) {
        if (room > 0) room--;
        else
          reject(
            line,
            `Limite de l'offre ${plan.name} atteinte (${plan.maxPeople} collaborateurs)`,
          );
      }
    } else if (kind === "materiel") {
      const serials = valid().map(
        (line) => (line.data as AssetRow).serialNumber,
      );
      const existing = new Set(
        (
          await db.asset.findMany({
            where: { serialNumber: { in: serials, mode: "insensitive" } },
            select: { serialNumber: true },
          })
        ).map((asset) => asset.serialNumber.toLowerCase()),
      );
      for (const line of valid())
        if (existing.has((line.data as AssetRow).serialNumber.toLowerCase()))
          reject(line, "Numéro de série : déjà enregistré");
    } else {
      const references = valid().map(
        (line) => (line.data as StockRow).reference,
      );
      const existing = new Set(
        (
          await db.stockItem.findMany({
            where: { reference: { in: references, mode: "insensitive" } },
            select: { reference: true },
          })
        ).map((item) => item.reference.toLowerCase()),
      );
      for (const line of valid())
        if (existing.has((line.data as StockRow).reference.toLowerCase()))
          reject(line, "Référence : déjà enregistrée");
    }
    return { fileErrors: parsed.fileErrors, lines };
  }

  return {
    async preview(kind: ImportKind, csv: string): Promise<ImportPreview> {
      assertPermission(context, PERMISSION[kind]);
      const { fileErrors, lines } = await check(kind, csv);
      return {
        kind,
        fileErrors,
        total: lines.length,
        valid: lines.filter((line) => line.data !== null).length,
        rejected: lines
          .filter((line) => line.data === null)
          .map(({ line, errors }) => ({ line, errors })),
      };
    },

    /** Importe les lignes valides en une seule transaction ; les lignes refusées sont ignorées. */
    async run(kind: ImportKind, csv: string): Promise<ImportResult> {
      assertPermission(context, PERMISSION[kind]);
      const { fileErrors, lines } = await check(kind, csv);
      const rows = fileErrors.length
        ? []
        : lines.flatMap((line) => (line.data ? [line.data] : []));
      const skipped = lines.length - rows.length;
      if (rows.length === 0) return { created: 0, skipped };
      const organizationId = context.organizationId;

      const created = await db.$transaction(
        async (tx) => {
          if (kind === "collaborateurs") {
            const people = rows as PeopleRow[];
            // Équipes : réutilise celles qui existent (sans tenir compte de la casse), crée les autres
            const teams = new Map(
              (
                await tx.team.findMany({ select: { id: true, name: true } })
              ).map((team) => [team.name.toLowerCase(), team.id]),
            );
            for (const name of new Set(
              people.map((row) => row.team).filter(Boolean),
            )) {
              if (teams.has(name.toLowerCase())) continue;
              const team = await tx.team.create({
                data: { name, organizationId },
                select: { id: true },
              });
              teams.set(name.toLowerCase(), team.id);
              await recordAudit(tx, context, {
                action: "team.create",
                resourceType: "Team",
                resourceId: team.id,
              });
            }
            const created = await tx.person.createManyAndReturn({
              data: people.map(({ team, ...person }) => ({
                ...person,
                teamId: team ? (teams.get(team.toLowerCase()) ?? null) : null,
                organizationId,
              })),
              select: { id: true },
            });
            return {
              ids: created.map((row) => row.id),
              resource: "Person",
              action: "person.import",
            };
          }
          if (kind === "materiel") {
            const created = await tx.asset.createManyAndReturn({
              data: (rows as AssetRow[]).map((asset) => ({
                ...asset,
                organizationId,
              })),
              select: { id: true },
            });
            return {
              ids: created.map((row) => row.id),
              resource: "Asset",
              action: "asset.import",
            };
          }
          const items = rows as StockRow[];
          const created = await tx.stockItem.createManyAndReturn({
            data: items.map((item) => ({
              name: item.name,
              reference: item.reference,
              unit: item.unit,
              threshold: item.threshold,
              organizationId,
            })),
            select: { id: true, reference: true },
          });
          // Quantité initiale : un mouvement d'entrée par article, comme une saisie manuelle
          const quantities = new Map(
            items.map((item) => [item.reference, item.quantity]),
          );
          await tx.stockMovement.createMany({
            data: created
              .filter((item) => (quantities.get(item.reference) ?? 0) > 0)
              .map((item) => ({
                organizationId,
                stockItemId: item.id,
                type: "IN" as const,
                quantity: quantities.get(item.reference) ?? 0,
                reason: "Import CSV",
                authorId: context.userId,
              })),
          });
          return {
            ids: created.map((row) => row.id),
            resource: "StockItem",
            action: "stock.import",
          };
        },
        { timeout: 30_000 },
      );
      // Journal : une entrée par élément créé (identifiants uniquement)
      await db.auditLog.createMany({
        data: created.ids.map((id) => ({
          organizationId,
          actorId: context.userId,
          action: created.action,
          resourceType: created.resource,
          resourceId: id,
        })),
      });
      return { created: created.ids.length, skipped };
    },
  };
}
