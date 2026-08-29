import { describe, expect, it, vi } from "vitest";

import { notifyPurchaseContract } from "@/lib/purchase-contract-feedback";

describe("Purchase Contract Sonner feedback", () => {
  it.each([
    ["success", "采购合同创建成功。"],
    ["success", "采购合同已重新打开为草稿。"],
    ["success", "供应商资料已更新，并已保存当前草稿。"],
    ["error", "合同编号已存在。"],
  ] as const)("maps %s feedback to the shared Sonner interface", (status, message) => {
    const notification = { success: vi.fn(), error: vi.fn() };

    notifyPurchaseContract({ status, message }, notification);

    expect(notification[status]).toHaveBeenCalledWith(message);
  });
});
