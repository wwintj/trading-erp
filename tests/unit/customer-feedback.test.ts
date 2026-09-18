import { describe, expect, it, vi } from "vitest";

import { notifyCustomerSave } from "@/lib/customer-feedback";

describe("Customer save Toast feedback", () => {
  it("uses shared Sonner success behavior", () => {
    const notification = { success: vi.fn(), error: vi.fn() };

    notifyCustomerSave(
      { status: "success", message: "客户创建成功。" },
      notification,
    );

    expect(notification.success).toHaveBeenCalledWith("客户创建成功。");
    expect(notification.error).not.toHaveBeenCalled();
  });

  it("uses shared Sonner error behavior", () => {
    const notification = { success: vi.fn(), error: vi.fn() };

    notifyCustomerSave(
      { status: "error", message: "客户保存失败，请稍后重试。" },
      notification,
    );

    expect(notification.error).toHaveBeenCalledWith(
      "客户保存失败，请稍后重试。",
    );
    expect(notification.success).not.toHaveBeenCalled();
  });

  it("does nothing while idle", () => {
    const notification = { success: vi.fn(), error: vi.fn() };

    notifyCustomerSave({ status: "idle", message: "" }, notification);

    expect(notification.success).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });
});
