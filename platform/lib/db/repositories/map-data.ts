// Données de la carte : aménagement actif + occupants, stock, matériel et projets par zone.
import { assertPermission, type AccessContext } from "@/lib/auth/permissions";
import { CATALOG } from "@/lib/map/catalog";
import type { Layout } from "@/lib/map/schema";
import type { MapData } from "@/features/map/types";
import { recordAudit } from "../audit";
import type { TenantDb } from "../tenant";
import { layoutsRepository } from "./layouts";
import { projectsRepository } from "./projects";
import { stockRepository } from "./stock";

export interface ActiveMap {
  layoutId: string;
  version: number;
  layout: Layout;
  data: MapData;
  /** Identifiant en base de chaque zone de la carte (clé de la carte -> id), pour les liens vers les modules. */
  zoneDbIds: Record<string, string>;
}

export function mapDataRepository(db: TenantDb, context: AccessContext) {
  return {
    /** Aménagement actif et données rattachées (null si l'entreprise n'a pas encore de carte). */
    async getActive(): Promise<ActiveMap | null> {
      assertPermission(context, "map:read");
      const active = await layoutsRepository(db, context).getActive();
      if (!active) return null;
      const { layout } = active;

      const rows = await db.workstation.findMany({
        select: {
          elementKey: true,
          personId: true,
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
              team: { select: { name: true } },
            },
          },
        },
      });
      const byElement = new Map(rows.map((row) => [row.elementKey, row]));

      const counters = new Map<string, number>();
      const workstations: MapData["workstations"] = [];
      for (const element of layout.elements) {
        const entry = CATALOG[element.catalogKey];
        if (!entry?.isWorkstation) continue;
        const n = (counters.get(element.zoneId) ?? 0) + 1;
        counters.set(element.zoneId, n);
        workstations.push({
          elementId: element.id,
          zoneId: element.zoneId,
          label: `${entry.name} ${n}`,
          personId: byElement.get(element.id)?.personId ?? null,
        });
      }

      const people = new Map<string, MapData["people"][number]>();
      for (const row of rows) {
        if (row.person) {
          people.set(row.person.id, {
            id: row.person.id,
            firstName: row.person.firstName,
            lastName: row.person.lastName,
            jobTitle: row.person.jobTitle,
            team: row.person.team?.name ?? "",
          });
        }
      }

      const stockItems = await stockRepository(db, context).listItems({});
      const assets = await db.asset.findMany({
        where: { zoneId: { not: null } },
        select: {
          id: true,
          type: true,
          brand: true,
          model: true,
          state: true,
          zone: { select: { key: true } },
        },
        orderBy: [{ type: "asc" }, { id: "asc" }],
      });
      const projects = await projectsRepository(db, context).list({});
      const zones = await db.zone.findMany({ select: { id: true, key: true } });

      await recordAudit(db, context, {
        action: "map.read",
        resourceType: "Layout",
        resourceId: active.id,
      });
      return {
        layoutId: active.id,
        version: active.version,
        layout,
        zoneDbIds: Object.fromEntries(zones.map((zone) => [zone.key, zone.id])),
        data: {
          people: [...people.values()],
          workstations,
          stock: stockItems
            .filter((item) => item.zoneKey)
            .map((item) => ({
              id: item.id,
              zoneId: item.zoneKey as string,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              threshold: item.threshold,
            })),
          assets: assets
            .filter((asset) => asset.zone)
            .map((asset) => ({
              id: asset.id,
              zoneId: (asset.zone as { key: string }).key,
              label: `${asset.type} ${asset.brand} ${asset.model}`,
              state: asset.state,
            })),
          projects: projects.map((project) => ({
            id: project.id,
            name: project.name,
            team: project.teamName ?? "",
            progress: project.progress,
          })),
        },
      };
    },
  };
}
