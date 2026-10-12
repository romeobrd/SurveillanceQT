// Données 100 % fictives (faker, locale fr) rattachées aux zones d'une carte générée.
import { fakerFR as faker } from "@faker-js/faker";
import { CATALOG } from "@/lib/map/catalog";
import type { PersonMarker } from "@/lib/map/scene";
import type { Layout } from "@/lib/map/schema";
import type {
  AssetState,
  MockAsset,
  MockData,
  MockPerson,
  MockProject,
  MockStockItem,
  MockWorkstation,
} from "./types";

const TEAMS = [
  "Commercial",
  "Technique",
  "Support",
  "Administration",
  "Direction",
] as const;
const TEAM_COLORS: Record<string, string> = {
  Commercial: "#d1604f",
  Technique: "#3a7ca5",
  Support: "#6a994e",
  Administration: "#9b6bb5",
  Direction: "#e0a030",
};
const JOB_TITLES: Record<string, string[]> = {
  Commercial: [
    "Commercial",
    "Responsable grands comptes",
    "Assistant commercial",
  ],
  Technique: ["Développeur", "Technicien réseau", "Chef de projet technique"],
  Support: ["Conseiller support", "Responsable support"],
  Administration: ["Comptable", "Assistant administratif", "Office manager"],
  Direction: ["Directeur", "Directeur adjoint"],
};
const STOCK_NAMES = [
  "Ramettes de papier A4",
  "Cartouches d'encre",
  "Capsules de café",
  "Gobelets",
  "Câbles HDMI",
  "Stylos",
];
const ASSET_LABELS = [
  "Ordinateur portable",
  "Écran 24 pouces",
  "Téléphone IP",
  "Imprimante",
];

function pickAssetState(): AssetState {
  const roll = faker.number.float();
  return roll < 0.12 ? "en_panne" : roll < 0.25 ? "a_renouveler" : "en_service";
}

export function generateMockData(layout: Layout): MockData {
  faker.seed(layout.seed ?? 1);

  const people: MockPerson[] = [];
  const workstations: MockWorkstation[] = [];
  const stock: MockStockItem[] = [];
  const assets: MockAsset[] = [];

  const teamByZone = new Map(
    layout.zones.map((zone) => [zone.id, faker.helpers.arrayElement(TEAMS)]),
  );

  const counters = new Map<string, number>();
  for (const element of layout.elements) {
    const entry = CATALOG[element.catalogKey];
    if (!entry.isWorkstation) continue;
    const n = (counters.get(element.zoneId) ?? 0) + 1;
    counters.set(element.zoneId, n);
    const workstation: MockWorkstation = {
      elementId: element.id,
      zoneId: element.zoneId,
      label: `${entry.name} ${n}`,
      personId: null,
    };
    if (faker.number.float() < 0.75) {
      const team = teamByZone.get(element.zoneId) ?? TEAMS[0];
      const person: MockPerson = {
        id: `p${people.length + 1}`,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        jobTitle: faker.helpers.arrayElement(JOB_TITLES[team]),
        team,
      };
      people.push(person);
      workstation.personId = person.id;
      assets.push({
        id: `a${assets.length + 1}`,
        zoneId: element.zoneId,
        label: faker.helpers.arrayElement(ASSET_LABELS),
        state: pickAssetState(),
      });
    }
    workstations.push(workstation);
  }

  for (const zone of layout.zones) {
    if (zone.type === "salle_serveur") {
      for (let i = 1; i <= 3; i++) {
        assets.push({
          id: `a${assets.length + 1}`,
          zoneId: zone.id,
          label: `Serveur ${i}`,
          state: pickAssetState(),
        });
      }
    }
    if (zone.type === "reserve" || zone.type === "cafeteria") {
      for (const name of faker.helpers.arrayElements(STOCK_NAMES, {
        min: 2,
        max: 4,
      })) {
        const threshold = faker.number.int({ min: 5, max: 20 });
        stock.push({
          id: `s${stock.length + 1}`,
          zoneId: zone.id,
          name,
          unit: "unités",
          threshold,
          quantity: faker.number.int({ min: 0, max: threshold * 3 }),
        });
      }
    }
  }

  const projects: MockProject[] = TEAMS.slice(0, 3).map((team, index) => ({
    id: `pr${index + 1}`,
    name: faker.commerce.productName(),
    team,
    progress: faker.number.int({ min: 10, max: 95 }),
  }));

  return { people, workstations, stock, assets, projects };
}

/** Occupants des postes à dessiner sur la carte (affectation, jamais présence réelle). */
export function getPersonMarkers(data: MockData): PersonMarker[] {
  const personById = new Map(data.people.map((person) => [person.id, person]));
  return data.workstations.flatMap((workstation) => {
    const person = workstation.personId
      ? personById.get(workstation.personId)
      : undefined;
    return person
      ? [
          {
            workstationElementId: workstation.elementId,
            color: TEAM_COLORS[person.team] ?? "#888888",
          },
        ]
      : [];
  });
}
