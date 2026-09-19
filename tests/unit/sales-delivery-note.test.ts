import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  salesDeliveryNoteNumberPrefix, suggestNextSalesDeliveryNoteNumber, exactDeliveryQuantity,
  validateSalesDeliveryNoteForm, SALES_DELIVERY_NOTE_FIELD_LIMITS,
} from "@/lib/sales-delivery-note";
import { deliveryForm } from "../helpers/sales-delivery-note";

describe("Sales Delivery Note numbering", () => {
  it("uses the yearly prefix and max + 1 instead of filling gaps", () => {
    expect(salesDeliveryNoteNumberPrefix(2026)).toBe("DN26WS");
    expect(suggestNextSalesDeliveryNoteNumber([], 2026)).toBe("DN26WS0001");
    expect(suggestNextSalesDeliveryNoteNumber(["DN26WS0001", "DN26WS0003", "DN25WS0999", "DN26WS12345", "other"], 2026)).toBe("DN26WS0004");
  });
  it("fails safely at exhaustion", () => {
    expect(() => suggestNextSalesDeliveryNoteNumber(["DN26WS9999"], 2026)).toThrow("送货单号已用尽");
  });
});
describe("Sales Delivery Note validation", () => {
  it("requires all four header fields", () => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ deliveryNo: " ", deliveryDate: "", companyId: "", customerId: "" }))).toEqual({
      ok: false, fieldErrors: {
        deliveryNo: "请输入送货单号。", deliveryDate: "请输入有效的送货日期。", companyId: "请选择发货方。", customerId: "请选择客户。",
      },
    });
  });
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-9-1", "0000-01-01", "not-date"])("rejects invalid calendar date %s", (deliveryDate) => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ deliveryDate }))).toMatchObject({ ok: false, fieldErrors: { deliveryDate: "请输入有效的送货日期。" } });
  });
  it("accepts leap dates and preserves manually chosen numbers", () => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ deliveryDate: "2028-02-29", deliveryNo: "  Manual-123 " }))).toMatchObject({ ok: true, input: { deliveryNo: "Manual-123" } });
  });
  it("trims optional fields, preserves internal newlines and normalizes blanks", () => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ customerPoNo: "  ", notes: " first\nsecond ", trackingNo: " 123 " }))).toMatchObject({
      ok: true, input: { customerPoNo: null, notes: "first\nsecond", trackingNo: "123" },
    });
  });
  it.each(Object.entries(SALES_DELIVERY_NOTE_FIELD_LIMITS))("bounds %s at %s", (field, limit) => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ [field]: "x".repeat(limit + 1) }))).toMatchObject({ ok: false, fieldErrors: { [field]: `不能超过 ${limit} 个字符。` } });
  });
  it.each(["6400", "6400.0", "12.500", "0.125", "999999999999999.999"])("accepts exact quantity %s", (quantity) => {
    const result = exactDeliveryQuantity(quantity);
    expect(result).not.toBeNull();
    expect(result).toMatch(/\.\d{3}$/);
  });
  it.each(["0", "0.000", "-1", "abc", "1.1234", "1e3", "Infinity", "1000000000000000"])("rejects quantity %s", (quantity) => {
    expect(exactDeliveryQuantity(quantity)).toBeNull();
    expect(validateSalesDeliveryNoteForm(deliveryForm({ itemsJson: JSON.stringify([{ productId: "p", quantity }]) }))).toMatchObject({ ok: false, fieldErrors: { "items.0.quantity": expect.any(String) } });
  });
  it("preserves the exact decimal upper bound without floating point", () => {
    expect(exactDeliveryQuantity("999999999999999.999")).toBe("999999999999999.999");
    expect(exactDeliveryQuantity("006400")).toBe("6400.000");
  });
  it.each(["[]", "{}", "null", "[", '["bad"]'])("rejects empty or malformed items %s", (itemsJson) => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ itemsJson })).ok).toBe(false);
  });
  it("requires product and normalizes/bounds item remark", () => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ itemsJson: JSON.stringify([{ productId: "", quantity: "1", remark: "x".repeat(2001) }]) }))).toMatchObject({
      ok: false, fieldErrors: { "items.0.productId": "请选择产品。", "items.0.remark": "不能超过 2000 个字符。" },
    });
    expect(validateSalesDeliveryNoteForm(deliveryForm({ itemsJson: JSON.stringify([{ productId: "p", quantity: "1", remark: " \n " }]) }))).toMatchObject({ ok: true, input: { items: [{ remark: null }] } });
  });
  it.each([null, 3, {}, "", "bad id", "a".repeat(192)])("rejects malformed identity %j", (itemId) => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ itemsJson: JSON.stringify([{ itemId, productId: "p", quantity: "1" }]) }))).toMatchObject({ ok: false, fieldErrors: { "items.0.itemId": "送货明细身份无效。" } });
  });
  it("rejects duplicated submitted identity", () => {
    expect(validateSalesDeliveryNoteForm(deliveryForm({ itemsJson: JSON.stringify(Array(2).fill({ itemId: "item-1", productId: "p", quantity: "1" })) }))).toMatchObject({ ok: false, fieldErrors: { "items.1.itemId": "送货明细身份无效。" } });
  });
  it("never accepts authoritative product or header snapshots from the client", () => {
    const result = validateSalesDeliveryNoteForm(deliveryForm({ senderLegalName: "forged", customerLegalName: "forged", itemsJson: JSON.stringify([{ productId: "p", quantity: "1", productName: "forged", unit: "fake" }]) }));
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.input).not.toHaveProperty("senderLegalName");
      expect(result.input).not.toHaveProperty("customerLegalName");
      expect(result.input.items[0]).not.toHaveProperty("productName");
    }
  });
});
describe("Sales Delivery Note migration", () => {
  it("only creates two new tables with required indexes and foreign keys", () => {
    const sql = readFileSync("prisma/migrations/20260919043000_add_sales_delivery_note_core/migration.sql", "utf8");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2);
    expect(sql).toContain("UNIQUE INDEX `sales_delivery_note_deliveryNo_key`");
    expect(sql).toContain("DECIMAL(18, 3)");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(4);
    expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(1);
    expect(sql).not.toMatch(/DROP|sales_contract|inventory|receivable|unitPrice|totalQuantity|totalAmount/);
    for (const match of sql.matchAll(/ALTER TABLE `([^\x60]+)`/g)) {
      expect(["sales_delivery_note", "sales_delivery_note_item"]).toContain(match[1]);
    }
  });
});
