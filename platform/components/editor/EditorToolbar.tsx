"use client";

import {
  canRedo,
  canUndo,
  type EditorAction,
  type EditorState,
  type Tool,
} from "@/features/editor/state";
import { fr } from "@/lib/i18n/fr";

const TOOLS: Tool[] = ["select", "zone", "solid", "glass", "door", "erase"];

const toolButton =
  "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 aria-pressed:border-brand-500 aria-pressed:bg-brand-50 aria-pressed:font-medium disabled:opacity-40";

interface EditorToolbarProps {
  state: EditorState;
  dirty: boolean;
  busy: boolean;
  dispatch: (action: EditorAction) => void;
  onSave: () => void;
}

export default function EditorToolbar({
  state,
  dirty,
  busy,
  dispatch,
  onSave,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      <div
        role="group"
        aria-label={fr.editor.title}
        className="flex flex-wrap gap-1"
      >
        {TOOLS.map((tool) => (
          <button
            key={tool}
            type="button"
            aria-pressed={state.tool === tool}
            title={fr.editor.toolHints[tool]}
            onClick={() => dispatch({ type: "set-tool", tool })}
            className={toolButton}
          >
            {fr.editor.tools[tool]}
          </button>
        ))}
      </div>
      <div role="group" aria-label={fr.editor.undo} className="flex gap-1">
        <button
          type="button"
          disabled={!canUndo(state.history)}
          onClick={() => dispatch({ type: "undo" })}
          className={toolButton}
        >
          {fr.editor.undo}
        </button>
        <button
          type="button"
          disabled={!canRedo(state.history)}
          onClick={() => dispatch({ type: "redo" })}
          className={toolButton}
        >
          {fr.editor.redo}
        </button>
      </div>
      <span className="text-xs text-slate-600" data-testid="tool-hint">
        {state.tool === "place" && state.armedKey
          ? fr.editor.toolHints.place
          : fr.editor.toolHints[state.tool]}
      </span>
      <div className="ml-auto flex items-center gap-3">
        <span
          data-testid="dirty-state"
          className={`rounded px-2 py-0.5 text-xs ${dirty ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
        >
          {dirty ? fr.editor.modified : fr.editor.upToDate}
        </span>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={onSave}
          className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600 rounded-md px-4 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {busy ? fr.editor.saving : fr.editor.save}
        </button>
      </div>
    </div>
  );
}
