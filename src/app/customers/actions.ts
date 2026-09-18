"use server";

import { revalidatePath } from "next/cache";

import type { CustomerFormState } from "@/lib/customer";
import { executeCustomerSave } from "@/lib/customer-action.server";

export async function saveCustomerAction(
  previousState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const result = await executeCustomerSave(previousState, formData);

  if (result.status === "success" && result.customerId) {
    revalidatePath("/customers");
    revalidatePath(`/customers/${result.customerId}`);
  }

  return result;
}
