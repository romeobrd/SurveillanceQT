"use server";

import { redirect } from "next/navigation";
import {
  actionErrorMessage,
  formObject,
  type ActionState,
} from "@/lib/actions";
import { assertPermission } from "@/lib/auth/permissions";
import { requireSessionAllowingPasswordChange } from "@/lib/auth/session";
import { getRepositories } from "@/lib/db";

/** Changement de son propre mot de passe : accessible même avec un mot de passe provisoire. */
export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSessionAllowingPasswordChange();
    assertPermission(session, "account:self");
    await getRepositories(session).accounts.changeOwnPassword(
      formObject(formData),
    );
  } catch (error) {
    const message = actionErrorMessage(error);
    if (message === null) throw error;
    return { error: message };
  }
  redirect("/mon-compte?ok=1");
}
