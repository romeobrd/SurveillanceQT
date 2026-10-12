// Logique de l'éditeur de locaux en code pur : outil actif, sélection, gestes souris et clavier.
// Le composant React ne fait que traduire les événements en actions et dessiner ce que `deriveOverlay` décrit.
import { CATALOG, getFootprint } from "@/lib/map/catalog";
import {
  addElement,
  addZone,
  canRedo,
  canUndo,
  checkPlacement,
  createHistory,
  edgeAtPoint,
  elementAtTile,
  elementsInRect,
  moveElements,
  nextRotation,
  pushHistory,
  randomId,
  rectBetween,
  redo,
  removeElements,
  rotateElements,
  setEdge,
  undo,
  zoneAtTile,
  type EdgeTool,
  type History,
  type IdFactory,
  type PlacementProblem,
} from "@/lib/map/edit";
import type { Edge, Layout, Rect, Rotation, ZoneType } from "@/lib/map/schema";

export type Tool =
  "select" | "place" | "zone" | "solid" | "glass" | "door" | "erase";
export interface Tile {
  x: number;
  y: number;
}
export interface GridPoint {
  x: number;
  y: number;
}

export type Drag =
  | { kind: "move"; origin: Tile; current: Tile; ids: string[] }
  | { kind: "marquee"; origin: Tile; current: Tile; additive: boolean }
  | { kind: "zone"; origin: Tile; current: Tile };

/** Retour d'information accessible : un code (traduit par l'interface) et un détail éventuel. */
export interface Feedback {
  code:
    | "placed"
    | "moved"
    | "rotated"
    | "removed"
    | "refused"
    | "undo"
    | "redo"
    | "zone_added"
    | "zone_refused"
    | "edge_set"
    | "edge_refused"
    | "loaded"
    | "info";
  detail?: string;
  /** Incrémenté à chaque retour : permet de ré-annoncer un message identique. */
  seq: number;
}

export interface EditorState {
  history: History<Layout>;
  /** Carte de référence (dernier enregistrement) : sert à savoir s'il y a des modifications non enregistrées. */
  baseline: Layout;
  tool: Tool;
  armedKey: string | null;
  ghostRotation: Rotation;
  zoneType: ZoneType;
  selection: string[];
  selectedZoneId: string | null;
  hover: Tile | null;
  hoverGrid: GridPoint | null;
  drag: Drag | null;
  feedback: Feedback | null;
  ids: IdFactory;
}

export function createEditor(
  layout: Layout,
  ids: IdFactory = randomId,
): EditorState {
  return {
    history: createHistory(layout),
    baseline: layout,
    tool: "select",
    armedKey: null,
    ghostRotation: 0,
    zoneType: "bureau_individuel",
    selection: [],
    selectedZoneId: null,
    hover: null,
    hoverGrid: null,
    drag: null,
    feedback: null,
    ids,
  };
}

export const currentLayout = (state: EditorState): Layout =>
  state.history.present;
export const isDirty = (state: EditorState): boolean =>
  state.history.present !== state.baseline;
export { canRedo, canUndo };

export type EditorAction =
  | { type: "set-tool"; tool: Tool; armedKey?: string | null }
  | { type: "set-zone-type"; zoneType: ZoneType }
  | { type: "hover"; tile: Tile | null; grid: GridPoint | null }
  | {
      type: "pointer-down";
      tile: Tile | null;
      grid: GridPoint | null;
      shift: boolean;
    }
  | { type: "pointer-move"; tile: Tile | null; grid: GridPoint | null }
  | { type: "pointer-up"; tile: Tile | null }
  | { type: "rotate" }
  | { type: "delete" }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "confirm" }
  | { type: "escape" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "drop"; tile: Tile; catalogKey: string }
  | { type: "load"; layout: Layout }
  | {
      type: "apply";
      layout: Layout;
      feedback: Omit<Feedback, "seq">;
      selectedZoneId?: string | null;
    }
  | { type: "select-zone"; zoneId: string | null }
  | { type: "select-elements"; ids: string[] }
  | { type: "mark-saved"; layout?: Layout };

const EDGE_TOOLS: ReadonlySet<Tool> = new Set([
  "solid",
  "glass",
  "door",
  "erase",
]);

function sameTile(a: Tile | null, b: Tile | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
}

/**
 * Met à jour le survol seulement si cela change ce qui est dessiné : la tuile pour poser, l'arête visée pour
 * les murs et portes. Avec l'outil de sélection (sans geste), le survol n'a aucun effet visible : état inchangé,
 * donc aucun rendu.
 */
function withHover(
  state: EditorState,
  tile: Tile | null,
  grid: GridPoint | null,
): EditorState {
  if (state.tool === "select" || state.tool === "zone") {
    return state.hover === null && state.hoverGrid === null
      ? state
      : { ...state, hover: null, hoverGrid: null };
  }
  if (EDGE_TOOLS.has(state.tool)) {
    const before = state.hoverGrid
      ? edgeAtPoint(state.hoverGrid.x, state.hoverGrid.y)
      : null;
    const after = grid ? edgeAtPoint(grid.x, grid.y) : null;
    const same =
      before === after ||
      (before !== null &&
        after !== null &&
        before.x === after.x &&
        before.y === after.y &&
        before.side === after.side);
    return same ? state : { ...state, hover: tile, hoverGrid: grid };
  }
  return sameTile(state.hover, tile)
    ? state
    : { ...state, hover: tile, hoverGrid: grid };
}

function say(state: EditorState, feedback: Omit<Feedback, "seq">): EditorState {
  return {
    ...state,
    feedback: { ...feedback, seq: (state.feedback?.seq ?? 0) + 1 },
  };
}

function commit(state: EditorState, layout: Layout): EditorState {
  return { ...state, history: pushHistory(state.history, layout) };
}

/** Éléments encore présents dans la carte (nettoie la sélection après annuler / supprimer). */
function pruneSelection(state: EditorState): EditorState {
  const layout = currentLayout(state);
  const existing = new Set(layout.elements.map((element) => element.id));
  const selection = state.selection.filter((id) => existing.has(id));
  const zoneStillExists = state.selectedZoneId
    ? layout.zones.some((zone) => zone.id === state.selectedZoneId)
    : true;
  return {
    ...state,
    selection,
    selectedZoneId: zoneStillExists ? state.selectedZoneId : null,
  };
}

/** Position du coin haut-gauche d'un élément pour que le pointeur soit à peu près au centre de son emprise. */
export function anchorFor(
  catalogKey: string,
  tile: Tile,
  rotation: Rotation,
): { x: number; y: number } {
  const entry = CATALOG[catalogKey];
  if (!entry) return tile;
  const { w, h } = getFootprint(entry, rotation);
  return {
    x: tile.x - Math.floor((w - 1) / 2),
    y: tile.y - Math.floor((h - 1) / 2),
  };
}

function placeAt(
  state: EditorState,
  catalogKey: string,
  tile: Tile,
): EditorState {
  const entry = CATALOG[catalogKey];
  if (!entry) return state;
  const rotation = entry.rotatable ? state.ghostRotation : 0;
  const { x, y } = anchorFor(catalogKey, tile, rotation);
  const result = addElement(
    currentLayout(state),
    { catalogKey, x, y, rotation },
    state.ids,
  );
  if (!result.ok)
    return say(state, { code: "refused", detail: result.problem });
  return say(
    { ...commit(state, result.layout), selection: [result.id] },
    { code: "placed", detail: entry.name },
  );
}

function applyEdge(state: EditorState, grid: GridPoint | null): EditorState {
  if (!grid) return state;
  const edge = edgeAtPoint(grid.x, grid.y);
  if (!edge) return state;
  const tool: EdgeTool =
    state.tool === "erase" ? "none" : (state.tool as EdgeTool);
  const result = setEdge(currentLayout(state), edge, tool);
  if (!result.ok)
    return say(state, { code: "edge_refused", detail: result.problem });
  return say(commit(state, result.layout), { code: "edge_set", detail: tool });
}

export function reduce(state: EditorState, action: EditorAction): EditorState {
  const layout = currentLayout(state);
  switch (action.type) {
    case "set-tool": {
      const armedKey =
        action.tool === "place" ? (action.armedKey ?? state.armedKey) : null;
      const rotatable = armedKey
        ? (CATALOG[armedKey]?.rotatable ?? false)
        : false;
      return {
        ...state,
        tool: action.tool,
        armedKey,
        ghostRotation: rotatable ? state.ghostRotation : 0,
        drag: null,
      };
    }
    case "set-zone-type":
      return { ...state, zoneType: action.zoneType };
    case "hover":
      return withHover(state, action.tile, action.grid);
    case "select-zone":
      return {
        ...state,
        selectedZoneId: action.zoneId,
        selection: action.zoneId ? [] : state.selection,
      };
    case "select-elements":
      return { ...state, selection: action.ids, selectedZoneId: null };

    case "pointer-down": {
      const base = { ...state, hover: action.tile, hoverGrid: action.grid };
      if (state.tool === "place")
        return state.armedKey && action.tile
          ? placeAt(base, state.armedKey, action.tile)
          : base;
      if (state.tool === "zone") {
        return action.tile
          ? {
              ...base,
              drag: { kind: "zone", origin: action.tile, current: action.tile },
            }
          : base;
      }
      if (EDGE_TOOLS.has(state.tool)) return applyEdge(base, action.grid);

      // Outil de sélection
      const element = action.tile
        ? elementAtTile(layout, action.tile.x, action.tile.y)
        : null;
      if (element && action.tile) {
        if (action.shift) {
          const selection = state.selection.includes(element.id)
            ? state.selection.filter((id) => id !== element.id)
            : [...state.selection, element.id];
          return { ...base, selection, selectedZoneId: null };
        }
        const ids = state.selection.includes(element.id)
          ? state.selection
          : [element.id];
        return {
          ...base,
          selection: ids,
          selectedZoneId: null,
          drag: {
            kind: "move",
            origin: action.tile,
            current: action.tile,
            ids,
          },
        };
      }
      if (action.shift && action.tile) {
        return {
          ...base,
          drag: {
            kind: "marquee",
            origin: action.tile,
            current: action.tile,
            additive: true,
          },
        };
      }
      return {
        ...base,
        selection: [],
        selectedZoneId: action.tile
          ? zoneAtTile(layout, action.tile.x, action.tile.y)
          : null,
      };
    }

    case "pointer-move": {
      const next = { ...state, hover: action.tile, hoverGrid: action.grid };
      if (state.drag && action.tile)
        return { ...next, drag: { ...state.drag, current: action.tile } };
      return next;
    }

    case "pointer-up": {
      const drag = state.drag;
      if (!drag) return state;
      const end = action.tile ?? drag.current;
      const cleared = { ...state, drag: null };
      if (drag.kind === "move") {
        const dx = end.x - drag.origin.x;
        const dy = end.y - drag.origin.y;
        if (dx === 0 && dy === 0) return cleared;
        const result = moveElements(layout, drag.ids, dx, dy);
        return result.ok
          ? say(commit(cleared, result.layout), { code: "moved" })
          : say(cleared, { code: "refused", detail: result.problem });
      }
      if (drag.kind === "marquee") {
        const found = elementsInRect(
          layout,
          drag.origin.x,
          drag.origin.y,
          end.x,
          end.y,
        ).map((element) => element.id);
        const selection = drag.additive
          ? [...new Set([...state.selection, ...found])]
          : found;
        return { ...cleared, selection, selectedZoneId: null };
      }
      const rect = rectBetween(drag.origin, end);
      const result = addZone(layout, rect, state.zoneType, state.ids);
      return result.ok
        ? say(
            {
              ...commit(cleared, result.layout),
              selectedZoneId: result.id,
              selection: [],
              tool: "select",
            },
            { code: "zone_added" },
          )
        : say(cleared, { code: "zone_refused", detail: result.problem });
    }

    case "rotate": {
      if (state.tool === "place" && state.armedKey) {
        return CATALOG[state.armedKey]?.rotatable
          ? { ...state, ghostRotation: nextRotation(state.ghostRotation) }
          : state;
      }
      if (state.selection.length === 0) return state;
      const result = rotateElements(layout, state.selection);
      return result.ok
        ? say(commit(state, result.layout), { code: "rotated" })
        : say(state, { code: "refused", detail: result.problem });
    }

    case "delete": {
      if (state.selection.length === 0) return state;
      const removed = removeElements(layout, state.selection);
      return pruneSelection(
        say(commit(state, removed), {
          code: "removed",
          detail: String(state.selection.length),
        }),
      );
    }

    case "nudge": {
      if (state.tool === "place") {
        const from = state.hover ?? {
          x: Math.floor(layout.width / 2),
          y: Math.floor(layout.height / 2),
        };
        const tile = {
          x: Math.min(layout.width - 1, Math.max(0, from.x + action.dx)),
          y: Math.min(layout.height - 1, Math.max(0, from.y + action.dy)),
        };
        return {
          ...state,
          hover: tile,
          hoverGrid: { x: tile.x + 0.5, y: tile.y + 0.5 },
        };
      }
      if (state.selection.length === 0) return state;
      const result = moveElements(
        layout,
        state.selection,
        action.dx,
        action.dy,
      );
      return result.ok
        ? say(commit(state, result.layout), { code: "moved" })
        : say(state, { code: "refused", detail: result.problem });
    }

    case "confirm": {
      if (state.tool === "place" && state.armedKey) {
        const tile = state.hover ?? {
          x: Math.floor(layout.width / 2),
          y: Math.floor(layout.height / 2),
        };
        return placeAt({ ...state, hover: tile }, state.armedKey, tile);
      }
      return state;
    }

    case "escape": {
      if (state.drag) return { ...state, drag: null };
      if (state.tool !== "select")
        return { ...state, tool: "select", armedKey: null, ghostRotation: 0 };
      return { ...state, selection: [], selectedZoneId: null };
    }

    case "undo":
      return canUndo(state.history)
        ? say(
            pruneSelection({
              ...state,
              history: undo(state.history),
              drag: null,
            }),
            { code: "undo" },
          )
        : state;
    case "redo":
      return canRedo(state.history)
        ? say(
            pruneSelection({
              ...state,
              history: redo(state.history),
              drag: null,
            }),
            { code: "redo" },
          )
        : state;

    case "drop":
      return placeAt(
        { ...state, hover: action.tile },
        action.catalogKey,
        action.tile,
      );

    case "load":
      return say(
        pruneSelection({
          ...commit(state, action.layout),
          selection: [],
          selectedZoneId: null,
          drag: null,
        }),
        { code: "loaded" },
      );

    case "apply":
      return pruneSelection(
        say(
          {
            ...commit(state, action.layout),
            selectedZoneId: action.selectedZoneId ?? state.selectedZoneId,
          },
          action.feedback,
        ),
      );

    case "mark-saved": {
      const saved = action.layout ?? layout;
      return {
        ...state,
        history: createHistory(saved),
        baseline: saved,
        drag: null,
      };
    }
  }
}

export interface KeyInput {
  key: string;
  ctrl: boolean;
  shift: boolean;
}

/** Action déclenchée par une touche, ou null si l'éditeur ne s'en occupe pas (la caméra peut alors réagir). */
export function keyAction(
  state: EditorState,
  input: KeyInput,
): EditorAction | null {
  const key = input.key.toLowerCase();
  if (input.ctrl && key === "z")
    return input.shift ? { type: "redo" } : { type: "undo" };
  if (input.ctrl && key === "y") return { type: "redo" };
  if (input.ctrl) return null;
  const hasSelection = state.selection.length > 0;
  switch (input.key) {
    case "Escape":
      return { type: "escape" };
    case "Enter":
      return state.tool === "place" && state.armedKey
        ? { type: "confirm" }
        : null;
    case "Delete":
    case "Backspace":
      return hasSelection ? { type: "delete" } : null;
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown": {
      const movable =
        state.tool === "place" || (state.tool === "select" && hasSelection);
      if (!movable) return null;
      const step = input.shift ? 5 : 1;
      const dx =
        input.key === "ArrowLeft"
          ? -step
          : input.key === "ArrowRight"
            ? step
            : 0;
      const dy =
        input.key === "ArrowUp" ? -step : input.key === "ArrowDown" ? step : 0;
      return { type: "nudge", dx, dy };
    }
    default:
      if (key === "r")
        return state.tool === "place" || hasSelection
          ? { type: "rotate" }
          : null;
      return null;
  }
}

/** Ce que le moteur de rendu doit dessiner par-dessus la carte. */
export interface EditOverlay {
  ghosts: Array<{
    catalogKey: string;
    x: number;
    y: number;
    rotation: Rotation;
    valid: boolean;
  }>;
  /** Emprises (en tuiles) des éléments sélectionnés. */
  selection: Rect[];
  edge: { edge: Pick<Edge, "x" | "y" | "side">; valid: boolean } | null;
  rect: { rect: Rect; valid: boolean } | null;
  marquee: Rect | null;
  /** Raison du refus du fantôme courant (pour l'afficher à l'utilisateur). */
  problem: PlacementProblem | string | null;
}

export const EMPTY_OVERLAY: EditOverlay = {
  ghosts: [],
  selection: [],
  edge: null,
  rect: null,
  marquee: null,
  problem: null,
};

export function deriveOverlay(state: EditorState): EditOverlay {
  const layout = currentLayout(state);
  const overlay: EditOverlay = { ...EMPTY_OVERLAY, ghosts: [], selection: [] };

  for (const id of state.selection) {
    const element = layout.elements.find((candidate) => candidate.id === id);
    const entry = element && CATALOG[element.catalogKey];
    if (!element || !entry) continue;
    const { w, h } = getFootprint(entry, element.rotation);
    overlay.selection.push({ x: element.x, y: element.y, w, h });
  }

  if (state.drag?.kind === "move") {
    const dx = state.drag.current.x - state.drag.origin.x;
    const dy = state.drag.current.y - state.drag.origin.y;
    if (dx !== 0 || dy !== 0) {
      const result = moveElements(layout, state.drag.ids, dx, dy);
      overlay.problem = result.ok ? null : result.problem;
      overlay.ghosts = state.drag.ids.flatMap((id) => {
        const element = layout.elements.find(
          (candidate) => candidate.id === id,
        );
        return element
          ? [
              {
                catalogKey: element.catalogKey,
                x: element.x + dx,
                y: element.y + dy,
                rotation: element.rotation,
                valid: result.ok,
              },
            ]
          : [];
      });
    }
  } else if (state.drag?.kind === "zone") {
    const rect = rectBetween(state.drag.origin, state.drag.current);
    const result = addZone(layout, rect, state.zoneType, state.ids);
    overlay.rect = { rect, valid: result.ok };
    overlay.problem = result.ok ? null : result.problem;
  } else if (state.drag?.kind === "marquee") {
    overlay.marquee = rectBetween(state.drag.origin, state.drag.current);
  } else if (state.tool === "place" && state.armedKey && state.hover) {
    const entry = CATALOG[state.armedKey];
    const rotation = entry?.rotatable ? state.ghostRotation : 0;
    const { x, y } = anchorFor(state.armedKey, state.hover, rotation);
    const problem = checkPlacement(layout, {
      catalogKey: state.armedKey,
      x,
      y,
      rotation,
    });
    overlay.ghosts = [
      { catalogKey: state.armedKey, x, y, rotation, valid: problem === null },
    ];
    overlay.problem = problem;
  } else if (EDGE_TOOLS.has(state.tool) && state.hoverGrid) {
    const edge = edgeAtPoint(state.hoverGrid.x, state.hoverGrid.y);
    if (edge) {
      const tool: EdgeTool =
        state.tool === "erase" ? "none" : (state.tool as EdgeTool);
      const result = setEdge(layout, edge, tool);
      overlay.edge = { edge, valid: result.ok };
      overlay.problem = result.ok ? null : result.problem;
    }
  }
  return overlay;
}
