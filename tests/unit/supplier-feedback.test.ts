import { describe, expect, it, vi } from "vitest";

import {
  SUPPLIER_DUPLICATE_CODE_MESSAGE,
  SUPPLIER_GENERIC_ERROR_MESSAGE,
} from "@/lib/supplier";
import { notifySupplierSave } from "@/lib/supplier-feedback";

describe("Supplier save Toast feedback", () => {
  it("uses the shared Sonner behavior for success", () => {
    const notification = { success: vi.fn(), error: vi.fn() };

    notifySupplierSave(
      { status: "success", message: "Supplier created successfully." },
      notification,
    );

    expect(notification.success).toHaveBeenCalledWith(
      "Supplier created successfully.",
    );
    expect(notification.error).not.toHaveBeenCalled();
  });

  it.each([SUPPLIER_DUPLICATE_CODE_MESSAGE, SUPPLIER_GENERIC_ERROR_MESSAGE])(
    "uses the shared Sonner behavior for error: %s",
    (message) => {
      const notification = { success: vi.fn(), error: vi.fn() };

      notifySupplierSave({ status: "error", message }, notification);

      expect(notification.error).toHaveBeenCalledWith(message);
      expect(notification.success).not.toHaveBeenCalled();
    },
  );
});
