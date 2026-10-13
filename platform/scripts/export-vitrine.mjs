// Export du site vitrine en fichiers statiques (HTML + CSS + images, sans aucun script),
// à déposer sur un hébergement web simple. Usage : npm run export:vitrine
// Construit l'application en mode « site vitrine » dans .next-vitrine (la construction normale n'est pas touchée),
// la démarre le temps de l'export, enregistre les pages dans vitrine/, puis l'arrête.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "vitrine");
const port = 3999;
const base = `http://localhost:${port}`;
const PAGES = ["/", "/mentions-legales", "/confidentialite"];

const env = {
  ...process.env,
  STATIC_SITE: "1",
  NEXT_DIST_DIR: ".next-vitrine",
  // La vitrine n'utilise pas la base, mais le client Prisma exige l'adresse au chargement
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://vitrine:vitrine@localhost:5432/vitrine",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "export-vitrine-sans-session",
};
const nextBin = require.resolve("next/dist/bin/next");

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`next ${args[0]} : code ${code}`)),
    );
  });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/mentions-legales`)).ok) return;
    } catch {
      // serveur pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Le serveur d'export n'a pas démarré");
}

/** Télécharge un fichier de /_next/static (ou la favicon) et renvoie son chemin dans le site exporté. */
const downloaded = new Map();
async function asset(url) {
  const clean = url.split("?")[0];
  if (downloaded.has(clean)) return downloaded.get(clean);
  const target = clean.startsWith("/_next/static/")
    ? `/assets/${clean.slice("/_next/static/".length)}`
    : clean;
  downloaded.set(clean, target);
  const response = await fetch(base + clean);
  if (!response.ok) throw new Error(`${clean} : ${response.status}`);
  const file = path.join(out, target);
  mkdirSync(path.dirname(file), { recursive: true });
  if (clean.endsWith(".css")) {
    // Polices et images référencées par la feuille de style
    let css = await response.text();
    for (const ref of new Set(css.match(/\/_next\/static\/[^)"'\s]+/g) ?? []))
      css = css.replaceAll(ref, await asset(ref));
    writeFileSync(file, css);
  } else writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return target;
}

async function exportPage(route) {
  let html = await (await fetch(base + route)).text();
  html = html
    // Aucun script : la vitrine est 100 % statique
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(
      /<link\b[^>]*rel="(?:preload|modulepreload|prefetch|expect)"[^>]*>/g,
      "",
    )
    .replace(/\s(?:srcSet|srcset|imageSrcSet)="[^"]*"/g, "");
  for (const ref of new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? []))
    html = html.replaceAll(ref, await asset(ref.replaceAll("&amp;", "&")));
  if (/\/_next\//.test(html))
    throw new Error(`${route} : référence restante à /_next`);
  const file =
    route === "/"
      ? path.join(out, "index.html")
      : path.join(out, route, "index.html");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(`  ${route} → ${path.relative(root, file)}`);
}

const HTACCESS = `# Site vitrine Spacora : en-têtes de sécurité (aucun script, aucune ressource externe)
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set X-Frame-Options "DENY"
  Header always set Permissions-Policy "geolocation=(), camera=(), microphone=()"
</IfModule>
# Fichiers de assets/ : noms uniques à chaque export, mis en cache longtemps
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
`;

console.log("Construction du site vitrine…");
await run(["build"]);
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: root,
  env,
  stdio: "ignore",
});
try {
  await waitForServer();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  console.log("Export des pages :");
  for (const route of PAGES) await exportPage(route);
  await asset("/favicon.ico");
  writeFileSync(path.join(out, ".htaccess"), HTACCESS);
  console.log(
    `Terminé : déposez le contenu du dossier vitrine/ dans le dossier www de l'hébergement.`,
  );
} finally {
  server.kill();
}
