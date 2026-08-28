"use server";

import { revalidatePath } from "next/cache";

import type { ProductFormState } from "@/lib/product";
import { executeProductSave } from "@/lib/product-action.server";

export async function saveProductAction(
  previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const result = await executeProductSave(previousState, formData);

  if (result.status === "success" && result.productId) {
    revalidatePath("/products");
    revalidatePath(`/products/${result.productId}`);
  }

  return result;
}
