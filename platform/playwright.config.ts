import { defineConfig } from "@playwright/test";

// E2E_PROD=1 : teste la version de production (npm run build d'abord), port 3100 ; sinon serveur de développement
const prod = Boolean(process.env.E2E_PROD);
const port = prod ? 3100 : 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: {
      // CHROMIUM_PATH : navigateur déjà installé (environnements sans téléchargement)
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // Rendu WebGL logiciel pour les machines sans GPU (CI, conteneurs)
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: prod ? `npx next start -p ${port}` : "npm run dev",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    // En production Auth.js exige l'URL publique de l'application
    env: prod ? { AUTH_URL: `http://localhost:${port}` } : {},
  },
});
