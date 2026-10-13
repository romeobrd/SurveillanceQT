// Opérations d'édition sur les éléments : fonctions pures, la carte d'origine n'est jamais modifiée.
import { CATALOG, getFootprint } from "../catalog";
import type { Layout, MapElement, Rotation } from "../schema";
import { randomId, type IdFactory } from "./ids";
import {
  checkPlacement,
  evaluateChange,
  zoneIdForFootprint,
  type PlacementProblem,
  type PlacementSpec,
} from "./placement";

export type OpProblem =
  PlacementProblem | "not_found" | "not_rotatable" | "nothing_selected";
export type OpResult =
  { ok: true; layout: Layout } | { ok: false; problem: OpProblem };

const NEXT_ROTATION: Record<Rotation, Rotation> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

export function nextRotation(rotation: Rotation): Rotation {
  return NEXT_ROTATION[rotation];
}

export function addElement(
  layout: Layout,
  spec: PlacementSpec,
  ids: IdFactory = randomId,
):
  { ok: true; layout: Layout; id: string } | { ok: false; problem: OpProblem } {
  const problem = checkPlacement(layout, spec);
  if (problem) return { ok: false, problem };
  const entry = CATALOG[spec.catalogKey];
  const { w, h } = getFootprint(entry, spec.rotation);
  let id = ids("e");
  const existing = new Set(layout.elements.map((element) => element.id));
  while (existing.has(id)) id = ids("e");
  const element: MapElement = {
    id,
    catalogKey: spec.catalogKey,
    x: spec.x,
    y: spec.y,
    rotation: spec.rotation,
    zoneId: zoneIdForFootprint(layout, spec.x, spec.y, w, h) as string,
  };
  return {
    ok: true,
    layout: { ...layout, elements: [...layout.elements, element] },
    id,
  };
}

/** Remplace des éléments par leur nouvelle version, ou refuse la modification entière (tout ou rien). */
function applyChanges(
  layout: Layout,
  changed: Map<string, MapElement>,
): OpResult {
  const elements = layout.elements.map((element) => {
    const next = changed.get(element.id);
    if (!next) return element;
    const entry = CATALOG[next.catalogKey];
    const { w, h } = getFootprint(entry, next.rotation);
    return {
      ...next,
      zoneId: zoneIdForFootprint(layout, next.x, next.y, w, h) ?? next.zoneId,
    };
  });
  const candidate: Layout = { ...layout, elements };
  const problems = evaluateChange(layout, candidate, [...changed.keys()]);
  const first = problems.values().next();
  if (!first.done) return { ok: false, problem: first.value };
  return { ok: true, layout: candidate };
}

function selected(layout: Layout, ids: readonly string[]): MapElement[] {
  const wanted = new Set(ids);
  return layout.elements.filter((element) => wanted.has(element.id));
}

export function moveElements(
  layout: Layout,
  ids: readonly string[],
  dx: number,
  dy: number,
): OpResult {
  const targets = selected(layout, ids);
  if (targets.length === 0) return { ok: false, problem: "nothing_selected" };
  return applyChanges(
    layout,
    new Map(
      targets.map((element) => [
        element.id,
        { ...element, x: element.x + dx, y: element.y + dy },
      ]),
    ),
  );
}

/** Tourne chaque élément de 90° autour de son coin haut-gauche. */
export function rotateElements(
  layout: Layout,
  ids: readonly string[],
): OpResult {
  const targets = selected(layout, ids);
  if (targets.length === 0) return { ok: false, problem: "nothing_selected" };
  if (targets.some((element) => !CATALOG[element.catalogKey]?.rotatable))
    return { ok: false, problem: "not_rotatable" };
  return applyChanges(
    layout,
    new Map(
      targets.map((element) => [
        element.id,
        { ...element, rotation: nextRotation(element.rotation) },
      ]),
    ),
  );
}

export function removeElements(layout: Layout, ids: readonly string[]): Layout {
  const doomed = new Set(ids);
  return {
    ...layout,
    elements: layout.elements.filter((element) => !doomed.has(element.id)),
  };
}
