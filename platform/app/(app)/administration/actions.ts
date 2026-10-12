"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RequestStatusSchema } from "@/features/privacy/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

const IdSchema = z.string().min(1);

export async function updateSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("org:settings", async (repos) => {
    await repos.settings.update(formObject(formData));
  });
  if (!result.error) {
    revalidatePath("/administration");
    revalidatePath("/tableau-de-bord");
  }
  return result;
}

export async function updateRequestStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("privacy:manageRequests", async (repos) => {
    await repos.privacy.updateRequestStatus(
      IdSchema.parse(formData.get("id")),
      RequestStatusSchema.parse(formData.get("status")),
    );
  });
  if (!result.error) revalidatePath("/administration/demandes");
  return result;
}

export async function executeErasureAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("privacy:manageRequests", async (repos) => {
    await repos.privacy.executeErasure(IdSchema.parse(formData.get("id")));
  });
  if (!result.error) {
    revalidatePath("/administration/demandes");
    revalidatePath("/collaborateurs");
  }
  return result;
}
