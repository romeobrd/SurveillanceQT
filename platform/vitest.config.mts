import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname),
  // Hors serveur Next, le garde-fou "server-only" n'a pas de sens : module vide
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "tests/unit/**/*.test.ts",
            "lib/**/*.test.ts",
            "features/**/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/support/integration-setup.ts"],
          // Base de test dédiée, jamais la base de développement
          env: { DATABASE_URL: process.env.DATABASE_URL_TEST ?? "" },
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
