"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guarded, type ActionState } from "@/lib/actions";
import { fr } from "@/lib/i18n/fr";
import { generateLayout } from "@/lib/map/generator";

const SeedSchema = z.coerce.number().int().min(0).max(4_294_967_295);

async function saveGenerated(seed: number): Promise<ActionState> {
  // La carte est toujours régénérée côté serveur à partir du seed : jamais de carte envoyée par le navigateur
  const result = await guarded("layout:write", async (repos) => {
    await repos.layouts.saveNewVersion(generateLayout(seed));
  });
  if (result.error) return result;
  revalidatePath("/carte");
  redirect("/carte");
}

/** Enregistre comme aménagement actif l'aperçu correspondant au seed. */
export async function saveLayoutAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const seed = SeedSchema.safeParse(formData.get("seed"));
  if (!seed.success) return { error: fr.errors.invalid };
  return saveGenerated(seed.data);
}

/** Première génération des locaux d'une entreprise sans carte. */
export async function generateFirstLayoutAction(): Promise<ActionState> {
  return saveGenerated(randomInt(0, 1_000_000_000));
}
