// Client Prisma brut. Réservé à lib/db : tout le reste du code passe par la couche multi-tenant.
import "server-only";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgConnection } from "./connection";
import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as { rawPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL n'est pas définie");
  // Base en ligne : chiffrement demandé dans l'adresse (?sslmode=require) et, si l'hébergeur fournit
  // sa propre autorité de certification, son fichier dans DATABASE_SSL_CA
  const caFile = process.env.DATABASE_SSL_CA;
  const connection = pgConnection(
    url,
    caFile ? readFileSync(caFile, "utf8") : undefined,
  );
  return new PrismaClient({ adapter: new PrismaPg(connection) });
}

export const rawPrisma = globalForPrisma.rawPrisma ?? createClient();
if (process.env.NODE_ENV !== "production")
  globalForPrisma.rawPrisma = rawPrisma;
