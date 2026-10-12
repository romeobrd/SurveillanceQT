import { DEV_ORGANIZATIONS } from "@/lib/db/seed";
import {
  resetDatabase,
  seedFullOrganization,
  type FullFixture,
} from "@/lib/db/testing";

/** Deux entreprises complètes (une ligne dans chaque table), base remise à zéro. */
export async function prepareTwoOrganizations(): Promise<{
  a: FullFixture;
  b: FullFixture;
}> {
  await resetDatabase();
  const a = await seedFullOrganization(DEV_ORGANIZATIONS[0]);
  const b = await seedFullOrganization(DEV_ORGANIZATIONS[1]);
  return { a, b };
}
