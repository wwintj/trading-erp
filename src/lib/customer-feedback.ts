import { toast } from "sonner";

import type { CustomerFormState } from "@/lib/customer";

type CustomerNotification = {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

export function notifyCustomerSave(
  state: CustomerFormState,
  notification: CustomerNotification = toast,
) {
  if (state.status === "success") {
    notification.success(state.message);
  } else if (state.status === "error") {
    notification.error(state.message);
  }
}
