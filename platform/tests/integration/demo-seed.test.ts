// Le seed de démonstration respecte SPEC §9 : de quoi tester l'application sans rien saisir.
import { beforeAll, describe, expect, it } from "vitest";
import { getRepositories } from "@/lib/db";
import { resetDatabase } from "@/lib/db/testing";
import { seedDevelopment, type SeededOrganization } from "@/lib/db/seed";

let demo: SeededOrganization;
let repos: ReturnType<typeof getRepositories>;

beforeAll(async () => {
  await resetDatabase();
  [demo] = await seedDevelopment();
  repos = getRepositories(demo.accounts.admin.context);
});

describe("seed de démonstration", () => {
  it("compte entre 15 et 40 collaborateurs répartis en équipes, tous attribués à un poste", async () => {
    const people = await repos.people.list({});
    expect(people.length).toBeGreaterThanOrEqual(15);
    expect(people.length).toBeLessThanOrEqual(40);
    expect(
      new Set(people.map((person) => person.teamName)).size,
    ).toBeGreaterThanOrEqual(4);
    const stations = await repos.workstations.list();
    const occupied = stations.filter((station) => station.personId);
    expect(occupied.length).toBe(people.length);
    expect(stations.length - occupied.length).toBeGreaterThan(0); // des postes restent libres pour tester l'attribution
  });

  it("contient des articles sous le seuil", async () => {
    const dashboard = await repos.dashboard.get();
    expect(dashboard.lowStock.length).toBeGreaterThanOrEqual(3);
  });

  it("contient du matériel varié dont une partie en panne ou à renouveler", async () => {
    const assets = await repos.assets.list({});
    expect(
      new Set(assets.map((asset) => asset.type)).size,
    ).toBeGreaterThanOrEqual(4);
    expect(
      assets.filter((asset) => asset.state === "BROKEN").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      assets.filter((asset) => asset.state === "TO_RENEW").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("contient au moins 3 projets à des stades différents (0 %, en cours, 100 %)", async () => {
    const { projects } = await repos.dashboard.get();
    expect(projects.length).toBeGreaterThanOrEqual(3);
    const progress = projects.map((project) => project.progress);
    expect(progress).toContain(0);
    expect(progress).toContain(100);
    expect(progress.some((value) => value > 0 && value < 100)).toBe(true);
  });

  it("documente les trois comptes de test, mot de passe commun", async () => {
    expect(Object.keys(demo.accounts)).toEqual([
      "admin",
      "manager",
      "employee",
    ]);
    expect(demo.accounts.admin.email).toBe("admin@atelier-lumiere.example");
  });
});
