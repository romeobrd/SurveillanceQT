"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AssetInputSchema } from "@/features/assets/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

const IdSchema = z.string().min(1);

export async function createAssetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id = "";
  const result = await guarded("asset:write", async (repos) => {
    id = (
      await repos.assets.create(AssetInputSchema.parse(formObject(formData)))
    ).id;
  });
  if (result.error) return result;
  revalidatePath("/materiel");
  redirect(`/materiel/${id}`);
}

export async function updateAssetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await guarded("asset:write", async (repos) => {
    await repos.assets.update(
      IdSchema.parse(id),
      AssetInputSchema.parse(formObject(formData)),
    );
  });
  if (!result.error) {
    revalidatePath("/materiel");
    revalidatePath(`/materiel/${id}`);
  }
  return result;
}

export async function setAssetStateAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await guarded("asset:write", async (repos) => {
    await repos.assets.setState(
      IdSchema.parse(id),
      AssetInputSchema.shape.state.parse(formData.get("state")),
    );
  });
  if (!result.error) {
    revalidatePath("/materiel");
    revalidatePath(`/materiel/${id}`);
    revalidatePath("/tableau-de-bord");
  }
  return result;
}

export async function deleteAssetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("asset:write", async (repos) => {
    await repos.assets.delete(IdSchema.parse(formData.get("id")));
  });
  if (result.error) return result;
  revalidatePath("/materiel");
  redirect("/materiel");
}
