// Catalogue d'éléments : configuration pure, extensible par secteur sans toucher au moteur.
import type { Rotation } from "./schema";

export type CatalogCategory = "poste" | "mobilier" | "equipement" | "structure";
export type Sector = "bureau" | "garage" | "entrepot" | "commerce";

export interface CatalogEntry {
  key: string;
  name: string;
  category: CatalogCategory;
  /** Emprise en tuiles à la rotation 0. */
  w: number;
  h: number;
  rotatable: boolean;
  isWorkstation: boolean;
  /** Forme simple utilisée par le rendu (pas d'asset externe en V1). */
  color: string;
  height: number;
  sector: Sector;
}

const entries: CatalogEntry[] = [
  {
    key: "bureau_simple",
    name: "Bureau simple",
    category: "poste",
    w: 2,
    h: 1,
    rotatable: true,
    isWorkstation: true,
    color: "#c98f5a",
    height: 0.5,
    sector: "bureau",
  },
  {
    key: "bureau_double",
    name: "Bureau double",
    category: "poste",
    w: 2,
    h: 2,
    rotatable: true,
    isWorkstation: true,
    color: "#b97d48",
    height: 0.5,
    sector: "bureau",
  },
  {
    key: "ilot_4",
    name: "Îlot de 4",
    category: "poste",
    w: 3,
    h: 2,
    rotatable: true,
    isWorkstation: true,
    color: "#a86b3a",
    height: 0.5,
    sector: "bureau",
  },
  {
    key: "poste_debout",
    name: "Poste debout",
    category: "poste",
    w: 1,
    h: 1,
    rotatable: true,
    isWorkstation: true,
    color: "#d9a066",
    height: 0.8,
    sector: "bureau",
  },
  {
    key: "chaise",
    name: "Chaise",
    category: "mobilier",
    w: 1,
    h: 1,
    rotatable: true,
    isWorkstation: false,
    color: "#4f6d8f",
    height: 0.4,
    sector: "bureau",
  },
  {
    key: "table_reunion",
    name: "Table de réunion",
    category: "mobilier",
    w: 3,
    h: 2,
    rotatable: true,
    isWorkstation: false,
    color: "#8c5e3c",
    height: 0.5,
    sector: "bureau",
  },
  {
    key: "table_cafeteria",
    name: "Table de cafétéria",
    category: "mobilier",
    w: 2,
    h: 2,
    rotatable: true,
    isWorkstation: false,
    color: "#d9b38c",
    height: 0.5,
    sector: "bureau",
  },
  {
    key: "canape",
    name: "Canapé",
    category: "mobilier",
    w: 2,
    h: 1,
    rotatable: true,
    isWorkstation: false,
    color: "#d1604f",
    height: 0.5,
    sector: "bureau",
  },
  {
    key: "etagere",
    name: "Étagère",
    category: "mobilier",
    w: 2,
    h: 1,
    rotatable: true,
    isWorkstation: false,
    color: "#7a6a58",
    height: 1.6,
    sector: "bureau",
  },
  {
    key: "plante",
    name: "Plante",
    category: "mobilier",
    w: 1,
    h: 1,
    rotatable: false,
    isWorkstation: false,
    color: "#4e9a5b",
    height: 0.9,
    sector: "bureau",
  },
  {
    key: "comptoir_accueil",
    name: "Comptoir d'accueil",
    category: "mobilier",
    w: 3,
    h: 1,
    rotatable: true,
    isWorkstation: false,
    color: "#e0c27a",
    height: 0.9,
    sector: "bureau",
  },
  {
    key: "baie_serveur",
    name: "Baie serveur",
    category: "equipement",
    w: 1,
    h: 1,
    rotatable: true,
    isWorkstation: false,
    color: "#3b4252",
    height: 1.8,
    sector: "bureau",
  },
  {
    key: "machine_cafe",
    name: "Machine à café",
    category: "equipement",
    w: 1,
    h: 1,
    rotatable: true,
    isWorkstation: false,
    color: "#5b4636",
    height: 1.0,
    sector: "bureau",
  },
  {
    key: "mur",
    name: "Mur",
    category: "structure",
    w: 1,
    h: 1,
    rotatable: false,
    isWorkstation: false,
    color: "#e8e1d6",
    height: 2.0,
    sector: "bureau",
  },
  {
    key: "porte",
    name: "Porte",
    category: "structure",
    w: 1,
    h: 1,
    rotatable: false,
    isWorkstation: false,
    color: "#a47551",
    height: 1.8,
    sector: "bureau",
  },
  {
    key: "cloison_vitree",
    name: "Cloison vitrée",
    category: "structure",
    w: 1,
    h: 1,
    rotatable: false,
    isWorkstation: false,
    color: "#9ccfe0",
    height: 1.8,
    sector: "bureau",
  },
];

export const CATALOG: Readonly<Record<string, CatalogEntry>> =
  Object.fromEntries(entries.map((entry) => [entry.key, entry]));

export function getCatalogForSector(sector: Sector): CatalogEntry[] {
  return entries.filter((entry) => entry.sector === sector);
}

/** Emprise réelle (largeur, hauteur) après rotation. */
export function getFootprint(
  entry: CatalogEntry,
  rotation: Rotation,
): { w: number; h: number } {
  return rotation === 90 || rotation === 270
    ? { w: entry.h, h: entry.w }
    : { w: entry.w, h: entry.h };
}
