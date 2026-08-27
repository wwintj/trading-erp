"use server";

import { revalidatePath } from "next/cache";

import { executeCompanySave } from "@/lib/company-action.server";
import type { CompanyFormState } from "@/lib/company";

export async function saveCompanyAction(
  previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const result = await executeCompanySave(previousState, formData);

  if (result.status === "success") {
    revalidatePath("/company");
  }

  return result;
}
