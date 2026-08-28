import { describe, expect, it, vi } from "vitest";

import {
  PRODUCT_DUPLICATE_CODE_MESSAGE,
  PRODUCT_GENERIC_ERROR_MESSAGE,
} from "@/lib/product";
import { notifyProductSave } from "@/lib/product-feedback";

describe("Product save Toast feedback", () => {
  it("uses the shared Sonner behavior for success", () => {
    const notification = { success: vi.fn(), error: vi.fn() };

    notifyProductSave(
      { status: "success", message: "产品创建成功。" },
      notification,
    );

    expect(notification.success).toHaveBeenCalledWith("产品创建成功。");
    expect(notification.error).not.toHaveBeenCalled();
  });

  it.each([PRODUCT_DUPLICATE_CODE_MESSAGE, PRODUCT_GENERIC_ERROR_MESSAGE])(
    "uses the shared Sonner behavior for error: %s",
    (message) => {
      const notification = { success: vi.fn(), error: vi.fn() };

      notifyProductSave({ status: "error", message }, notification);

      expect(notification.error).toHaveBeenCalledWith(message);
      expect(notification.success).not.toHaveBeenCalled();
    },
  );
});
