"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import {
  generateFirstLayoutAction,
  saveLayoutAction,
} from "@/app/(app)/carte/actions";
import LayoutEditor from "@/components/editor/LayoutEditor";
import type { VersionInfo } from "@/components/editor/VersionsPanel";
import MapViewLazy from "@/components/MapViewLazy";
import ActionForm from "@/components/ui/ActionForm";
import { getPersonMarkers } from "@/features/map/markers";
import type { MapData, Role } from "@/features/map/types";
import { fr } from "@/lib/i18n/fr";
import { createEmptyLayout } from "@/lib/map/edit";
import type { Layout } from "@/lib/map/schema";
import ZonePanel from "./ZonePanel";

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
  /** Version active (aperçu compris) : l'éditeur refuse d'écraser un travail plus récent. */
  baseVersion: number | null;
  /** Aménagement enregistré, pour « repartir de la carte enregistrée ». */
  savedLayout: Layout | null;
  versions: VersionInfo[];
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
  baseVersion,
  savedLayout,
  versions,
}: MapExplorerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const leaveTitle = useId();
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
        {canEdit && (
          <div
            role="group"
            aria-label={fr.editor.modeLabel}
            className="flex overflow-hidden rounded-md border border-slate-300"
          >
            <button
              type="button"
              aria-pressed={!editing}
              onClick={() =>
                dirty ? leaveDialog.current?.showModal() : setEditing(false)
              }
              className="px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-600 aria-pressed:bg-orange-100 aria-pressed:font-medium"
            >
              {fr.editor.view}
            </button>
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => setEditing(true)}
              className="border-l border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-600 aria-pressed:bg-orange-100 aria-pressed:font-medium"
            >
              {fr.editor.edit}
            </button>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && !editing && mode !== "empty" && (
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
          {mode === "preview" && seed !== null && !editing && (
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

      {editing ? (
        <div className="min-h-0 flex-1">
          <LayoutEditor
            initialLayout={layout ?? createEmptyLayout(24, 20)}
            savedLayout={savedLayout}
            baseVersion={baseVersion}
            people={people}
            versions={versions}
            onDirtyChange={setDirty}
            onSaved={() => {
              setDirty(false);
              setEditing(false);
              router.refresh();
            }}
          />
        </div>
      ) : mode === "empty" || !layout ? (
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
              <MapViewLazy
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
      <dialog
        ref={leaveDialog}
        aria-labelledby={leaveTitle}
        className="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-slate-900/50"
      >
        <h2 id={leaveTitle} className="text-lg font-semibold">
          {fr.editor.leave.title}
        </h2>
        <p className="mt-2 text-sm text-slate-700">{fr.editor.leave.body}</p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => {
              leaveDialog.current?.close();
              setDirty(false);
              setEditing(false);
            }}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-red-700"
          >
            {fr.editor.leave.leave}
          </button>
          <button
            type="button"
            onClick={() => leaveDialog.current?.close()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600"
          >
            {fr.editor.leave.stay}
          </button>
        </div>
      </dialog>
    </div>
  );
}
