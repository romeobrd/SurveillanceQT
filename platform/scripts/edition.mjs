// Lance Next.js dans une édition de Spacora (saas, boutique, desktop), sur Windows comme sous Linux.
// Usage : node scripts/edition.mjs <édition> <commande next…>   ex. node scripts/edition.mjs boutique dev
// Chaque édition a son propre dossier de construction : elles peuvent tourner côte à côte.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const [editionName, ...args] = process.argv.slice(2);
if (!["saas", "boutique", "desktop"].includes(editionName ?? "")) {
  console.error(
    "Usage : node scripts/edition.mjs <saas|boutique|desktop> <commande next…>",
  );
  process.exit(1);
}
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), ...args],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SPACORA_EDITION: editionName,
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? `.next-${editionName}`,
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
