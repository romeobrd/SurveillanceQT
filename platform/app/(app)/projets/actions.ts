"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ProjectInputSchema,
  StepNameSchema,
  StepStatusSchema,
} from "@/features/projects/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

const IdSchema = z.string().min(1);

function refresh(projectId?: string) {
  revalidatePath("/projets");
  if (projectId) revalidatePath(`/projets/${projectId}`);
  revalidatePath("/tableau-de-bord");
  revalidatePath("/carte");
}

export async function createProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id = "";
  const result = await guarded("project:write", async (repos) => {
    id = (
      await repos.projects.create(
        ProjectInputSchema.parse(formObject(formData)),
      )
    ).id;
  });
  if (result.error) return result;
  refresh();
  redirect(`/projets/${id}`);
}

export async function updateProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await guarded("project:write", async (repos) => {
    await repos.projects.update(
      IdSchema.parse(id),
      ProjectInputSchema.parse(formObject(formData)),
    );
  });
  if (!result.error) refresh(id);
  return result;
}

export async function deleteProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("project:write", async (repos) => {
    await repos.projects.delete(IdSchema.parse(formData.get("id")));
  });
  if (result.error) return result;
  refresh();
  redirect("/projets");
}

export async function addStepAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const result = await guarded("project:write", async (repos) => {
    await repos.projects.addStep(
      IdSchema.parse(projectId),
      StepNameSchema.parse(formData.get("name")),
    );
  });
  if (!result.error) refresh(projectId);
  return result;
}

export async function setStepStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const result = await guarded("project:write", async (repos) => {
    await repos.projects.setStepStatus(
      IdSchema.parse(formData.get("stepId")),
      StepStatusSchema.parse(formData.get("status")),
    );
  });
  if (!result.error) refresh(projectId);
  return result;
}

export async function moveStepAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const result = await guarded("project:write", async (repos) => {
    await repos.projects.moveStep(
      IdSchema.parse(formData.get("stepId")),
      z.enum(["up", "down"]).parse(formData.get("direction")),
    );
  });
  if (!result.error) refresh(projectId);
  return result;
}

export async function deleteStepAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const result = await guarded("project:write", async (repos) => {
    await repos.projects.deleteStep(IdSchema.parse(formData.get("stepId")));
  });
  if (!result.error) refresh(projectId);
  return result;
}
