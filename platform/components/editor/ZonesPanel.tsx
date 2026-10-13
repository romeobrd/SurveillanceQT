"use client";

import { useRef } from "react";
import {
  currentLayout,
  type EditorAction,
  type EditorState,
} from "@/features/editor/state";
import { fr } from "@/lib/i18n/fr";
import {
  removeZone,
  renameZone,
  resizeZone,
  setZoneType,
  type ZoneResult,
} from "@/lib/map/edit";
import { ZONE_TYPES, type ZoneType } from "@/lib/map/schema";
import { ZONE_LABELS } from "@/lib/map/zoneTypes";
import { inputClass, SelectField, TextInput } from "@/components/ui/fields";

const button =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600";

export default function ZonesPanel({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
}) {
  const layout = currentLayout(state);
  const zone =
    layout.zones.find((candidate) => candidate.id === state.selectedZoneId) ??
    null;
  const removeDialog = useRef<HTMLDialogElement>(null);
  const typeOptions = ZONE_TYPES.map((type) => ({
    value: type,
    label: ZONE_LABELS[type],
  }));

  /** Applique une opération sur la pièce, avec retour d'information accessible. */
  function apply(result: ZoneResult) {
    if (result.ok)
      dispatch({
        type: "apply",
        layout: result.layout,
        feedback: { code: "info", detail: fr.editor.feedback.edge_set },
        selectedZoneId: result.id,
      });
    else
      dispatch({
        type: "apply",
        layout,
        feedback: { code: "zone_refused", detail: result.problem },
      });
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="zones-title">
        <h2 id="zones-title" className="text-lg font-semibold">
          {fr.editor.zones.title}
        </h2>
        <div className="my-3 flex flex-wrap items-end gap-2">
          <SelectField
            id="newZoneType"
            label={fr.editor.zones.newType}
            value={state.zoneType}
            onChange={(event) =>
              dispatch({
                type: "set-zone-type",
                zoneType: event.target.value as ZoneType,
              })
            }
            options={typeOptions}
          />
          <button
            type="button"
            aria-pressed={state.tool === "zone"}
            onClick={() => dispatch({ type: "set-tool", tool: "zone" })}
            className={`${button} aria-pressed:border-brand-500 aria-pressed:bg-brand-50`}
          >
            {fr.editor.tools.zone}
          </button>
        </div>
        {layout.zones.length === 0 ? (
          <p className="text-sm text-slate-600">{fr.editor.zones.none}</p>
        ) : (
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {layout.zones.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  aria-pressed={candidate.id === state.selectedZoneId}
                  onClick={() =>
                    dispatch({ type: "select-zone", zoneId: candidate.id })
                  }
                  className="focus-visible:outline-brand-600 aria-pressed:bg-brand-50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 focus-visible:outline-2 aria-pressed:font-medium"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded border border-slate-400"
                    style={{ backgroundColor: candidate.floorColor }}
                  />
                  {candidate.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {zone ? (
        <section
          aria-labelledby="zone-inspector"
          className="rounded-lg border border-slate-200 p-3"
        >
          <h3 id="zone-inspector" className="mb-3 font-semibold">
            {zone.name}
          </h3>
          <form
            key={`${zone.id}:${zone.name}`}
            className="mb-3 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              apply(
                renameZone(
                  layout,
                  zone.id,
                  String(new FormData(event.currentTarget).get("name") ?? ""),
                ),
              );
            }}
          >
            <TextInput
              id="name"
              label={fr.editor.zones.name}
              defaultValue={zone.name}
              maxLength={80}
              required
            />
            <button type="submit" className={button}>
              {fr.editor.zones.apply}
            </button>
          </form>
          <SelectField
            id="zoneType"
            label={fr.editor.zones.type}
            value={zone.type}
            onChange={(event) =>
              apply(
                setZoneType(layout, zone.id, event.target.value as ZoneType),
              )
            }
            options={typeOptions}
          />
          <form
            key={`${zone.id}:${JSON.stringify(zone.rects)}`}
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const num = (key: string) => Number(data.get(key));
              apply(
                resizeZone(layout, zone.id, {
                  x: num("x"),
                  y: num("y"),
                  w: num("w"),
                  h: num("h"),
                }),
              );
            }}
          >
            <fieldset>
              <legend className="mb-1 text-sm font-medium">
                {fr.editor.zones.position}
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["x", fr.editor.zones.x],
                    ["y", fr.editor.zones.y],
                    ["w", fr.editor.zones.w],
                    ["h", fr.editor.zones.h],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1 text-xs">
                    {label}
                    <input
                      name={key}
                      type="number"
                      min={key === "w" || key === "h" ? 2 : 0}
                      step={1}
                      required
                      defaultValue={zone.rects[0][key]}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className={`${button} mt-2`}>
              {fr.editor.zones.apply}
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-600">
            {
              layout.elements.filter((element) => element.zoneId === zone.id)
                .length
            }{" "}
            {fr.editor.zones.elementsCount}
          </p>
          <button
            type="button"
            onClick={() => removeDialog.current?.showModal()}
            className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"
          >
            {fr.editor.zones.remove}
          </button>
          <dialog
            ref={removeDialog}
            aria-labelledby="zone-remove-title"
            className="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-slate-900/50"
          >
            <h2 id="zone-remove-title" className="text-lg font-semibold">
              {fr.editor.zones.removeTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              {fr.editor.zones.removeBody}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  removeDialog.current?.close();
                  const result = removeZone(layout, zone.id);
                  if (result.ok)
                    dispatch({
                      type: "apply",
                      layout: result.layout,
                      feedback: { code: "removed", detail: "1" },
                      selectedZoneId: null,
                    });
                  else apply(result);
                }}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-red-700"
              >
                {fr.common.confirm}
              </button>
              <button
                type="button"
                onClick={() => removeDialog.current?.close()}
                className={button}
              >
                {fr.common.cancel}
              </button>
            </div>
          </dialog>
        </section>
      ) : (
        <p className="text-sm text-slate-600">{fr.editor.zones.selectPrompt}</p>
      )}
    </div>
  );
}
