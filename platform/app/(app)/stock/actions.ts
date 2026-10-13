"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  MovementInputSchema,
  StockItemInputSchema,
} from "@/features/stock/schemas";
import { formObject, guarded, type ActionState } from "@/lib/actions";

const IdSchema = z.string().min(1);

export async function createStockItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id = "";
  const result = await guarded("stock:write", async (repos) => {
    id = (
      await repos.stock.createItem(
        StockItemInputSchema.parse(formObject(formData)),
      )
    ).id;
  });
  if (result.error) return result;
  revalidatePath("/stock");
  redirect(`/stock/${id}`);
}

export async function updateStockItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await guarded("stock:write", async (repos) => {
    await repos.stock.updateItem(
      IdSchema.parse(id),
      StockItemInputSchema.parse(formObject(formData)),
    );
  });
  if (result.error) return result;
  revalidatePath("/stock");
  redirect(`/stock/${id}`);
}

export async function deleteStockItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await guarded("stock:write", async (repos) => {
    await repos.stock.deleteItem(IdSchema.parse(formData.get("id")));
  });
  if (result.error) return result;
  revalidatePath("/stock");
  redirect("/stock");
}

export async function addMovementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const data = formObject(formData);
  const result = await guarded("stock:write", async (repos) => {
    await repos.stock.addMovement(MovementInputSchema.parse(data));
  });
  if (!result.error) {
    revalidatePath("/stock");
    revalidatePath(`/stock/${String(data.stockItemId)}`);
    revalidatePath("/tableau-de-bord");
  }
  return result;
}
