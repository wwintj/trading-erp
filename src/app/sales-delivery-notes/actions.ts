"use server";
import { revalidatePath } from "next/cache";
import type { SalesDeliveryNoteFormState } from "@/lib/sales-delivery-note";
import { executeSalesDeliveryNoteSave, executeSalesDeliveryNoteStatusChange } from "@/lib/sales-delivery-note-action.server";

function revalidate(result: SalesDeliveryNoteFormState) {
  if (result.status === "success" && result.noteId) {
    revalidatePath("/sales-delivery-notes");
    revalidatePath(`/sales-delivery-notes/${result.noteId}`);
  }
  return result;
}
export async function saveSalesDeliveryNoteAction(previous: SalesDeliveryNoteFormState, form: FormData) {
  return revalidate(await executeSalesDeliveryNoteSave(previous, form));
}
export async function finalizeSalesDeliveryNoteAction(id: string) {
  return revalidate(await executeSalesDeliveryNoteStatusChange(id, "finalize"));
}
export async function reopenSalesDeliveryNoteAction(id: string) {
  return revalidate(await executeSalesDeliveryNoteStatusChange(id, "reopen"));
}
export async function cancelSalesDeliveryNoteAction(id: string) {
  return revalidate(await executeSalesDeliveryNoteStatusChange(id, "cancel"));
}
