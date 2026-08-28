import { toast } from "sonner";

import type { ProductFormState } from "@/lib/product";

type ProductNotification = {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

export function notifyProductSave(
  state: ProductFormState,
  notification: ProductNotification = toast,
) {
  if (state.status === "success") {
    notification.success(state.message);
  } else if (state.status === "error") {
    notification.error(state.message);
  }
}
