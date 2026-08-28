"use server";

import { revalidatePath } from "next/cache";

import type { SupplierFormState } from "@/lib/supplier";
import { executeSupplierSave } from "@/lib/supplier-action.server";

export async function saveSupplierAction(
  previousState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const result = await executeSupplierSave(previousState, formData);

  if (result.status === "success" && result.supplierId) {
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${result.supplierId}`);
  }

  return result;
}
