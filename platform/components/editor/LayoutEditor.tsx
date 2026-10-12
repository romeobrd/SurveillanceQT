"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  previewLayoutImpactAction,
  saveEditedLayoutAction,
} from "@/app/(app)/carte/actions";
import MapViewLazy from "@/components/MapViewLazy";
import {
  createEditor,
  currentLayout,
  deriveOverlay,
  isDirty,
  keyAction,
  reduce,
  type EditorAction,
  type EditorState,
} from "@/features/editor/state";
import { fr } from "@/lib/i18n/fr";
import type { EditorBridge } from "@/lib/map-renderer/MapRenderer";
import { validateForSave, type SaveProblem } from "@/lib/map/edit/save";
import {
  isImpactEmpty,
  type LayoutImpact,
  type ReassignmentPlan,
} from "@/lib/map/edit/plan";
import type { PersonMarker } from "@/lib/map/scene";
import type { Layout } from "@/lib/map/schema";
import CatalogPanel from "./CatalogPanel";
import EditorToolbar from "./EditorToolbar";
import ImpactDialog from "./ImpactDialog";
import { feedbackText, problemText } from "./messages";
import StartPanel from "./StartPanel";
import VersionsPanel, { type VersionInfo } from "./VersionsPanel";
import ZonesPanel from "./ZonesPanel";

type Tab = "catalog" | "zones" | "versions" | "start";
const TABS: Tab[] = ["catalog", "zones", "versions", "start"];

interface LayoutEditorProps {
  initialLayout: Layout;
  /** Carte enregistrée (active), pour « repartir de la carte enregistrée ». */
  savedLayout: Layout | null;
  /** Version active à l'ouverture : l'enregistrement refuse d'écraser un travail plus récent. */
  baseVersion: number | null;
  people: readonly PersonMarker[];
  versions: VersionInfo[];
  onDirtyChange: (dirty: boolean) => void;
  /** Appelé après un enregistrement ou une restauration réussis. */
  onSaved: () => void;
}

export default function LayoutEditor({
  initialLayout,
  savedLayout,
  baseVersion,
  people,
  versions,
  onDirtyChange,
  onSaved,
}: LayoutEditorProps) {
  const [state, setState] = useState<EditorState>(() =>
    createEditor(initialLayout),
  );
  const stateRef = useRef(state);
  const [tab, setTab] = useState<Tab>("catalog");
  const [pending, startTransition] = useTransition();
  const [problems, setProblems] = useState<SaveProblem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [impact, setImpact] = useState<LayoutImpact | null>(null);

  // Le réducteur est appliqué de façon synchrone sur une référence : la passerelle de la carte lit toujours
  // l'état le plus récent, même entre deux rendus React.
  const dispatch = useCallback((action: EditorAction) => {
    const next = reduce(stateRef.current, action);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const layout = currentLayout(state);
  const dirty = isDirty(state);
  const overlay = useMemo(() => deriveOverlay(state), [state]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const bridge = useMemo<EditorBridge>(
    () => ({
      onPointerDown: (pointer) => {
        dispatch({
          type: "pointer-down",
          tile: pointer.tile,
          grid: pointer.grid,
          shift: pointer.shift,
        });
        const current = stateRef.current;
        return current.drag !== null || current.tool !== "select";
      },
      onPointerMove: (pointer) =>
        dispatch({
          type: "pointer-move",
          tile: pointer.tile,
          grid: pointer.grid,
        }),
      onPointerUp: (pointer) =>
        dispatch({ type: "pointer-up", tile: pointer.tile }),
      onKeyDown: (event) => {
        const action = keyAction(stateRef.current, {
          key: event.key,
          ctrl: event.ctrlKey || event.metaKey,
          shift: event.shiftKey,
        });
        if (!action) return false;
        dispatch(action);
        return true;
      },
      onCancel: () => dispatch({ type: "escape" }),
    }),
    [dispatch],
  );

  function save(plan: ReassignmentPlan | null) {
    setSaveError(null);
    startTransition(async () => {
      const draft = currentLayout(stateRef.current);
      if (plan === null) {
        const found = validateForSave(draft);
        setProblems(found);
        if (found.length > 0) return;
        const preview = await previewLayoutImpactAction(draft);
        if (preview.error || !preview.impact)
          return setSaveError(preview.error ?? fr.errors.generic);
        if (!isImpactEmpty(preview.impact)) return setImpact(preview.impact);
      }
      const result = await saveEditedLayoutAction(
        draft,
        plan ?? {},
        baseVersion,
      );
      if (result.error) return setSaveError(result.error);
      setImpact(null);
      dispatch({ type: "mark-saved" });
      onSaved();
    });
  }

  const live = feedbackText(state.feedback);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="layout-editor">
      <EditorToolbar
        state={state}
        dirty={dirty}
        busy={pending}
        dispatch={dispatch}
        onSave={() => save(null)}
      />
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="editor-feedback"
      >
        {live}
      </p>
      {(problems.length > 0 || saveError) && (
        <div
          role="alert"
          data-testid="save-problems"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900"
        >
          {saveError && <p>{saveError}</p>}
          {problems.length > 0 && (
            <ul className="list-inside list-disc">
              {problems.map((problem, index) => (
                <li key={`${problem.code}-${index}`}>
                  {fr.editor.saveProblems[problem.code]}
                  {problem.detail && problem.code === "invalid"
                    ? ` (${problem.detail})`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[50vh] flex-1">
          <MapViewLazy
            layout={layout}
            people={people}
            selectedZoneId={state.selectedZoneId}
            onSelectZone={() => {}}
            editor={bridge}
            overlay={overlay}
            onDragHover={(tile) =>
              dispatch({
                type: "hover",
                tile,
                grid: tile ? { x: tile.x + 0.5, y: tile.y + 0.5 } : null,
              })
            }
            onDropItem={(tile, catalogKey) =>
              dispatch({ type: "drop", tile, catalogKey })
            }
          />
          {overlay.problem && (
            <p
              data-testid="ghost-problem"
              className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-red-700/90 px-3 py-1.5 text-sm text-white"
            >
              {problemText(overlay.problem)}
            </p>
          )}
          <p className="pointer-events-none absolute top-3 left-3 max-w-md rounded-md bg-slate-900/80 px-3 py-1.5 text-xs text-white">
            {fr.editor.help}
          </p>
        </div>
        <aside className="flex max-h-[45vh] flex-col overflow-hidden border-t border-slate-200 lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l">
          <div
            role="tablist"
            aria-label={fr.editor.title}
            className="flex border-b border-slate-200"
          >
            {TABS.map((name) => (
              <button
                key={name}
                id={`tab-${name}`}
                role="tab"
                type="button"
                aria-selected={tab === name}
                aria-controls={`panel-${name}`}
                onClick={() => setTab(name)}
                className="flex-1 px-2 py-2 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-600 aria-selected:border-b-2 aria-selected:border-orange-600 aria-selected:font-medium"
              >
                {fr.editor.tabs[name]}
              </button>
            ))}
          </div>
          <div
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            {tab === "catalog" && (
              <CatalogPanel state={state} dispatch={dispatch} />
            )}
            {tab === "zones" && (
              <ZonesPanel state={state} dispatch={dispatch} />
            )}
            {tab === "versions" && (
              <VersionsPanel
                versions={versions}
                onOpen={(opened) => dispatch({ type: "load", layout: opened })}
                onRestored={onSaved}
              />
            )}
            {tab === "start" && (
              <StartPanel
                savedLayout={savedLayout}
                onLoad={(loaded) => dispatch({ type: "load", layout: loaded })}
              />
            )}
          </div>
        </aside>
      </div>
      {impact && (
        <ImpactDialog
          impact={impact}
          confirmLabel={fr.editor.impact.confirm}
          busy={pending}
          error={saveError}
          onConfirm={(plan) => save(plan)}
          onCancel={() => setImpact(null)}
        />
      )}
    </div>
  );
}
