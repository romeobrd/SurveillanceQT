"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  generateFirstLayoutAction,
  saveLayoutAction,
} from "@/app/(app)/carte/actions";
import ActionForm from "@/components/ui/ActionForm";
import { getPersonMarkers } from "@/features/map/markers";
import type { MapData, Role } from "@/features/map/types";
import { fr } from "@/lib/i18n/fr";
import type { Layout } from "@/lib/map/schema";
import ZonePanel from "./ZonePanel";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <p className="flex h-full items-center justify-center bg-slate-800 text-slate-200">
      {fr.map.loading}
    </p>
  ),
});

export type MapMode = "active" | "preview" | "empty";

interface MapExplorerProps {
  mode: MapMode;
  layout: Layout | null;
  data: MapData;
  seed: number | null;
  version: number | null;
  role: Role;
  /** Droit d'aménager (admin et manager) : génération, aperçu et enregistrement. */
  canEdit: boolean;
  zoneDbIds: Record<string, string>;
  initialZoneId: string | null;
  initialProjectId: string | null;
}

const buttonClass =
  "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600";

export default function MapExplorer({
  mode,
  layout,
  data,
  seed,
  version,
  role,
  canEdit,
  zoneDbIds,
  initialZoneId,
  initialProjectId,
}: MapExplorerProps) {
  const router = useRouter();
  const people = useMemo(() => getPersonMarkers(data), [data]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    layout?.zones.some((zone) => zone.id === initialZoneId)
      ? initialZoneId
      : null,
  );
  const [projectId, setProjectId] = useState<string>(
    data.projects.find((project) => project.id === initialProjectId)?.id ??
      data.projects[0]?.id ??
      "",
  );
  const selectedZone =
    layout?.zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const project = data.projects.find((candidate) => candidate.id === projectId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2">
        <h1 className="text-lg font-semibold">{fr.map.pageTitle}</h1>
        {mode === "preview" && (
          <span
            className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
            data-testid="preview-badge"
          >
            {fr.layout.preview}
          </span>
        )}
        {layout && (
          <span className="text-sm text-slate-600">
            {fr.map.seedLabel} :{" "}
            <output data-testid="seed">{seed ?? "—"}</output>
            {mode === "active" && version !== null && (
              <>
                {" "}
                · {fr.layout.activeVersion} {version}
              </>
            )}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && mode !== "empty" && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/carte?seed=${Math.floor(Math.random() * 1_000_000_000)}`,
                )
              }
              className={`${buttonClass} border border-slate-300 bg-white hover:bg-slate-100`}
            >
              {fr.map.newLayout}
            </button>
          )}
          {mode === "preview" && seed !== null && (
            <>
              <ActionForm
                action={saveLayoutAction}
                submitLabel={fr.layout.saveAsActive}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="seed" value={seed} />
              </ActionForm>
              <Link
                href="/carte"
                className={`${buttonClass} border border-slate-300 bg-white hover:bg-slate-100`}
              >
                {fr.layout.leavePreview}
              </Link>
            </>
          )}
        </div>
      </div>

      {mode === "empty" || !layout ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p>{canEdit ? fr.layout.empty : fr.layout.emptyEmployee}</p>
          {canEdit && (
            <ActionForm
              action={generateFirstLayoutAction}
              submitLabel={fr.layout.generateMine}
            >
              <></>
            </ActionForm>
          )}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="min-h-[50vh] flex-1">
              <MapView
                layout={layout}
                people={people}
                selectedZoneId={selectedZoneId}
                onSelectZone={setSelectedZoneId}
              />
            </div>
            <aside
              aria-label={selectedZone ? selectedZone.name : fr.map.zoneList}
              className="max-h-[45vh] overflow-y-auto border-t border-slate-200 p-4 lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l"
            >
              <ZonePanel
                layout={layout}
                data={data}
                zone={selectedZone}
                role={role}
                zoneDbIds={mode === "active" ? zoneDbIds : {}}
                onSelectZone={setSelectedZoneId}
              />
            </aside>
          </div>
          {data.projects.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2"
              data-testid="project-bar"
            >
              <label htmlFor="map-project" className="text-sm font-medium">
                {fr.layout.project}
              </label>
              <select
                id="map-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm"
              >
                {data.projects.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              {project && (
                <div className="flex min-w-48 flex-1 items-center gap-2">
                  <progress
                    className="h-3 flex-1"
                    value={project.progress}
                    max={100}
                    aria-label={`${project.name} : ${project.progress} %`}
                  />
                  <span
                    className="text-sm font-medium"
                    data-testid="project-progress"
                  >
                    {project.progress} %
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
