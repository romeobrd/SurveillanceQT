// Garde-fous RGPD / secrets : échouent si quelqu'un ajoute un champ sensible ou commit un secret.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

describe("secrets", () => {
  it("ne versionne aucun fichier .env (seul .env.example est permis)", () => {
    const envFiles = tracked.filter((file) => /(^|\/)\.env(\..*)?$/.test(file));
    expect(envFiles.filter((file) => !file.endsWith(".env.example"))).toEqual(
      [],
    );
  });

  it("ne contient aucune valeur de secret réelle dans les fichiers versionnés", () => {
    const offenders: string[] = [];
    for (const file of tracked) {
      if (
        !/\.(ts|tsx|mts|json|md|yml|yaml|mjs|env\.example|sh)$/.test(file) &&
        !file.endsWith(".env.example")
      )
        continue;
      if (file === "package-lock.json" || file === "tests/unit/hygiene.test.ts")
        continue;
      const text = readFileSync(file, "utf8");
      // AUTH_SECRET / CRON_SECRET suivis d'une valeur longue et non factice
      for (const match of text.matchAll(
        /(?:AUTH_SECRET|CRON_SECRET)\s*[=:]\s*["']?([A-Za-z0-9+/=_-]{32,})/g,
      )) {
        if (!/change|exemple|example|xxx|remplacer|openssl/i.test(match[1]))
          offenders.push(`${file} : ${match[0].slice(0, 30)}…`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("modèle de données", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  // Noms de champs interdits : localisation, historique de présence, données sensibles (art. 9 RGPD), identifiants réseau
  const FORBIDDEN =
    /\b(latitude|longitude|geoloc\w*|gps\w*|ipAddress|ip|userAgent|birth\w*|dateOfBirth|ssn|socialSecurity\w*|iban|bankAccount\w*|health\w*|religion|ethnic\w*|politic\w*|union\w*|sexual\w*|salary|photo|avatar|phone\w*|address|checkIn\w*|checkOut\w*|lastSeen\w*|loginAt|lastLogin\w*)\b/i;

  it("ne contient aucun champ de localisation, de pistage ou de donnée sensible", () => {
    const fieldNames = schema
      .split("\n")
      .map((line) => /^\s{2}(\w+)\s+\S+/.exec(line)?.[1])
      .filter(
        (name): name is string =>
          Boolean(name) && !["model", "enum"].includes(name!),
      );
    expect(fieldNames.filter((name) => FORBIDDEN.test(name))).toEqual([]);
  });

  it("garde la présence sans historique : un seul statut par personne et par jour", () => {
    expect(schema).toMatch(
      /model PresenceStatus[\s\S]*@@unique\(\[personId, date\]\)/,
    );
  });
});

describe("couleurs de la marque", () => {
  it("chaque nuance brand-* utilisée est définie dans globals.css", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const defined = new Set(
      [...css.matchAll(/--color-brand-(\d+)/g)].map((match) => match[1]),
    );
    const used = new Set<string>();
    for (const file of tracked.filter((name) =>
      /^(app|components|lib)\/.*\.tsx?$/.test(name),
    ))
      for (const match of readFileSync(file, "utf8").matchAll(/brand-(\d+)/g))
        used.add(match[1]);
    expect([...used].filter((shade) => !defined.has(shade))).toEqual([]);
  });
});
