// Quantité d'un article de stock : toujours calculée à partir des mouvements (jamais stockée).

export type MovementKind = "IN" | "OUT" | "ADJUSTMENT";

export interface MovementSum {
  type: MovementKind;
  quantity: number;
}

/** Effet d'un mouvement sur la quantité : entrée +, sortie −, ajustement = écart signé. */
export function movementDelta(type: MovementKind, quantity: number): number {
  return type === "OUT" ? -quantity : quantity;
}

export function computeQuantity(movements: readonly MovementSum[]): number {
  return movements.reduce(
    (total, movement) =>
      total + movementDelta(movement.type, movement.quantity),
    0,
  );
}

/** Alerte quand la quantité passe sous le seuil. Un seuil à 0 désactive l'alerte. */
export function isBelowThreshold(quantity: number, threshold: number): boolean {
  return threshold > 0 && quantity < threshold;
}

/** Valide un mouvement : quantité entière, positive pour entrée/sortie, non nulle pour un ajustement. */
export function isValidMovement(type: MovementKind, quantity: number): boolean {
  if (!Number.isInteger(quantity)) return false;
  return type === "ADJUSTMENT" ? quantity !== 0 : quantity > 0;
}
