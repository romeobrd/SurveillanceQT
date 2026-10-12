// Personnages affichés sur la carte : une affectation de poste, jamais une présence réelle.
import type { PersonMarker } from "@/lib/map/scene";
import type { MapData } from "./types";

const PALETTE = [
  "#d1604f",
  "#3a7ca5",
  "#6a994e",
  "#9b6bb5",
  "#e0a030",
  "#2a9d8f",
  "#c06c84",
  "#7f8c8d",
];

/** Couleur décorative stable par équipe (n'a aucune valeur d'information sur la personne). */
export function teamColor(team: string): string {
  let hash = 0;
  for (const char of team) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function getPersonMarkers(data: MapData): PersonMarker[] {
  const personById = new Map(data.people.map((person) => [person.id, person]));
  return data.workstations.flatMap((workstation) => {
    const person = workstation.personId
      ? personById.get(workstation.personId)
      : undefined;
    return person
      ? [
          {
            workstationElementId: workstation.elementId,
            color: teamColor(person.team),
          },
        ]
      : [];
  });
}
