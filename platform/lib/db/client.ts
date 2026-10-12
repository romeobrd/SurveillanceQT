// Client Prisma brut. Réservé à lib/db : tout le reste du code passe par la couche multi-tenant.
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as { rawPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL n'est pas définie");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const rawPrisma = globalForPrisma.rawPrisma ?? createClient();
if (process.env.NODE_ENV !== "production")
  globalForPrisma.rawPrisma = rawPrisma;
