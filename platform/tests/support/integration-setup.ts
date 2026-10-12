// Prépare la base de test : applique les migrations (jamais sur la base de développement).
import { execSync } from "node:child_process";
import "dotenv/config";

export default function setup(): void {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST n'est pas définie : les tests d'intégration exigent une base PostgreSQL dédiée aux tests.",
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL_TEST doit être différente de DATABASE_URL (la base de test est vidée).",
    );
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
