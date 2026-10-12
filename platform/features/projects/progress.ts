// Progression d'un projet : calculée à partir de ses étapes.

export type StepState = "TODO" | "IN_PROGRESS" | "DONE";

export type ProjectState = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

/** Pourcentage d'étapes terminées (0 sans étape). */
export function computeProgress(
  steps: ReadonlyArray<{ status: StepState }>,
): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((step) => step.status === "DONE").length;
  return Math.round((done / steps.length) * 100);
}

export function computeProjectState(
  steps: ReadonlyArray<{ status: StepState }>,
): ProjectState {
  if (steps.length === 0 || steps.every((step) => step.status === "TODO"))
    return "NOT_STARTED";
  return steps.every((step) => step.status === "DONE") ? "DONE" : "IN_PROGRESS";
}

/** Après échange de deux étapes voisines, retourne les nouveaux ordres (null si déplacement impossible). */
export function swapTarget(
  steps: ReadonlyArray<{ id: string; order: number }>,
  stepId: string,
  direction: "up" | "down",
): { id: string; order: number } | null {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((step) => step.id === stepId);
  const neighbour = sorted[direction === "up" ? index - 1 : index + 1];
  return index >= 0 && neighbour ? neighbour : null;
}
