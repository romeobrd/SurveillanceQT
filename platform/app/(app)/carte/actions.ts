"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guarded, guardedValue, type ActionState } from "@/lib/actions";
import { fr } from "@/lib/i18n/fr";
import { generateLayout } from "@/lib/map/generator";
import type { LayoutImpact } from "@/lib/map/edit/plan";
import type { Layout } from "@/lib/map/schema";

const SeedSchema = z.coerce.number().int().min(0).max(4_294_967_295);
const IdSchema = z.string().min(1).max(100);
const BaseVersionSchema = z.number().int().min(0).nullable();

async function saveGenerated(seed: number): Promise<ActionState> {
  // Génération par seed : la carte est recalculée côté serveur, jamais envoyée par le navigateur
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

export interface ImpactResult {
  error: string | null;
  impact?: LayoutImpact;
}

/** Ce que l'enregistrement de cette carte supprimerait (postes attribués, stock et matériel rangés). */
export async function previewLayoutImpactAction(
  layout: unknown,
): Promise<ImpactResult> {
  const result = await guardedValue("layout:write", (repos) =>
    repos.layouts.previewImpact(layout),
  );
  return { error: result.error, impact: result.value };
}

/** Enregistre l'aménagement édité. La carte et le plan sont revalidés intégralement côté serveur. */
export async function saveEditedLayoutAction(
  layout: unknown,
  plan: unknown,
  baseVersion: unknown,
): Promise<ActionState> {
  const base = BaseVersionSchema.safeParse(baseVersion);
  if (!base.success) return { error: fr.errors.invalid };
  const result = await guarded("layout:write", async (repos) => {
    await repos.layouts.saveNewVersion(layout, {
      plan,
      baseVersion: base.data,
    });
  });
  if (!result.error) revalidatePath("/carte");
  return result;
}

export interface VersionResult {
  error: string | null;
  layout?: Layout;
  version?: number;
}

/** Contenu d'une version, pour l'ouvrir dans l'éditeur sans rien modifier. */
export async function loadVersionAction(
  versionId: unknown,
): Promise<VersionResult> {
  const id = IdSchema.safeParse(versionId);
  if (!id.success) return { error: fr.errors.invalid };
  const result = await guardedValue("layout:write", async (repos) => {
    const version = await repos.layouts.getVersion(id.data);
    if (!version) throw new (await import("@/lib/db")).NotFoundError("Version");
    return version;
  });
  return {
    error: result.error,
    layout: result.value?.layout,
    version: result.value?.version,
  };
}

export async function previewRestoreAction(
  versionId: unknown,
): Promise<ImpactResult> {
  const id = IdSchema.safeParse(versionId);
  if (!id.success) return { error: fr.errors.invalid };
  const result = await guardedValue("layout:write", (repos) =>
    repos.layouts.previewRestore(id.data),
  );
  return { error: result.error, impact: result.value };
}

/** Restaure une version : crée une nouvelle version identique, rien n'est effacé de l'historique. */
export async function restoreVersionAction(
  versionId: unknown,
  plan: unknown,
): Promise<ActionState> {
  const id = IdSchema.safeParse(versionId);
  if (!id.success) return { error: fr.errors.invalid };
  const result = await guarded("layout:write", async (repos) => {
    await repos.layouts.restoreVersion(id.data, { plan });
  });
  if (!result.error) revalidatePath("/carte");
  return result;
}
