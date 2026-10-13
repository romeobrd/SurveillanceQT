// Données affichées sur la carte et dans le panneau de zone (lues en base, par zone de la carte).

export type Role = "admin" | "manager" | "employe";

/** Champs strictement limités à SPEC §4 : aucune autre donnée personnelle. */
export interface MapPerson {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  team: string;
}

export interface MapWorkstation {
  elementId: string;
  zoneId: string;
  label: string;
  personId: string | null;
}

export interface MapStockItem {
  id: string;
  zoneId: string;
  name: string;
  quantity: number;
  unit: string;
  threshold: number;
}

export type AssetState = "IN_SERVICE" | "BROKEN" | "TO_RENEW" | "RETIRED";

export interface MapAsset {
  id: string;
  zoneId: string;
  label: string;
  state: AssetState;
}

export interface MapProject {
  id: string;
  name: string;
  team: string;
  /** Avancement en pourcentage (0 à 100). */
  progress: number;
  /** Étapes dans l'ordre (absentes des anciennes données : liste vide). */
  steps?: Array<{ name: string; status: "TODO" | "IN_PROGRESS" | "DONE" }>;
}

export interface MapData {
  people: MapPerson[];
  workstations: MapWorkstation[];
  stock: MapStockItem[];
  assets: MapAsset[];
  projects: MapProject[];
}
