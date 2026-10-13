// Contrat du moteur de rendu de la carte : l'éditeur et les composants ne dépendent que de ces types.

export interface MapRendererOptions {
  host: HTMLElement;
  onZoneHover?: (zoneId: string | null) => void;
  onZoneClick?: (zoneId: string | null) => void;
  /** Appelé quand la vue change (caméra, taille) : pour repositionner les étiquettes posées sur la carte. */
  onViewChange?: () => void;
}

export interface BenchmarkResult {
  frames: number;
  averageMs: number;
  p95Ms: number;
  visibleItems: number;
  totalItems: number;
}

/** Geste de pointeur traduit en coordonnées de carte, transmis à l'éditeur. */
export interface EditorPointer {
  /** Tuile sous le pointeur, null hors du plan. */
  tile: { x: number; y: number } | null;
  /** Position fractionnaire sur la grille (pour viser une arête). */
  grid: { x: number; y: number };
  shift: boolean;
}

/** Passerelle vers l'éditeur : le moteur de rendu transmet les gestes et laisse l'éditeur décider. */
export interface EditorBridge {
  /** Retourne true si l'éditeur prend le geste (sinon la caméra se déplace). */
  onPointerDown(pointer: EditorPointer): boolean;
  onPointerMove(pointer: EditorPointer): void;
  onPointerUp(pointer: EditorPointer): void;
  /** Retourne true si la touche est gérée (sinon la caméra peut réagir). */
  onKeyDown(event: KeyboardEvent): boolean;
  onCancel(): void;
}

export type RenderQuality = "high" | "low";
