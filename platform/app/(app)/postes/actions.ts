"use server";

import { revalidatePath } from "next/cache";
import { WorkstationAssignmentSchema } from "@/features/people/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

export async function assignWorkstationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("workstation:assign", async (repos) => {
    await repos.workstations.assign(
      WorkstationAssignmentSchema.parse(formObject(formData)),
    );
  });
  if (!result.error) {
    revalidatePath("/postes");
    revalidatePath("/carte");
  }
  return result;
}
