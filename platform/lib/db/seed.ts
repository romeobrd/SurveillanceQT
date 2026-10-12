// Seed de développement : deux entreprises 100 % fictives avec leurs trois comptes de test.
// Le seed de démonstration complet (stock, matériel, projets…) arrive en phase 7.
import "server-only";
import { hashPassword } from "@/lib/auth/password";
import type { AccessContext } from "@/lib/auth/permissions";
import { generateLayout } from "@/lib/map/generator";
import { rawPrisma } from "./client";
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
  for (const spec of DEV_ORGANIZATIONS)
    result.push(await seedOrganization(spec));
  return result;
}
