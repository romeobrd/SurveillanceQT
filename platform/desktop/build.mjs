// Prépare les ressources de l'application de bureau, puis (option --package) construit l'installateur.
//   node desktop/build.mjs            → desktop/resources/{server,migrations} (serveur Spacora autonome)
//   node desktop/build.mjs --package  → + desktop/dist/ (Spacora-Setup.exe sous Windows, dossier sous Linux)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const desktop = import.meta.dirname;
const platform = path.resolve(desktop, "..");
const resources = path.join(desktop, "resources");
const distDir = ".next-desktop";
const require = createRequire(import.meta.url);

function run(command, args, cwd, env = {}) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

console.log("1/3 Construction de Spacora (édition bureau, serveur autonome)…");
rmSync(path.join(platform, distDir), { recursive: true, force: true });
run(
  process.execPath,
  [require.resolve("next/dist/bin/next", { paths: [platform] }), "build"],
  platform,
  {
    SPACORA_EDITION: "desktop",
    NEXT_DIST_DIR: distDir,
    NEXT_OUTPUT: "standalone",
    // La construction ne se connecte pas à la base, mais le client Prisma exige la variable
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://build:build@localhost:5432/build",
  },
);

console.log("2/3 Assemblage des ressources…");
rmSync(resources, { recursive: true, force: true });
const standalone = path.join(platform, distDir, "standalone");
const server = path.join(resources, "server");
cpSync(standalone, server, { recursive: true, dereference: true });
// Fichiers statiques et images : non copiés par Next dans le serveur autonome
cpSync(
  path.join(platform, distDir, "static"),
  path.join(server, distDir, "static"),
  { recursive: true },
);
cpSync(path.join(platform, "public"), path.join(server, "public"), {
  recursive: true,
});
// Aucun secret de développement dans l'installateur
for (const file of [".env", ".env.local", ".env.production"])
  rmSync(path.join(server, file), { force: true });
cpSync(
  path.join(platform, "prisma", "migrations"),
  path.join(resources, "migrations"),
  { recursive: true },
);
if (!existsSync(path.join(server, "server.js")))
  throw new Error("server.js absent du serveur autonome");

if (process.argv.includes("--package")) {
  console.log("3/3 Construction de l'installateur…");
  run(
    process.execPath,
    [require.resolve("electron-builder/cli.js"), "--publish", "never"],
    desktop,
  );
} else console.log("3/3 Installateur non demandé (ajouter --package).");
