// Seed de démonstration : deux entreprises 100 % fictives avec leurs trois comptes de test.
// Atelier Lumière est l'entreprise de démonstration complète (26 collaborateurs, stock, matériel, projets).
import "server-only";
import { hashPassword } from "@/lib/auth/password";
import type { AccessContext } from "@/lib/auth/permissions";
import { generateLayout } from "@/lib/map/generator";
import { todayInParis } from "@/lib/privacy/retention";
import { rawPrisma } from "./client";
import { computeCurrentMetrics, recordDailyMetrics } from "./metrics";
import { createTenantDb } from "./tenant";
import { getRepositories } from "./index";
import type { Role } from "./types";

export const DEV_PASSWORD = "Demo-Password-2026!";

export interface SeedAccount {
  email: string;
  role: Role;
  userId: string;
  personId: string;
  context: AccessContext;
}

export interface SeededOrganization {
  organizationId: string;
  name: string;
  accounts: Record<"admin" | "manager" | "employee", SeedAccount>;
  workstationIds: string[];
}

export interface OrganizationSpec {
  name: string;
  sector: string;
  emailDomain: string;
  mapSeed: number;
  people: Array<{
    firstName: string;
    lastName: string;
    jobTitle: string;
    team: string;
  }>;
}

const ACCOUNT_ROLES: Array<{
  key: "admin" | "manager" | "employee";
  role: Role;
  index: number;
}> = [
  { key: "admin", role: "ADMIN", index: 0 },
  { key: "manager", role: "MANAGER", index: 1 },
  { key: "employee", role: "EMPLOYEE", index: 2 },
];

/** Crée une entreprise, ses équipes, ses collaborateurs, ses comptes et une carte active. */
export async function seedOrganization(
  spec: OrganizationSpec,
  password = DEV_PASSWORD,
): Promise<SeededOrganization> {
  const organization = await rawPrisma.organization.create({
    data: { name: spec.name, sector: spec.sector },
  });
  const teams = new Map<string, string>();
  for (const name of new Set(spec.people.map((person) => person.team))) {
    const team = await rawPrisma.team.create({
      data: { organizationId: organization.id, name },
    });
    teams.set(name, team.id);
  }

  const passwordHash = await hashPassword(password);
  const people: string[] = [];
  for (const person of spec.people) {
    const row = await rawPrisma.person.create({
      data: {
        organizationId: organization.id,
        firstName: person.firstName,
        lastName: person.lastName,
        workEmail:
          `${person.firstName}.${person.lastName}@${spec.emailDomain}`.toLowerCase(),
        jobTitle: person.jobTitle,
        teamId: teams.get(person.team) ?? null,
      },
    });
    people.push(row.id);
  }

  const accounts = {} as SeededOrganization["accounts"];
  for (const { key, role, index } of ACCOUNT_ROLES) {
    const email = `${key}@${spec.emailDomain}`;
    const user = await rawPrisma.user.create({
      data: {
        organizationId: organization.id,
        email,
        passwordHash,
        role,
        personId: people[index],
      },
    });
    accounts[key] = {
      email,
      role,
      userId: user.id,
      personId: people[index],
      context: {
        userId: user.id,
        organizationId: organization.id,
        role,
        personId: people[index],
      },
    };
  }

  const repositories = getRepositories(accounts.admin.context);
  await repositories.layouts.saveNewVersion(generateLayout(spec.mapSeed));

  // Attribue les premiers collaborateurs aux premiers postes
  const workstations = await repositories.workstations.list();
  for (const [index, workstation] of workstations
    .slice(0, people.length)
    .entries()) {
    await repositories.workstations.assign({
      workstationId: workstation.id,
      personId: people[index],
    });
  }
  return {
    organizationId: organization.id,
    name: spec.name,
    accounts,
    workstationIds: workstations.map((workstation) => workstation.id),
  };
}

/** Exemples de stock, de matériel et de projets pour la démonstration (données fictives). */
export async function seedSampleData(
  organization: SeededOrganization,
): Promise<void> {
  const repos = getRepositories(organization.accounts.manager.context);
  const zones = await repos.zones.list();
  const zoneOfType = (type: string) =>
    (zones.find((zone) => zone.type === type) ?? zones[0]).id;
  const reserve = zoneOfType("reserve");

  const paper = await repos.stock.createItem({
    name: "Ramettes de papier A4",
    reference: "PAP-A4",
    unit: "ramettes",
    threshold: 10,
    zoneId: reserve,
  });
  await repos.stock.addMovement({
    stockItemId: paper.id,
    type: "IN",
    quantity: 20,
    reason: "Livraison fournisseur",
  });
  await repos.stock.addMovement({
    stockItemId: paper.id,
    type: "OUT",
    quantity: 16,
    reason: "Réapprovisionnement des imprimantes",
  });
  const capsules = await repos.stock.createItem({
    name: "Capsules de café",
    reference: "CAF-01",
    unit: "capsules",
    threshold: 20,
    zoneId: zoneOfType("cafeteria"),
  });
  await repos.stock.addMovement({
    stockItemId: capsules.id,
    type: "IN",
    quantity: 60,
    reason: "Commande mensuelle",
  });
  const cables = await repos.stock.createItem({
    name: "Câbles HDMI",
    reference: "CAB-HDMI",
    unit: "unités",
    threshold: 5,
    zoneId: reserve,
  });
  await repos.stock.addMovement({
    stockItemId: cables.id,
    type: "IN",
    quantity: 12,
    reason: "Livraison fournisseur",
  });

  const base = {
    purchaseDate: new Date("2024-03-15"),
    personId: null,
    zoneId: null,
  };
  await repos.assets.create({
    ...base,
    type: "Ordinateur portable",
    brand: "Dell",
    model: "Latitude 5440",
    serialNumber: "DL-0001",
    state: "IN_SERVICE",
    personId: organization.accounts.employee.personId,
  });
  await repos.assets.create({
    ...base,
    type: "Écran",
    brand: "LG",
    model: "24MK430H",
    serialNumber: "LG-0042",
    state: "IN_SERVICE",
    zoneId: zoneOfType("open_space"),
  });
  await repos.assets.create({
    ...base,
    type: "Serveur NAS",
    brand: "Synology",
    model: "DS923+",
    serialNumber: "SY-0007",
    state: "BROKEN",
    zoneId: zoneOfType("salle_serveur"),
  });
  await repos.assets.create({
    ...base,
    type: "Imprimante",
    brand: "Brother",
    model: "HL-L3270CDW",
    serialNumber: "BR-0310",
    state: "TO_RENEW",
    zoneId: zoneOfType("accueil"),
  });

  const teams = await repos.teams.list();
  const technique = teams.find((team) => team.name === "Technique")?.id ?? null;
  const network = await repos.projects.create({
    name: "Migration vers le nouveau réseau",
    teamId: technique,
    description: "Câblage et bascule des postes",
  });
  const networkSteps = [
    "Audit de l'existant",
    "Achat du matériel",
    "Câblage",
    "Bascule des postes",
  ];
  for (const [index, name] of networkSteps.entries()) {
    const step = await repos.projects.addStep(network.id, name);
    if (index < 2) await repos.projects.setStepStatus(step.id, "DONE");
  }
  const offices = await repos.projects.create({
    name: "Réaménagement des bureaux",
    teamId: null,
    description: "",
  });
  for (const name of ["Plan des postes", "Déménagement", "Installation"])
    await repos.projects.addStep(offices.id, name);

  await seedDemoExtras(organization, zoneOfType, reserve);
}

/** Compléments de la démonstration (SPEC §9) : alertes de stock, matériel varié, projets à différents stades. */
async function seedDemoExtras(
  organization: SeededOrganization,
  zoneOfType: (type: string) => string,
  reserve: string,
): Promise<void> {
  const repos = getRepositories(organization.accounts.manager.context);
  const teams = await repos.teams.list();
  const team = (name: string) =>
    teams.find((candidate) => candidate.name === name)?.id ?? null;

  const stock: Array<[string, string, string, number, string, number, number]> =
    [
      ["Cartouches d'encre noires", "ENC-N", "unités", 4, "reserve", 9, 6],
      ["Gobelets en carton", "GOB-01", "paquets", 10, "cafeteria", 30, 24],
      ["Stylos à bille", "STY-01", "boîtes", 3, "reserve", 12, 2],
      ["Piles AA", "PIL-AA", "paquets", 5, "reserve", 15, 3],
    ];
  for (const [
    name,
    reference,
    unit,
    threshold,
    zoneType,
    quantity,
    taken,
  ] of stock) {
    const item = await repos.stock.createItem({
      name,
      reference,
      unit,
      threshold,
      zoneId: zoneType === "reserve" ? reserve : zoneOfType(zoneType),
    });
    await repos.stock.addMovement({
      stockItemId: item.id,
      type: "IN",
      quantity,
      reason: "Livraison fournisseur",
    });
    await repos.stock.addMovement({
      stockItemId: item.id,
      type: "OUT",
      quantity: taken,
      reason: "Consommation courante",
    });
  }

  const assets: Array<
    [
      string,
      string,
      string,
      string,
      "IN_SERVICE" | "BROKEN" | "TO_RENEW",
      string,
    ]
  > = [
    [
      "Ordinateur portable",
      "Lenovo",
      "ThinkPad E14",
      "LN-0101",
      "IN_SERVICE",
      "2024-09-02",
    ],
    [
      "Ordinateur portable",
      "HP",
      "ProBook 450",
      "HP-0102",
      "BROKEN",
      "2021-05-10",
    ],
    [
      "Ordinateur portable",
      "Dell",
      "Latitude 5440",
      "DL-0103",
      "IN_SERVICE",
      "2024-03-15",
    ],
    [
      "Ordinateur portable",
      "Apple",
      "MacBook Air 13",
      "AP-0104",
      "TO_RENEW",
      "2020-11-20",
    ],
    [
      "Téléphone",
      "Samsung",
      "Galaxy A54",
      "SM-0201",
      "IN_SERVICE",
      "2024-01-08",
    ],
    ["Téléphone", "Apple", "iPhone 13", "IP-0202", "BROKEN", "2022-02-14"],
    ["Écran", "Dell", "U2723QE", "DL-0301", "IN_SERVICE", "2023-06-01"],
    ["Écran", "LG", "27UL500", "LG-0302", "TO_RENEW", "2019-09-12"],
    [
      "Imprimante",
      "HP",
      "LaserJet Pro M404",
      "HP-0401",
      "IN_SERVICE",
      "2023-04-18",
    ],
    [
      "Vidéoprojecteur",
      "Epson",
      "EB-FH52",
      "EP-0501",
      "IN_SERVICE",
      "2022-10-03",
    ],
  ];
  const people = await repos.people.list({});
  const holders = people.filter((person) => person.status === "ACTIVE");
  for (const [
    index,
    [type, brand, model, serialNumber, state, date],
  ] of assets.entries()) {
    // Ordinateurs et téléphones : affectés à une personne ; le reste : rangé dans une pièce
    const personal = type === "Ordinateur portable" || type === "Téléphone";
    await repos.assets.create({
      type,
      brand,
      model,
      serialNumber,
      state,
      purchaseDate: new Date(date),
      personId: personal ? holders[(3 + index) % holders.length].id : null,
      zoneId: personal
        ? null
        : zoneOfType(
            type === "Vidéoprojecteur" ? "salle_reunion" : "open_space",
          ),
    });
  }

  // Projets à trois stades : terminé, en cours, pas commencé (les deux premiers projets sont dans le jeu de base)
  const launch = await repos.projects.create({
    name: "Lancement de l'offre de rentrée",
    teamId: team("Commercial"),
    description: "Plaquette, tarifs et campagne",
  });
  for (const name of [
    "Plaquette commerciale",
    "Grille tarifaire",
    "Campagne e-mail",
  ]) {
    const step = await repos.projects.addStep(launch.id, name);
    await repos.projects.setStepStatus(step.id, "DONE");
  }
  const support = await repos.projects.create({
    name: "Refonte de la base de connaissances",
    teamId: team("Support"),
    description: "Réécriture des réponses les plus fréquentes",
  });
  for (const [index, name] of [
    "Inventaire des articles",
    "Réécriture",
    "Relecture",
    "Mise en ligne",
  ].entries()) {
    const step = await repos.projects.addStep(support.id, name);
    if (index === 0) await repos.projects.setStepStatus(step.id, "DONE");
    if (index === 1) await repos.projects.setStepStatus(step.id, "IN_PROGRESS");
  }
}

export const DEV_ORGANIZATIONS: OrganizationSpec[] = [
  {
    name: "Atelier Lumière (démo A)",
    sector: "bureau",
    emailDomain: "atelier-lumiere.example",
    mapSeed: 2024,
    people: [
      {
        firstName: "Camille",
        lastName: "Durand",
        jobTitle: "Directrice",
        team: "Direction",
      },
      {
        firstName: "Julien",
        lastName: "Moreau",
        jobTitle: "Office manager",
        team: "Administration",
      },
      {
        firstName: "Sophie",
        lastName: "Bernard",
        jobTitle: "Développeuse",
        team: "Technique",
      },
      {
        firstName: "Lucas",
        lastName: "Petit",
        jobTitle: "Technicien réseau",
        team: "Technique",
      },
      {
        firstName: "Emma",
        lastName: "Roux",
        jobTitle: "Commerciale",
        team: "Commercial",
      },
      {
        firstName: "Inès",
        lastName: "Garcia",
        jobTitle: "Responsable RH",
        team: "Administration",
      },
      {
        firstName: "Thomas",
        lastName: "Lefebvre",
        jobTitle: "Comptable",
        team: "Administration",
      },
      {
        firstName: "Manon",
        lastName: "Simon",
        jobTitle: "Assistante de direction",
        team: "Direction",
      },
      {
        firstName: "Maxime",
        lastName: "Michel",
        jobTitle: "Développeur",
        team: "Technique",
      },
      {
        firstName: "Clara",
        lastName: "Laurent",
        jobTitle: "Développeuse",
        team: "Technique",
      },
      {
        firstName: "Antoine",
        lastName: "Fontaine",
        jobTitle: "Administrateur système",
        team: "Technique",
      },
      {
        firstName: "Jade",
        lastName: "Chevalier",
        jobTitle: "Chef de projet",
        team: "Technique",
      },
      {
        firstName: "Hugo",
        lastName: "Marchand",
        jobTitle: "Testeur logiciel",
        team: "Technique",
      },
      {
        firstName: "Louise",
        lastName: "Blanc",
        jobTitle: "Commerciale",
        team: "Commercial",
      },
      {
        firstName: "Nicolas",
        lastName: "Guerin",
        jobTitle: "Commercial",
        team: "Commercial",
      },
      {
        firstName: "Océane",
        lastName: "Muller",
        jobTitle: "Chargée de marketing",
        team: "Commercial",
      },
      {
        firstName: "Paul",
        lastName: "Henry",
        jobTitle: "Responsable des ventes",
        team: "Commercial",
      },
      {
        firstName: "Sarah",
        lastName: "Rousseau",
        jobTitle: "Conseillère clientèle",
        team: "Support",
      },
      {
        firstName: "Théo",
        lastName: "Mercier",
        jobTitle: "Conseiller clientèle",
        team: "Support",
      },
      {
        firstName: "Alice",
        lastName: "Dupuis",
        jobTitle: "Responsable du support",
        team: "Support",
      },
      {
        firstName: "Romain",
        lastName: "Lemaire",
        jobTitle: "Technicien support",
        team: "Support",
      },
      {
        firstName: "Zoé",
        lastName: "Girault",
        jobTitle: "Conseillère clientèle",
        team: "Support",
      },
      {
        firstName: "Victor",
        lastName: "Colin",
        jobTitle: "Technicien support",
        team: "Support",
      },
      {
        firstName: "Elsa",
        lastName: "Vidal",
        jobTitle: "Graphiste",
        team: "Commercial",
      },
      {
        firstName: "Adrien",
        lastName: "Perrin",
        jobTitle: "Développeur",
        team: "Technique",
      },
      {
        firstName: "Lola",
        lastName: "Bonnet",
        jobTitle: "Juriste",
        team: "Administration",
      },
    ],
  },
  {
    name: "Boulangerie Dupont (démo B)",
    sector: "bureau",
    emailDomain: "boulangerie-dupont.example",
    mapSeed: 77,
    people: [
      {
        firstName: "Hugo",
        lastName: "Leroy",
        jobTitle: "Gérant",
        team: "Direction",
      },
      {
        firstName: "Léa",
        lastName: "Fournier",
        jobTitle: "Responsable de boutique",
        team: "Boutique",
      },
      {
        firstName: "Nathan",
        lastName: "Girard",
        jobTitle: "Vendeur",
        team: "Boutique",
      },
      {
        firstName: "Chloé",
        lastName: "Lambert",
        jobTitle: "Comptable",
        team: "Administration",
      },
    ],
  },
];

export async function seedDevelopment(): Promise<SeededOrganization[]> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Le seed de développement est interdit en production (mot de passe de démonstration).",
    );
  }
  const existing = await rawPrisma.organization.count();
  if (existing > 0)
    throw new Error("La base contient déjà des données : seed annulé.");
  const result: SeededOrganization[] = [];
  for (const spec of DEV_ORGANIZATIONS) {
    const organization = await seedOrganization(spec);
    await seedSampleData(organization);
    await seedMetricHistory(organization);
    result.push(organization);
  }
  return result;
}

/** Entreprise dédiée aux tests e2e destructifs (enregistrement, restauration de cartes) : recréée avant chaque série. */
export const E2E_ORGANIZATION: OrganizationSpec = {
  name: "Atelier E2E (test automatisé)",
  sector: "bureau",
  emailDomain: "atelier-e2e.example",
  mapSeed: 2024,
  people: [
    {
      firstName: "Paul",
      lastName: "Martin",
      jobTitle: "Directeur",
      team: "Direction",
    },
    {
      firstName: "Inès",
      lastName: "Garnier",
      jobTitle: "Office manager",
      team: "Administration",
    },
    {
      firstName: "Théo",
      lastName: "Faure",
      jobTitle: "Développeur",
      team: "Technique",
    },
    {
      firstName: "Manon",
      lastName: "Blanc",
      jobTitle: "Technicienne",
      team: "Technique",
    },
    {
      firstName: "Jules",
      lastName: "Chevalier",
      jobTitle: "Commercial",
      team: "Commercial",
    },
  ],
};

/** Supprime puis recrée l'entreprise de test e2e (les autres entreprises ne sont jamais touchées). */
export async function resetE2eOrganization(): Promise<SeededOrganization> {
  if (process.env.NODE_ENV === "production")
    throw new Error("Interdit en production");
  await rawPrisma.organization.deleteMany({
    where: { name: E2E_ORGANIZATION.name },
  });
  const organization = await seedOrganization(E2E_ORGANIZATION);
  await seedSampleData(organization);
  return organization;
}

/**
 * Relevé fictif d'il y a 7 jours (totaux seulement) : la démonstration montre des tendances dès l'installation.
 * Les écarts sont inventés (données de démonstration).
 */
export async function seedMetricHistory(
  organization: SeededOrganization,
  now: Date = new Date(),
): Promise<void> {
  const db = createTenantDb(organization.organizationId);
  const current = await computeCurrentMetrics(db);
  const today = todayInParis(now);
  await recordDailyMetrics(db, new Date(today.getTime() - 7 * 86_400_000), {
    people: Math.max(0, current.people - 2),
    workstationsOccupied: Math.max(0, current.workstationsOccupied - 3),
    workstationsTotal: current.workstationsTotal,
    lowStock: current.lowStock + 1,
    brokenAssets: Math.max(0, current.brokenAssets - 1),
  });
}
