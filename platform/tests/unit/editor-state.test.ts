import { describe, expect, it } from "vitest";
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
import { createEmptyLayout, resizeZone, sequentialIds } from "@/lib/map/edit";
import type { Layout } from "@/lib/map/schema";

const fresh = (layout: Layout = createEmptyLayout(14, 12, sequentialIds())) =>
  createEditor(layout, sequentialIds());
const run = (state: EditorState, ...actions: EditorAction[]) =>
  actions.reduce(reduce, state);
const tile = (x: number, y: number) => ({ x, y });
const center = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.5 });
const click = (x: number, y: number, shift = false): EditorAction => ({
  type: "pointer-down",
  tile: tile(x, y),
  grid: center(x, y),
  shift,
});

function withDesk(): EditorState {
  return run(
    fresh(),
    { type: "set-tool", tool: "place", armedKey: "bureau_simple" },
    click(4, 4),
    { type: "set-tool", tool: "select" },
  );
}

describe("placement", () => {
  it("affiche un fantôme vert sur un emplacement libre, rouge sinon avec la raison", () => {
    let state = run(
      fresh(),
      { type: "set-tool", tool: "place", armedKey: "bureau_simple" },
      { type: "hover", tile: tile(5, 5), grid: center(5, 5) },
    );
    expect(deriveOverlay(state).ghosts).toEqual([
      { catalogKey: "bureau_simple", x: 5, y: 5, rotation: 0, valid: true },
    ]);
    state = run(state, {
      type: "hover",
      tile: tile(-1, 5),
      grid: center(-1, 5),
    });
    expect(deriveOverlay(state).ghosts[0].valid).toBe(false);
    expect(deriveOverlay(state).problem).toBe("out_of_bounds");
  });

  it("pose l'élément au clic, le sélectionne, et reste armé pour en poser d'autres", () => {
    const state = run(
      fresh(),
      { type: "set-tool", tool: "place", armedKey: "plante" },
      click(3, 3),
      click(6, 3),
    );
    const layout = currentLayout(state);
    expect(
      layout.elements.map((element) => [
        element.catalogKey,
        element.x,
        element.y,
      ]),
    ).toEqual([
      ["plante", 3, 3],
      ["plante", 6, 3],
    ]);
    expect(state.tool).toBe("place");
    expect(state.feedback?.code).toBe("placed");
    expect(state.selection).toHaveLength(1);
  });

  it("refuse en gardant la carte intacte et dit pourquoi", () => {
    const state = run(
      withDesk(),
      { type: "set-tool", tool: "place", armedKey: "bureau_simple" },
      click(4, 4),
    );
    expect(currentLayout(state).elements).toHaveLength(1);
    expect(state.feedback).toMatchObject({
      code: "refused",
      detail: "collision",
    });
  });

  it("centre l'emprise sur le pointeur et tourne le fantôme avec R", () => {
    let state = run(
      fresh(),
      { type: "set-tool", tool: "place", armedKey: "table_reunion" },
      { type: "hover", tile: tile(6, 6), grid: center(6, 6) },
    );
    expect(deriveOverlay(state).ghosts[0]).toMatchObject({
      x: 5,
      y: 6,
      rotation: 0,
    }); // 3×2 centré
    state = run(state, { type: "rotate" });
    expect(deriveOverlay(state).ghosts[0]).toMatchObject({ rotation: 90 });
    // Un élément non pivotable ne tourne pas
    const plant = run(
      fresh(),
      { type: "set-tool", tool: "place", armedKey: "plante" },
      { type: "rotate" },
    );
    expect(plant.ghostRotation).toBe(0);
  });

  it("place au clavier : curseur déplacé aux flèches, Entrée pour poser", () => {
    let state = run(fresh(), {
      type: "set-tool",
      tool: "place",
      armedKey: "plante",
    });
    state = run(state, { type: "nudge", dx: -3, dy: -2 }); // part du centre (7,6)
    expect(state.hover).toEqual(tile(4, 4));
    state = run(state, { type: "confirm" });
    expect(currentLayout(state).elements[0]).toMatchObject({
      catalogKey: "plante",
      x: 4,
      y: 4,
    });
    // Le curseur reste dans la carte
    expect(run(state, { type: "nudge", dx: -99, dy: -99 }).hover).toEqual(
      tile(0, 0),
    );
  });

  it("place par glisser-déposer depuis le catalogue", () => {
    const state = run(fresh(), {
      type: "drop",
      tile: tile(5, 5),
      catalogKey: "etagere",
    });
    expect(currentLayout(state).elements[0]).toMatchObject({
      catalogKey: "etagere",
      x: 5,
      y: 5,
    });
  });
});

describe("sélection et déplacement", () => {
  it("sélectionne au clic, déplace en glissant et enregistre un seul pas d'historique", () => {
    let state = withDesk();
    state = run(state, click(4, 4), {
      type: "pointer-move",
      tile: tile(7, 5),
      grid: center(7, 5),
    });
    expect(state.drag?.kind).toBe("move");
    const overlay = deriveOverlay(state);
    expect(overlay.ghosts[0]).toMatchObject({ x: 7, y: 5, valid: true });
    state = run(state, { type: "pointer-up", tile: tile(7, 5) });
    expect(currentLayout(state).elements[0]).toMatchObject({ x: 7, y: 5 });
    expect(state.drag).toBeNull();
    state = run(state, { type: "undo" });
    expect(currentLayout(state).elements[0]).toMatchObject({ x: 4, y: 4 });
  });

  it("montre en rouge et refuse un déplacement sur un autre élément", () => {
    let state = run(
      withDesk(),
      { type: "set-tool", tool: "place", armedKey: "plante" },
      click(9, 4),
      { type: "set-tool", tool: "select" },
    );
    state = run(state, click(4, 4), {
      type: "pointer-move",
      tile: tile(9, 4),
      grid: center(9, 4),
    });
    expect(deriveOverlay(state).ghosts[0].valid).toBe(false);
    expect(deriveOverlay(state).problem).toBe("collision");
    state = run(state, { type: "pointer-up", tile: tile(9, 4) });
    expect(
      currentLayout(state).elements.find(
        (e) => e.catalogKey === "bureau_simple",
      ),
    ).toMatchObject({ x: 4, y: 4 });
    expect(state.feedback).toMatchObject({
      code: "refused",
      detail: "collision",
    });
  });

  it("un simple clic sans déplacement ne modifie rien", () => {
    const before = withDesk();
    const state = run(before, click(4, 4), {
      type: "pointer-up",
      tile: tile(4, 4),
    });
    expect(currentLayout(state)).toBe(currentLayout(before));
    expect(state.selection).toHaveLength(1);
  });

  it("sélection multiple : Maj+clic, rectangle, puis déplacement et suppression du groupe", () => {
    let state = run(
      fresh(),
      { type: "set-tool", tool: "place", armedKey: "plante" },
      click(2, 2),
      click(4, 2),
      click(10, 8),
      { type: "set-tool", tool: "select" },
    );
    state = run(state, click(2, 2), click(4, 2, true));
    expect(state.selection).toHaveLength(2);
    state = run(state, click(4, 2, true)); // Maj+clic sur un élément sélectionné : le retire
    expect(state.selection).toHaveLength(1);

    // Rectangle (Maj + glisser sur le vide)
    state = run(state, click(0, 0, true), {
      type: "pointer-move",
      tile: tile(5, 3),
      grid: center(5, 3),
    });
    expect(deriveOverlay(state).marquee).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    state = run(state, { type: "pointer-up", tile: tile(5, 3) });
    expect(state.selection).toHaveLength(2);

    state = run(
      state,
      click(2, 2),
      { type: "pointer-move", tile: tile(2, 5), grid: center(2, 5) },
      { type: "pointer-up", tile: tile(2, 5) },
    );
    expect(currentLayout(state).elements.filter((e) => e.y === 5)).toHaveLength(
      2,
    ); // les deux ont bougé ensemble
    state = run(state, { type: "delete" });
    expect(currentLayout(state).elements).toHaveLength(1);
    expect(state.selection).toEqual([]);
    expect(state.feedback).toMatchObject({ code: "removed", detail: "2" });
  });

  it("clique dans le vide : désélectionne et sélectionne la pièce", () => {
    const state = run(withDesk(), click(4, 4), click(10, 9));
    expect(state.selection).toEqual([]);
    expect(state.selectedZoneId).toBe(currentLayout(state).zones[0].id);
  });

  it("tourne la sélection avec R, refuse si collision", () => {
    let state = run(withDesk(), click(4, 4), { type: "rotate" });
    expect(currentLayout(state).elements[0].rotation).toBe(90);
    state = run(
      state,
      { type: "set-tool", tool: "place", armedKey: "plante" },
      click(4, 6),
      { type: "set-tool", tool: "select" },
      click(4, 4),
      { type: "rotate" },
    );
    expect(
      currentLayout(state).elements.find(
        (e) => e.catalogKey === "bureau_simple",
      )?.rotation,
    ).toBe(180);
    state = run(state, { type: "rotate" }); // 270 : emprise 1×2 vers... (4,4)-(4,5), libre
    expect(
      state.feedback?.code === "rotated" || state.feedback?.code === "refused",
    ).toBe(true);
  });
});

describe("clavier", () => {
  const input = (key: string, ctrl = false, shift = false) => ({
    key,
    ctrl,
    shift,
  });

  it("associe les touches aux actions seulement quand elles ont un sens", () => {
    const idle = fresh();
    expect(keyAction(idle, input("r"))).toBeNull();
    expect(keyAction(idle, input("Delete"))).toBeNull();
    expect(keyAction(idle, input("ArrowLeft"))).toBeNull(); // la caméra peut réagir
    expect(keyAction(idle, input("z", true))).toEqual({ type: "undo" });
    expect(keyAction(idle, input("y", true))).toEqual({ type: "redo" });
    expect(keyAction(idle, input("z", true, true))).toEqual({ type: "redo" });
    expect(keyAction(idle, input("Escape"))).toEqual({ type: "escape" });

    const selected = run(withDesk(), click(4, 4));
    expect(keyAction(selected, input("r"))).toEqual({ type: "rotate" });
    expect(keyAction(selected, input("Delete"))).toEqual({ type: "delete" });
    expect(keyAction(selected, input("ArrowRight"))).toEqual({
      type: "nudge",
      dx: 1,
      dy: 0,
    });
    expect(keyAction(selected, input("ArrowDown", false, true))).toEqual({
      type: "nudge",
      dx: 0,
      dy: 5,
    });
    expect(keyAction(selected, input("a", true))).toBeNull();

    const placing = run(idle, {
      type: "set-tool",
      tool: "place",
      armedKey: "plante",
    });
    expect(keyAction(placing, input("Enter"))).toEqual({ type: "confirm" });
    expect(keyAction(placing, input("r"))).toEqual({ type: "rotate" });
  });

  it("déplace la sélection d'une tuile aux flèches et refuse hors carte", () => {
    let state = run(withDesk(), click(4, 4), { type: "nudge", dx: 1, dy: 0 });
    expect(currentLayout(state).elements[0].x).toBe(5);
    state = run(state, { type: "nudge", dx: -99, dy: 0 });
    expect(currentLayout(state).elements[0].x).toBe(5);
    expect(state.feedback).toMatchObject({
      code: "refused",
      detail: "out_of_bounds",
    });
  });

  it("Échap annule le geste, puis l'outil, puis la sélection", () => {
    let state = run(withDesk(), click(4, 4), {
      type: "pointer-move",
      tile: tile(6, 4),
      grid: center(6, 4),
    });
    state = run(state, { type: "escape" });
    expect(state.drag).toBeNull();
    expect(state.selection).toHaveLength(1);
    state = run(
      state,
      { type: "set-tool", tool: "place", armedKey: "plante" },
      { type: "escape" },
    );
    expect(state.tool).toBe("select");
    state = run(state, { type: "escape" });
    expect(state.selection).toEqual([]);
  });
});

describe("annuler / rétablir et modifications non enregistrées", () => {
  it("suit l'état « modifié » et le retire quand on revient au départ", () => {
    let state = fresh();
    expect(isDirty(state)).toBe(false);
    state = run(state, {
      type: "drop",
      tile: tile(5, 5),
      catalogKey: "plante",
    });
    expect(isDirty(state)).toBe(true);
    state = run(state, { type: "undo" });
    expect(isDirty(state)).toBe(false);
    state = run(state, { type: "redo" });
    expect(isDirty(state)).toBe(true);
    state = run(state, { type: "mark-saved" });
    expect(isDirty(state)).toBe(false);
    expect(run(state, { type: "undo" }).history.present).toBe(
      state.history.present,
    ); // l'historique repart de zéro
  });

  it("charger une autre carte est annulable", () => {
    const other = createEmptyLayout(20, 20, sequentialIds());
    let state = run(fresh(), { type: "load", layout: other });
    expect(currentLayout(state).width).toBe(20);
    expect(isDirty(state)).toBe(true);
    state = run(state, { type: "undo" });
    expect(currentLayout(state).width).toBe(14);
  });

  it("nettoie la sélection quand l'élément disparaît par annulation", () => {
    let state = run(fresh(), {
      type: "drop",
      tile: tile(5, 5),
      catalogKey: "plante",
    });
    expect(state.selection).toHaveLength(1);
    state = run(state, { type: "undo" });
    expect(state.selection).toEqual([]);
  });
});

describe("pièces, murs et portes", () => {
  function roomy(): EditorState {
    const layout = createEmptyLayout(14, 12, sequentialIds());
    const shrunk = resizeZone(layout, layout.zones[0].id, {
      x: 0,
      y: 0,
      w: 7,
      h: 12,
    });
    if (!shrunk.ok) throw new Error(shrunk.problem);
    return fresh(shrunk.layout);
  }

  it("trace une pièce dans l'espace libre : aperçu vert, puis création et retour à la sélection", () => {
    let state = run(
      roomy(),
      { type: "set-zone-type", zoneType: "salle_reunion" },
      { type: "set-tool", tool: "zone" },
      click(8, 1),
    );
    state = run(state, {
      type: "pointer-move",
      tile: tile(12, 5),
      grid: center(12, 5),
    });
    expect(deriveOverlay(state).rect).toEqual({
      rect: { x: 8, y: 1, w: 5, h: 5 },
      valid: true,
    });
    state = run(state, { type: "pointer-up", tile: tile(12, 5) });
    expect(currentLayout(state).zones).toHaveLength(2);
    expect(currentLayout(state).zones[1]).toMatchObject({
      type: "salle_reunion",
      rects: [{ x: 8, y: 1, w: 5, h: 5 }],
    });
    expect(state.tool).toBe("select");
    expect(state.selectedZoneId).toBe(currentLayout(state).zones[1].id);
    expect(state.feedback?.code).toBe("zone_added");
  });

  it("montre en rouge et refuse une pièce qui chevauche une autre", () => {
    let state = run(roomy(), { type: "set-tool", tool: "zone" }, click(5, 1), {
      type: "pointer-move",
      tile: tile(9, 4),
      grid: center(9, 4),
    });
    expect(deriveOverlay(state).rect?.valid).toBe(false);
    expect(deriveOverlay(state).problem).toBe("zone_overlap");
    state = run(state, { type: "pointer-up", tile: tile(9, 4) });
    expect(currentLayout(state).zones).toHaveLength(1);
    expect(state.feedback).toMatchObject({
      code: "zone_refused",
      detail: "zone_overlap",
    });
  });

  it("pose un mur, une cloison vitrée, une porte, puis efface, au clic sur une arête", () => {
    const edgeClick = (gx: number, gy: number): EditorAction => ({
      type: "pointer-down",
      tile: tile(Math.floor(gx), Math.floor(gy)),
      grid: { x: gx, y: gy },
      shift: false,
    });
    let state = run(
      fresh(),
      { type: "set-tool", tool: "glass" },
      edgeClick(5.5, 5.02),
    );
    expect(
      currentLayout(state).walls.find(
        (w) => w.x === 5 && w.y === 5 && w.side === "N",
      )?.kind,
    ).toBe("glass");
    state = run(
      state,
      { type: "set-tool", tool: "door" },
      edgeClick(5.5, 5.02),
    );
    expect(
      currentLayout(state).doors.some(
        (d) => d.x === 5 && d.y === 5 && d.side === "N",
      ),
    ).toBe(true);
    state = run(
      state,
      { type: "set-tool", tool: "erase" },
      edgeClick(5.5, 5.02),
    );
    expect(currentLayout(state).doors.some((d) => d.x === 5 && d.y === 5)).toBe(
      false,
    );
    expect(
      currentLayout(state).walls.some(
        (w) => w.x === 5 && w.y === 5 && w.side === "N",
      ),
    ).toBe(false);
    state = run(
      state,
      { type: "set-tool", tool: "solid" },
      edgeClick(5.5, 5.5),
    ); // centre de tuile : aucune arête
    expect(state.feedback?.code).toBe("edge_set"); // dernier message conservé : rien n'a été fait
  });

  it("montre l'arête visée en vert ou en rouge", () => {
    const withPlant = run(
      fresh(),
      { type: "set-tool", tool: "place", armedKey: "plante" },
      click(3, 3),
      { type: "set-tool", tool: "door" },
    );
    const blocked = run(withPlant, {
      type: "hover",
      tile: tile(3, 3),
      grid: { x: 3.5, y: 3.03 },
    });
    expect(deriveOverlay(blocked).edge).toEqual({
      edge: { x: 3, y: 3, side: "N" },
      valid: false,
    });
    const free = run(withPlant, {
      type: "hover",
      tile: tile(8, 3),
      grid: { x: 8.5, y: 3.03 },
    });
    expect(deriveOverlay(free).edge?.valid).toBe(true);
  });
});

describe("zone sélectionnée et sélection d'éléments depuis les panneaux", () => {
  it("sélectionne une pièce ou des éléments sans mélanger les deux", () => {
    let state = run(withDesk(), click(4, 4));
    state = run(state, {
      type: "select-zone",
      zoneId: currentLayout(state).zones[0].id,
    });
    expect(state.selection).toEqual([]);
    state = run(state, {
      type: "select-elements",
      ids: [currentLayout(state).elements[0].id],
    });
    expect(state.selectedZoneId).toBeNull();
    expect(deriveOverlay(state).selection).toEqual([
      { x: 4, y: 4, w: 2, h: 1 },
    ]);
  });
});
