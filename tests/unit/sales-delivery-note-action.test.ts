import { describe, expect, it, vi } from "vitest";
import {
  executeSalesDeliveryNoteSave, executeSalesDeliveryNoteStatusChange,
} from "@/lib/sales-delivery-note-action.server";
import {
  INITIAL_SALES_DELIVERY_NOTE_FORM_STATE as initial,
  SALES_DELIVERY_NOTE_SIGN_IN_MESSAGE, SALES_DELIVERY_NOTE_FORBIDDEN_MESSAGE,
  SALES_DELIVERY_NOTE_DUPLICATE_NO_MESSAGE, SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE,
} from "@/lib/sales-delivery-note";
import { SalesDeliveryNoteImmutableError, SalesDeliveryNoteNotFoundError, SalesDeliveryNoteValidationError } from "@/lib/sales-delivery-note.server";
import { deliveryForm, existingDeliveryNote } from "../helpers/sales-delivery-note";
function deps(role: string | null = "admin") {
  return {
    getSession: vi.fn().mockResolvedValue(role === null ? null : { user: { role } }),
    create: vi.fn().mockResolvedValue(existingDeliveryNote()),
    update: vi.fn().mockResolvedValue(existingDeliveryNote()),
    finalize: vi.fn(), reopen: vi.fn(), cancel: vi.fn(),
  };
}
describe("Sales Delivery Note action authorization and errors", () => {
  it.each([null, "user"])("denies %s on both create/update and every status mutation", async (role) => {
    const dependencies = deps(role);
    const denied = { status: "error", message: role === null ? SALES_DELIVERY_NOTE_SIGN_IN_MESSAGE : SALES_DELIVERY_NOTE_FORBIDDEN_MESSAGE };
    for (const form of [deliveryForm(), deliveryForm({ noteId: "note-1" })]) {
      expect(await executeSalesDeliveryNoteSave(initial, form, dependencies)).toEqual(denied);
    }
    for (const operation of ["finalize", "reopen", "cancel"] as const) {
      expect(await executeSalesDeliveryNoteStatusChange("note-1", operation, dependencies)).toEqual(denied);
      expect(dependencies[operation]).not.toHaveBeenCalled();
    }
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.update).not.toHaveBeenCalled();
  });
  it.each([["create", {}], ["update", { noteId: "note-1" }]] as const)("allows admin %s and returns canonical items", async (operation, fields) => {
    const dependencies = deps();
    const result = await executeSalesDeliveryNoteSave(initial, deliveryForm(fields), dependencies);
    expect(result).toMatchObject({
      status: "success", noteId: "note-1", message: operation === "create" ? "销售送货单创建成功。" : "销售送货单保存成功。",
      items: [{ itemId: "item-1", productId: "product-1", quantity: "6400.000", remark: "小心轻放", snapshot: { name: "旧产品快照" } }],
    });
    expect(dependencies[operation]).toHaveBeenCalledOnce();
  });
  it.each([
    ["finalize", "销售送货单已定稿。"], ["reopen", "销售送货单已重新打开为草稿。"], ["cancel", "销售送货单已作废。"],
  ] as const)("authorizes admin %s and uses Chinese feedback", async (operation, message) => {
    const dependencies = deps();
    expect(await executeSalesDeliveryNoteStatusChange("note-1", operation, dependencies)).toEqual({ status: "success", noteId: "note-1", message });
    expect(dependencies[operation]).toHaveBeenCalledWith("note-1");
  });
  it("does not persist invalid input", async () => {
    const dependencies = deps();
    expect(await executeSalesDeliveryNoteSave(initial, deliveryForm({ itemsJson: "[]" }), dependencies)).toMatchObject({
      status: "error", fieldErrors: { items: "请至少添加一条送货明细。" },
    });
    expect(dependencies.create).not.toHaveBeenCalled();
  });
  it.each([
    [{ code: "P2002", meta: { target: "internal index" } }, SALES_DELIVERY_NOTE_DUPLICATE_NO_MESSAGE],
    [new Error("SQL credential details"), SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE],
    [new SalesDeliveryNoteNotFoundError(), SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE],
  ])("maps DB error safely: %s", async (error, message) => {
    const dependencies = deps();
    dependencies.create.mockRejectedValue(error);
    expect(await executeSalesDeliveryNoteSave(initial, deliveryForm(), dependencies)).toEqual({ status: "error", message });
  });
  it("preserves visible identity errors and safe status errors", async () => {
    const dependencies = deps();
    dependencies.update.mockRejectedValue(new SalesDeliveryNoteValidationError({ "items.0.itemId": "送货明细身份无效。" }));
    expect(await executeSalesDeliveryNoteSave(initial, deliveryForm({ noteId: "note-1" }), dependencies)).toMatchObject({ status: "error", fieldErrors: { "items.0.itemId": "送货明细身份无效。" } });
    dependencies.reopen.mockRejectedValue(new SalesDeliveryNoteImmutableError());
    expect(await executeSalesDeliveryNoteStatusChange("note-1", "reopen", dependencies)).toMatchObject({ status: "error", message: "当前状态的销售送货单不允许此操作。" });
  });
});
