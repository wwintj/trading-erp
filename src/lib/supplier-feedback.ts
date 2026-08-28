import { toast } from "sonner";

import type { SupplierFormState } from "@/lib/supplier";

type SupplierNotification = {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

export function notifySupplierSave(
  state: SupplierFormState,
  notification: SupplierNotification = toast,
) {
  if (state.status === "success") {
    notification.success(state.message);
  } else if (state.status === "error") {
    notification.error(state.message);
  }
}
