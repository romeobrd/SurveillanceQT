// Types des données factices de la carte (remplacées par la base de données aux phases 3 et 4).

export type Role = "admin" | "manager" | "employe";

/** Champs strictement limités à SPEC §4 : aucune autre donnée personnelle. */
export interface MockPerson {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  team: string;
}

export interface MockWorkstation {
  elementId: string;
  zoneId: string;
  label: string;
  personId: string | null;
}

export interface MockStockItem {
  id: string;
  zoneId: string;
  name: string;
  quantity: number;
  unit: string;
  threshold: number;
}

export type AssetState = "en_service" | "en_panne" | "a_renouveler";

export interface MockAsset {
  id: string;
  zoneId: string;
  label: string;
  state: AssetState;
}

export interface MockProject {
  id: string;
  name: string;
  team: string;
  /** Avancement en pourcentage (0 à 100). */
  progress: number;
}

export interface MockData {
  people: MockPerson[];
  workstations: MockWorkstation[];
  stock: MockStockItem[];
  assets: MockAsset[];
  projects: MockProject[];
}
