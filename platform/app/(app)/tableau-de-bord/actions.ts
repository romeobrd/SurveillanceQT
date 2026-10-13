"use server";

import { revalidatePath } from "next/cache";
import { guarded, type ActionState } from "@/lib/actions";

/** Signature d'action de formulaire : l'état précédent et les champs ne servent pas. */
export async function dismissOnboardingAction(): Promise<ActionState> {
  const result = await guarded("org:settings", (repos) =>
    repos.dashboard.dismissOnboarding(),
  );
  if (!result.error) revalidatePath("/tableau-de-bord");
  return result;
}
