import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const tx = {
    company: { findUnique: vi.fn() }, customer: { findUnique: vi.fn() }, product: { findMany: vi.fn() },
    salesDeliveryNote: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    salesDeliveryNoteItem: { deleteMany: vi.fn() },
  };
  return {
    tx, transaction: vi.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)),
    notes: vi.fn(), companyOptions: vi.fn(), customerOptions: vi.fn(), productOptions: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction, salesDeliveryNote: { findMany: mocks.notes },
    company: { findMany: mocks.companyOptions }, customer: { findMany: mocks.customerOptions }, product: { findMany: mocks.productOptions },
  },
}));
import {
  createSalesDeliveryNote, updateSalesDeliveryNote, finalizeSalesDeliveryNote, reopenSalesDeliveryNote, cancelSalesDeliveryNote,
  listSalesDeliveryNotes, suggestSalesDeliveryNoteNumber, getSalesDeliveryNoteFormOptions,
  SalesDeliveryNoteImmutableError, SalesDeliveryNoteValidationError, SalesDeliveryNoteNotFoundError,
} from "@/lib/sales-delivery-note.server";
import { deliveryInput, deliveryOptions, existingDeliveryNote } from "../helpers/sales-delivery-note";
import { synchronizeDeliveryRows } from "@/components/sales-delivery-note/sales-delivery-note-form";
import { executeSalesDeliveryNoteSave } from "@/lib/sales-delivery-note-action.server";
import { INITIAL_SALES_DELIVERY_NOTE_FORM_STATE } from "@/lib/sales-delivery-note";
import { deliveryForm } from "../helpers/sales-delivery-note";

const updateInput = () => ({ ...deliveryInput, items: [{ ...deliveryInput.items[0], itemId: "item-1" }] });
describe("Sales Delivery Note transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.company.findUnique.mockResolvedValue(deliveryOptions.companies[0]);
    mocks.tx.customer.findUnique.mockResolvedValue(deliveryOptions.customers[0]);
    mocks.tx.product.findMany.mockResolvedValue(deliveryOptions.products);
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue(existingDeliveryNote());
    mocks.tx.salesDeliveryNote.create.mockResolvedValue(existingDeliveryNote());
    mocks.tx.salesDeliveryNote.update.mockResolvedValue(existingDeliveryNote());
  });
  it("creates server-owned snapshots and exact quantities atomically", async () => {
    await createSalesDeliveryNote(deliveryInput);
    const data = mocks.tx.salesDeliveryNote.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      senderLegalName: "新发货公司", senderContactName: "新联系人", senderPhone: "10000", senderAddress: "新地址",
      customerLegalName: "新客户名称", deliveryContactName: "李经理", deliveryAddress: "上海临时仓库",
      items: { create: [{ productCode: "WS-H42", productName: "PVC热收缩套管", unit: "米" }] },
    });
    expect(data.items.create[0].quantity.toFixed(3)).toBe("6400.000");
    expect(data.items.create[0]).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("totalAmount");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
  it("preserves all snapshots with unchanged IDs, even when masters have changed", async () => {
    await updateSalesDeliveryNote("note-1", updateInput());
    const data = mocks.tx.salesDeliveryNote.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      senderLegalName: "旧发货公司", senderContactName: "旧联系人", senderPhone: "旧电话", senderAddress: "旧地址",
      customerLegalName: "旧客户名称",
      items: { create: [{ id: "item-1", productCode: "OLD-H42", productName: "旧产品快照", specification: "旧规格", unit: "米" }] },
    });
  });
  it("refreshes sender only when company changes", async () => {
    mocks.tx.company.findUnique.mockResolvedValue({ ...deliveryOptions.companies[0], id: "company-2" });
    await updateSalesDeliveryNote("note-1", { ...updateInput(), companyId: "company-2" });
    expect(mocks.tx.salesDeliveryNote.update.mock.calls[0][0].data).toMatchObject({ senderLegalName: "新发货公司", customerLegalName: "旧客户名称" });
  });
  it("refreshes customer name only on selection change, leaving actual delivery fields as submitted", async () => {
    mocks.tx.customer.findUnique.mockResolvedValue({ ...deliveryOptions.customers[0], id: "customer-2" });
    await updateSalesDeliveryNote("note-1", { ...updateInput(), customerId: "customer-2" });
    expect(mocks.tx.salesDeliveryNote.update.mock.calls[0][0].data).toMatchObject({
      customerLegalName: "新客户名称", senderLegalName: "旧发货公司", deliveryContactName: "李经理", deliveryAddress: "上海临时仓库",
    });
  });
  it("keeps row ID when replacing Product and imports the new snapshot", async () => {
    mocks.tx.product.findMany.mockResolvedValue([{ ...deliveryOptions.products[0], id: "product-2", name: "替换产品" }]);
    await updateSalesDeliveryNote("note-1", { ...deliveryInput, items: [{ itemId: "item-1", productId: "product-2", quantity: "12.500", remark: null }] });
    expect(mocks.tx.salesDeliveryNote.update.mock.calls[0][0].data.items.create[0]).toMatchObject({ id: "item-1", productId: "product-2", productName: "替换产品" });
  });
  it.each(["foreign-id", "stale-id"])("rejects %s before deleting or writing", async (itemId) => {
    await expect(updateSalesDeliveryNote("note-1", { ...deliveryInput, items: [{ ...deliveryInput.items[0], itemId }] })).rejects.toMatchObject({
      fieldErrors: { "items.0.itemId": "送货明细身份无效。" },
    });
    expect(mocks.tx.salesDeliveryNoteItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.salesDeliveryNote.update).not.toHaveBeenCalled();
  });
  it("rejects duplicate item IDs in the transaction", async () => {
    await expect(updateSalesDeliveryNote("note-1", { ...deliveryInput, items: [updateInput().items[0], updateInput().items[0]] })).rejects.toBeInstanceOf(SalesDeliveryNoteValidationError);
    expect(mocks.tx.salesDeliveryNoteItem.deleteMany).not.toHaveBeenCalled();
  });
  it("does not accept an existing item identity during creation", async () => {
    await expect(createSalesDeliveryNote(updateInput())).rejects.toBeInstanceOf(SalesDeliveryNoteValidationError);
    expect(mocks.tx.salesDeliveryNote.create).not.toHaveBeenCalled();
  });
  it.each(["company", "customer", "product"] as const)("rejects missing %s without partial writes", async (master) => {
    if (master === "product") mocks.tx.product.findMany.mockResolvedValue([]);
    else mocks.tx[master].findUnique.mockResolvedValue(null);
    await expect(updateSalesDeliveryNote("note-1", updateInput())).rejects.toBeInstanceOf(SalesDeliveryNoteValidationError);
    expect(mocks.tx.salesDeliveryNoteItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.salesDeliveryNote.update).not.toHaveBeenCalled();
  });
  it.each(["FINAL", "CANCELLED"] as const)("rejects ordinary update of %s", async (status) => {
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue(existingDeliveryNote(status));
    await expect(updateSalesDeliveryNote("note-1", updateInput())).rejects.toBeInstanceOf(SalesDeliveryNoteImmutableError);
    expect(mocks.tx.salesDeliveryNoteItem.deleteMany).not.toHaveBeenCalled();
  });
  it("rejects missing note", async () => {
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue(null);
    await expect(updateSalesDeliveryNote("missing", updateInput())).rejects.toBeInstanceOf(SalesDeliveryNoteNotFoundError);
  });
  it("reorders and removes rows only within the atomic save", async () => {
    const note = existingDeliveryNote();
    note.items.push({ ...note.items[0], id: "item-2", sortOrder: 1 });
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue(note);
    await updateSalesDeliveryNote("note-1", { ...deliveryInput, items: [{ ...deliveryInput.items[0], itemId: "item-2" }] });
    expect(mocks.tx.salesDeliveryNoteItem.deleteMany).toHaveBeenCalledWith({ where: { salesDeliveryNoteId: "note-1" } });
    const recreated = mocks.tx.salesDeliveryNote.update.mock.calls[0][0].data.items.create;
    expect(recreated).toHaveLength(1);
    expect(recreated[0]).toMatchObject({ id: "item-2", sortOrder: 0 });
  });
  it("supports save → save → save with stable existing IDs and newly-created IDs synced to the client", async () => {
    let stored = existingDeliveryNote();
    mocks.tx.salesDeliveryNote.findUnique.mockImplementation(async () => stored);
    mocks.tx.salesDeliveryNote.update.mockImplementation(async ({ data }) => {
      stored = { ...stored, ...data, items: data.items.create.map((item: typeof stored.items[number], index: number) => ({
        ...item, id: item.id ?? `generated-${index}`, salesDeliveryNoteId: "note-1",
      })) };
      return stored;
    });
    let rows = [
      { ...updateInput().items[0], key: 0 },
      { ...deliveryInput.items[0], quantity: "0.125", key: 1 },
    ];
    for (let save = 0; save < 3; save++) {
      const form = deliveryForm({ noteId: "note-1", itemsJson: JSON.stringify(rows) });
      const result = await executeSalesDeliveryNoteSave(INITIAL_SALES_DELIVERY_NOTE_FORM_STATE, form, {
        getSession: async () => ({ user: { role: "admin" } }), create: createSalesDeliveryNote, update: updateSalesDeliveryNote,
      });
      expect(result.status).toBe("success");
      rows = synchronizeDeliveryRows(rows, result.items!, () => 99);
      expect(rows.map((row) => row.itemId)).toEqual(["item-1", "generated-1"]);
      expect(rows.map((row) => row.quantity)).toEqual(["6400.000", "0.125"]);
      expect(rows.map((row) => row.key)).toEqual([0, 1]);
    }
    expect(mocks.tx.salesDeliveryNote.update).toHaveBeenCalledTimes(3);
  });
});
describe("Sales Delivery Note statuses and queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.salesDeliveryNote.update.mockReset().mockResolvedValue(existingDeliveryNote());
  });
  it.each([
    ["DRAFT", finalizeSalesDeliveryNote, "FINAL"],
    ["FINAL", reopenSalesDeliveryNote, "DRAFT"],
    ["DRAFT", cancelSalesDeliveryNote, "CANCELLED"],
    ["FINAL", cancelSalesDeliveryNote, "CANCELLED"],
  ] as const)("allows %s → %s", async (status, operation, target) => {
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue(existingDeliveryNote(status));
    await operation("note-1");
    expect(mocks.tx.salesDeliveryNote.update).toHaveBeenCalledWith({ where: { id: "note-1" }, data: { status: target } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.tx.company.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.salesDeliveryNoteItem.deleteMany).not.toHaveBeenCalled();
  });
  it.each([
    ["CANCELLED", finalizeSalesDeliveryNote], ["CANCELLED", reopenSalesDeliveryNote],
    ["CANCELLED", cancelSalesDeliveryNote], ["DRAFT", reopenSalesDeliveryNote], ["FINAL", finalizeSalesDeliveryNote],
  ] as const)("rejects invalid status %s operation %s", async (status, operation) => {
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue(existingDeliveryNote(status));
    await expect(operation("note-1")).rejects.toBeInstanceOf(SalesDeliveryNoteImmutableError);
    expect(mocks.tx.salesDeliveryNote.update).not.toHaveBeenCalled();
  });
  it("validates persisted contents before finalization", async () => {
    mocks.tx.salesDeliveryNote.findUnique.mockResolvedValue({ ...existingDeliveryNote(), items: [] });
    await expect(finalizeSalesDeliveryNote("note-1")).rejects.toBeInstanceOf(SalesDeliveryNoteValidationError);
    expect(mocks.tx.salesDeliveryNote.update).not.toHaveBeenCalled();
  });
  it("queries yearly numbers and only the required ordered list fields", async () => {
    mocks.notes.mockResolvedValue([{ deliveryNo: "DN26WS0003" }]);
    expect(await suggestSalesDeliveryNoteNumber(new Date("2026-09-19"))).toBe("DN26WS0004");
    expect(mocks.notes).toHaveBeenLastCalledWith({ where: { deliveryNo: { startsWith: "DN26WS" } }, select: { deliveryNo: true } });
    await listSalesDeliveryNotes();
    expect(mocks.notes).toHaveBeenLastCalledWith({
      orderBy: [{ deliveryDate: "desc" }, { deliveryNo: "desc" }, { id: "desc" }],
      select: { id: true, deliveryNo: true, deliveryDate: true, customerLegalName: true, customerPoNo: true, status: true },
    });
  });
  it("loads only Company, Customer default delivery fields, and Product options", async () => {
    mocks.companyOptions.mockResolvedValue([]);
    mocks.customerOptions.mockResolvedValue([]);
    mocks.productOptions.mockResolvedValue([]);
    await getSalesDeliveryNoteFormOptions();
    expect(mocks.customerOptions).toHaveBeenCalledWith({
      orderBy: [{ code: "asc" }, { id: "asc" }],
      select: { id: true, code: true, legalName: true, defaultDeliveryContactName: true, defaultDeliveryPhone: true, defaultDeliveryAddress: true },
    });
  });
});
