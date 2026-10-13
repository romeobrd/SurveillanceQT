"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  formObject,
  guarded,
  guardedValue,
  type ActionState,
} from "@/lib/actions";

const IdSchema = z.string().min(1).max(64);

export type PasswordActionState = ActionState & {
  temporaryPassword?: string;
  email?: string;
};

export async function createAccountAction(
  _previous: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const result = await guardedValue("users:manage", (repos) =>
    repos.accounts.create(formObject(formData)),
  );
  if (result.error || !result.value) return { error: result.error };
  revalidatePath("/administration/comptes");
  return {
    error: null,
    temporaryPassword: result.value.temporaryPassword,
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  };
}

export async function resetPasswordAction(
  _previous: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const result = await guardedValue("users:manage", (repos) =>
    repos.accounts.resetPassword(IdSchema.parse(formData.get("id"))),
  );
  if (result.error || !result.value) return { error: result.error };
  revalidatePath("/administration/comptes");
  return {
    error: null,
    temporaryPassword: result.value.temporaryPassword,
    email: String(formData.get("email") ?? ""),
  };
}

export async function setRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("users:manage", (repos) =>
    repos.accounts.setRole(
      IdSchema.parse(formData.get("id")),
      formData.get("role"),
    ),
  );
  if (!result.error) revalidatePath("/administration/comptes");
  return result;
}

export async function setDisabledAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("users:manage", (repos) =>
    repos.accounts.setDisabled(
      IdSchema.parse(formData.get("id")),
      formData.get("disabled") === "true",
    ),
  );
  if (!result.error) revalidatePath("/administration/comptes");
  return result;
}
