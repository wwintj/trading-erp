import { toast } from "sonner";

import type { CompanyFormState } from "@/lib/company";

export type CompanyNotification = {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

export function notifyCompanySave(
  state: CompanyFormState,
  notification: CompanyNotification = toast,
) {
  if (state.status === "success") {
    notification.success(state.message);
  } else if (state.status === "error") {
    notification.error(state.message);
  }
}
