// Libellés et couleurs de sol par type de zone.
import type { ZoneType } from "./schema";

export const ZONE_LABELS: Readonly<Record<ZoneType, string>> = {
  open_space: "Open space",
  bureau_individuel: "Bureau individuel",
  salle_reunion: "Salle de réunion",
  cafeteria: "Cafétéria",
  reserve: "Réserve",
  salle_serveur: "Salle serveur",
  accueil: "Accueil",
};

export const ZONE_FLOOR_COLORS: Readonly<Record<ZoneType, string>> = {
  open_space: "#d8e6c9",
  bureau_individuel: "#e6d9c3",
  salle_reunion: "#c9d9e8",
  cafeteria: "#f0d9b5",
  reserve: "#d9d2c5",
  salle_serveur: "#c5cdd9",
  accueil: "#efe3c2",
};
