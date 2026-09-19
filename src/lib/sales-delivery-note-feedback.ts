import { toast } from "sonner";
import type { SalesDeliveryNoteFormState } from "@/lib/sales-delivery-note";

export function notifySalesDeliveryNote(
  state: SalesDeliveryNoteFormState,
  notification: { success: (message: string) => unknown; error: (message: string) => unknown } = toast,
) {
  if (state.status === "success") notification.success(state.message);
  else if (state.status === "error") notification.error(state.message);
}
