"use server";

import { revalidatePath } from "next/cache";
import {
  PresenceInputSchema,
  PrivacyRequestInputSchema,
} from "@/features/privacy/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

export async function createPrivacyRequestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("privacy:self", async (repos) => {
    await repos.privacy.createRequest(
      PrivacyRequestInputSchema.parse(formObject(formData)),
    );
  });
  if (!result.error) revalidatePath("/mes-donnees");
  return result;
}

export async function setPresenceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("presence:declare", async (repos) => {
    await repos.presence.setMine(
      PresenceInputSchema.parse(formData.get("status")),
    );
  });
  if (!result.error) {
    revalidatePath("/mes-donnees");
    revalidatePath("/tableau-de-bord");
  }
  return result;
}

export async function clearPresenceAction(): Promise<ActionState> {
  const result = await guarded("presence:declare", async (repos) => {
    await repos.presence.clearMine();
  });
  if (!result.error) {
    revalidatePath("/mes-donnees");
    revalidatePath("/tableau-de-bord");
  }
  return result;
}
