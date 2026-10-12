"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PersonInputSchema, TeamNameSchema } from "@/features/people/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

const IdSchema = z.string().min(1);

export async function createPersonAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("people:write", async (repos) => {
    await repos.people.create(PersonInputSchema.parse(formObject(formData)));
  });
  if (result.error) return result;
  revalidatePath("/collaborateurs");
  redirect("/collaborateurs");
}

export async function updatePersonAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("people:write", async (repos) => {
    await repos.people.update(
      IdSchema.parse(formData.get("id")),
      PersonInputSchema.parse(formObject(formData)),
    );
  });
  if (result.error) return result;
  revalidatePath("/collaborateurs");
  redirect("/collaborateurs");
}

export async function departPersonAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("people:write", async (repos) => {
    await repos.people.markDeparted(IdSchema.parse(formData.get("id")));
  });
  if (result.error) return result;
  revalidatePath("/collaborateurs");
  revalidatePath("/postes");
  revalidatePath("/materiel");
  redirect("/collaborateurs");
}

export async function createTeamAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("people:write", async (repos) => {
    await repos.teams.create(TeamNameSchema.parse(formData.get("name")));
  });
  if (!result.error) revalidatePath("/collaborateurs/equipes");
  return result;
}

export async function renameTeamAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("people:write", async (repos) => {
    await repos.teams.rename(
      IdSchema.parse(formData.get("id")),
      TeamNameSchema.parse(formData.get("name")),
    );
  });
  if (!result.error) revalidatePath("/collaborateurs/equipes");
  return result;
}

export async function deleteTeamAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("people:write", async (repos) => {
    await repos.teams.delete(IdSchema.parse(formData.get("id")));
  });
  if (!result.error) revalidatePath("/collaborateurs/equipes");
  return result;
}
