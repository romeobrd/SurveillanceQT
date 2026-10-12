import type { Metadata } from "next";
import { z } from "zod";
import MapExplorer, { type MapMode } from "@/components/MapExplorer";
import type { MapData, Role as UiRole } from "@/features/map/types";
import { getAppContext } from "@/lib/app-context";
import { can } from "@/lib/auth/permissions";
import { firstValues } from "@/features/list-query";
import { fr } from "@/lib/i18n/fr";
import { generateLayout } from "@/lib/map/generator";

export const metadata: Metadata = {
  title: `${fr.map.pageTitle} — ${fr.app.name}`,
};

const UI_ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employe",
} as const satisfies Record<string, UiRole>;
const EMPTY_DATA: MapData = {
  people: [],
  workstations: [],
  stock: [],
  assets: [],
  projects: [],
};
const SeedSchema = z.coerce.number().int().min(0).max(4_294_967_295);

export default async function CartePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = firstValues(await searchParams);
  // Accès vérifié côté serveur : session valide + droit de lecture (lancé par getAppContext et le dépôt)
  const { session, repos } = await getAppContext();
  const canEdit = can(session.role, "layout:write");
  const active = await repos.map.getActive();
  const versions = canEdit
    ? (await repos.layouts.listVersions()).map((version) => ({
        id: version.id,
        version: version.version,
        isActive: version.isActive,
        createdAt: version.createdAt.toISOString(),
      }))
    : [];

  // Aperçu non enregistré : réservé à ceux qui peuvent aménager les locaux
  const previewSeed =
    canEdit && params.seed !== undefined
      ? SeedSchema.safeParse(params.seed)
      : null;
  const common = {
    role: UI_ROLES[session.role],
    canEdit,
    initialZoneId: params.zone ?? null,
    initialProjectId: params.project ?? null,
    baseVersion: active?.version ?? null,
    savedLayout: active?.layout ?? null,
    versions,
  };

  if (previewSeed?.success) {
    return (
      <MapExplorer
        {...common}
        mode="preview"
        layout={generateLayout(previewSeed.data)}
        data={
          active?.data
            ? { ...EMPTY_DATA, projects: active.data.projects }
            : EMPTY_DATA
        }
        seed={previewSeed.data}
        version={null}
        zoneDbIds={{}}
      />
    );
  }
  const mode: MapMode = active ? "active" : "empty";
  return (
    <MapExplorer
      {...common}
      mode={mode}
      layout={active?.layout ?? null}
      data={active?.data ?? EMPTY_DATA}
      seed={active?.layout.seed ?? null}
      version={active?.version ?? null}
      zoneDbIds={active?.zoneDbIds ?? {}}
    />
  );
}
