// Données d'aperçu de l'éditeur (fantômes, sélection, arête visée…) : format partagé, indépendant du moteur de rendu.
import type { Edge, Rect, Rotation } from "./schema";

/** Calques de l'éditeur : fantômes (vert/rouge), sélection, arête visée, pièce en cours de tracé, rectangle de sélection. */
export interface EditOverlayData {
  ghosts: Array<{
    catalogKey: string;
    x: number;
    y: number;
    rotation: Rotation;
    valid: boolean;
  }>;
  selection: Rect[];
  edge: { edge: Pick<Edge, "x" | "y" | "side">; valid: boolean } | null;
  rect: { rect: Rect; valid: boolean } | null;
  marquee: Rect | null;
}
