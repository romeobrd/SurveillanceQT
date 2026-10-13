"use client";

import { CATALOG_DRAG_TYPE } from "@/components/MapView";
import {
  currentLayout,
  type EditorAction,
  type EditorState,
  type Tool,
} from "@/features/editor/state";
import { fr } from "@/lib/i18n/fr";
import { getCatalogForSector, type CatalogCategory } from "@/lib/map/catalog";

const CATEGORIES: CatalogCategory[] = [
  "poste",
  "mobilier",
  "equipement",
  "structure",
];
/** Les éléments de structure se posent avec les outils de la barre. */
const STRUCTURE_TOOLS: Record<string, Tool> = {
  mur: "solid",
  cloison_vitree: "glass",
  porte: "door",
};

const itemClass =
  "flex w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 aria-pressed:border-brand-500 aria-pressed:bg-brand-50";

export default function CatalogPanel({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
}) {
  const entries = getCatalogForSector("bureau");
  const layout = currentLayout(state);
  const selected = layout.elements.filter((element) =>
    state.selection.includes(element.id),
  );
  const button =
    "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600";

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="text-lg font-semibold">
          {fr.editor.catalog.title}
        </h2>
        <p className="mb-3 text-xs text-slate-600">
          {fr.editor.catalog.dragHint}
        </p>
        {CATEGORIES.map((category) => {
          const items = entries.filter((entry) => entry.category === category);
          return (
            <div key={category} className="mb-4">
              <h3 className="mb-1 text-sm font-semibold tracking-wide text-slate-600 uppercase">
                {fr.editor.catalog.categories[category]}
              </h3>
              {category === "structure" && (
                <p className="mb-1 text-xs text-slate-600">
                  {fr.editor.catalog.structureHint}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {items.map((entry) => {
                  const structureTool = STRUCTURE_TOOLS[entry.key];
                  const armed = structureTool
                    ? state.tool === structureTool
                    : state.tool === "place" && state.armedKey === entry.key;
                  return (
                    <li key={entry.key}>
                      <button
                        type="button"
                        aria-pressed={armed}
                        draggable={!structureTool}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            CATALOG_DRAG_TYPE,
                            entry.key,
                          );
                          event.dataTransfer.effectAllowed = "copy";
                          dispatch({
                            type: "set-tool",
                            tool: "place",
                            armedKey: entry.key,
                          });
                        }}
                        onClick={() =>
                          structureTool
                            ? dispatch({
                                type: "set-tool",
                                tool: structureTool,
                              })
                            : dispatch({
                                type: "set-tool",
                                tool: "place",
                                armedKey: entry.key,
                              })
                        }
                        className={itemClass}
                      >
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 rounded border border-slate-400"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="flex-1">{entry.name}</span>
                        {!structureTool && (
                          <span className="text-xs text-slate-500">
                            {entry.w}×{entry.h}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {selected.length > 0 && (
        <section
          aria-labelledby="selection-title"
          className="border-brand-300 bg-brand-50 rounded-lg border p-3"
        >
          <h2 id="selection-title" className="text-sm font-semibold">
            {fr.editor.selection} : {selected.length} {fr.editor.selectedCount}
          </h2>
          <ul className="my-2 text-xs text-slate-700">
            {selected.slice(0, 5).map((element) => (
              <li key={element.id}>
                {entries.find((entry) => entry.key === element.catalogKey)
                  ?.name ?? element.catalogKey}
              </li>
            ))}
            {selected.length > 5 && <li>…</li>}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              onClick={() => dispatch({ type: "rotate" })}
            >
              {fr.editor.rotate} (R)
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"
              onClick={() => dispatch({ type: "delete" })}
            >
              {fr.editor.deleteSelection}
            </button>
          </div>
          <div
            className="mt-2 flex gap-1"
            role="group"
            aria-label={fr.editor.selection}
          >
            {(
              [
                ["←", -1, 0, fr.editor.nudge.left],
                ["↑", 0, -1, fr.editor.nudge.up],
                ["↓", 0, 1, fr.editor.nudge.down],
                ["→", 1, 0, fr.editor.nudge.right],
              ] as const
            ).map(([symbol, dx, dy, label]) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                className={`${button} w-10 text-center`}
                onClick={() => dispatch({ type: "nudge", dx, dy })}
              >
                {symbol}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
