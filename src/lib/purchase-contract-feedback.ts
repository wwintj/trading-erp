import { toast } from "sonner";

import type { PurchaseContractFormState } from "@/lib/purchase-contract";

type ContractNotification = {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

export function notifyPurchaseContract(
  state: PurchaseContractFormState,
  notification: ContractNotification = toast,
) {
  if (state.status === "success") {
    notification.success(state.message);
  } else if (state.status === "error") {
    notification.error(state.message);
  }
}
