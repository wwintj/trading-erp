"use server";

import { revalidatePath } from "next/cache";

import type { PurchaseContractFormState } from "@/lib/purchase-contract";
import {
  executePurchaseContractSave,
  executePurchaseContractStatusChange,
} from "@/lib/purchase-contract-action.server";

export async function savePurchaseContractAction(
  previousState: PurchaseContractFormState,
  formData: FormData,
) {
  const result = await executePurchaseContractSave(previousState, formData);
  if (result.status === "success" && result.contractId) {
    revalidatePath("/purchase-contracts");
    revalidatePath(`/purchase-contracts/${result.contractId}`);
  }
  return result;
}

export async function finalizePurchaseContractAction(contractId: string) {
  const result = await executePurchaseContractStatusChange(contractId, "finalize");
  if (result.status === "success") {
    revalidatePath("/purchase-contracts");
    revalidatePath(`/purchase-contracts/${contractId}`);
  }
  return result;
}

export async function reopenPurchaseContractAction(contractId: string) {
  const result = await executePurchaseContractStatusChange(contractId, "reopen");
  if (result.status === "success") {
    revalidatePath("/purchase-contracts");
    revalidatePath(`/purchase-contracts/${contractId}`);
  }
  return result;
}

export async function cancelPurchaseContractAction(contractId: string) {
  const result = await executePurchaseContractStatusChange(contractId, "cancel");
  if (result.status === "success") {
    revalidatePath("/purchase-contracts");
    revalidatePath(`/purchase-contracts/${contractId}`);
  }
  return result;
}
