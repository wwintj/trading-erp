import { describe, expect, it, vi } from "vitest";
import { notifySalesDeliveryNote } from "@/lib/sales-delivery-note-feedback";
import { requestDeliveryStatusChange, SALES_DELIVERY_NOTE_CONFIRMATIONS } from "@/components/sales-delivery-note/sales-delivery-note-status-actions";

describe("Delivery feedback and explicit status confirmation", () => {
  it.each(["success", "error", "idle"] as const)("handles %s via the shared Toast adapter", (status) => {
    const notification = { success: vi.fn(), error: vi.fn() };
    notifySalesDeliveryNote({ status, message: "中文消息" }, notification);
    if (status === "idle") {
      expect(notification.success).not.toHaveBeenCalled(); expect(notification.error).not.toHaveBeenCalled();
    } else expect(notification[status]).toHaveBeenCalledWith("中文消息");
  });
  it("uses explicit Chinese confirmations", () => {
    expect(SALES_DELIVERY_NOTE_CONFIRMATIONS).toEqual({
      finalize: "确认将销售送货单定稿？定稿后送货单内容不可修改。",
      reopen: "确认重新打开该销售送货单？重新打开后送货单将恢复为草稿状态并可继续修改。",
      cancel: "确认作废销售送货单？作废后不可恢复。",
    });
  });
  it.each(["finalize", "reopen", "cancel"] as const)("cancelled %s confirmation sends no mutation", async (operation) => {
    const deps = { confirm: vi.fn().mockReturnValue(false), finalize: vi.fn(), reopen: vi.fn(), cancel: vi.fn(), notify: vi.fn(), refresh: vi.fn() };
    await requestDeliveryStatusChange("note-1", operation, deps);
    expect(deps.confirm).toHaveBeenCalledWith(SALES_DELIVERY_NOTE_CONFIRMATIONS[operation]);
    expect(deps[operation]).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.refresh).not.toHaveBeenCalled();
  });
  it.each(["success", "error"] as const)("notifies %s and refreshes only after success", async (status) => {
    const result = { status, message: "销售送货单已定稿。" };
    const deps = { confirm: vi.fn().mockReturnValue(true), finalize: vi.fn().mockResolvedValue(result), reopen: vi.fn(), cancel: vi.fn(), notify: vi.fn(), refresh: vi.fn() };
    await requestDeliveryStatusChange("note-1", "finalize", deps);
    expect(deps.notify).toHaveBeenCalledWith(result);
    expect(deps.refresh).toHaveBeenCalledTimes(status === "success" ? 1 : 0);
  });
});
