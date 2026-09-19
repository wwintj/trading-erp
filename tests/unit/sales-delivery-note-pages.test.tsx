import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(), list: vi.fn(), get: vi.fn(), options: vi.fn(), number: vi.fn(),
}));
vi.mock("@/lib/auth-session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/sales-delivery-note.server", () => ({
  listSalesDeliveryNotes: mocks.list, getSalesDeliveryNoteById: mocks.get,
  getSalesDeliveryNoteFormOptions: mocks.options, suggestSalesDeliveryNoteNumber: mocks.number,
}));
vi.mock("@/app/sales-delivery-notes/actions", () => ({
  saveSalesDeliveryNoteAction: vi.fn(), finalizeSalesDeliveryNoteAction: vi.fn(), reopenSalesDeliveryNoteAction: vi.fn(), cancelSalesDeliveryNoteAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error("REDIRECT:" + url); },
  notFound: () => { throw new Error("NOT_FOUND"); },
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
import List from "@/app/sales-delivery-notes/page";
import New from "@/app/sales-delivery-notes/new/page";
import Detail from "@/app/sales-delivery-notes/[id]/page";
import {
  SalesDeliveryNoteForm, changeDeliveryCustomer, removeDeliveryRow, deliverySaveNavigation,
  synchronizeDeliveryRows, deliveryRowProduct,
} from "@/components/sales-delivery-note/sales-delivery-note-form";
import { deliveryDefaults } from "@/lib/sales-delivery-note";
import { deliveryInput, deliveryOptions, existingDeliveryNote } from "../helpers/sales-delivery-note";
const detail = () => Detail({ params: Promise.resolve({ id: "note-1" }) });
describe("Sales Delivery Note pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { email: "admin@example.com", role: "admin" } });
    mocks.options.mockResolvedValue(deliveryOptions);
    mocks.number.mockResolvedValue("DN26WS0001");
    mocks.list.mockResolvedValue([]);
    mocks.get.mockResolvedValue(existingDeliveryNote());
  });
  it.each([["list", List], ["new", New], ["detail", detail]] as const)("requires auth for %s", async (_name, page) => {
    mocks.session.mockResolvedValue(null);
    await expect(page()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.options).not.toHaveBeenCalled();
  });
  it("shows admin create control and Chinese empty state", async () => {
    const html = renderToStaticMarkup(await List());
    expect(html).toContain("新建销售送货单"); expect(html).toContain("暂无销售送货单。");
  });
  it("renders snapshot-backed table for user with no create or totals", async () => {
    mocks.session.mockResolvedValue({ user: { email: "user@example.com", role: "user" } });
    mocks.list.mockResolvedValue([existingDeliveryNote()]);
    const html = renderToStaticMarkup(await List());
    for (const label of ["送货单号", "送货日期", "客户", "客户 PO", "状态", "旧客户名称"]) expect(html).toContain(label);
    expect(html).not.toMatch(/新建销售送货单|总数量|总金额/);
  });
  it("redirects user away from new", async () => {
    mocks.session.mockResolvedValue({ user: { role: "user" } });
    await expect(New()).rejects.toThrow("REDIRECT:/sales-delivery-notes");
    expect(mocks.options).not.toHaveBeenCalled();
  });
  it("preloads number, today, and selected Customer defaults for new", async () => {
    const html = renderToStaticMarkup(await New());
    for (const value of ["DN26WS0001", new Date().toISOString().slice(0, 10), "CUST001", "张建英", "13587623210", "浙江仓库"]) expect(html).toContain(value);
    expect(html).toContain("创建销售送货单");
    expect(html).toContain("送货数量"); expect(html).toContain("明细备注");
  });
  it.each(["list", "new", "detail", "options"] as const)("safely handles %s load failure", async (target) => {
    ({ list: mocks.list, new: mocks.number, detail: mocks.get, options: mocks.options })[target].mockRejectedValue(new Error("internal SQL secret"));
    const html = renderToStaticMarkup(await (target === "list" ? List() : target === "new" ? New() : detail()));
    expect(html).toContain("销售送货单信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("internal SQL secret");
  });
  it("returns not-found on missing note", async () => {
    mocks.get.mockResolvedValue(null);
    await expect(detail()).rejects.toThrow("NOT_FOUND");
  });
  it("loads existing DRAFT operational values and persisted product snapshot", async () => {
    const html = renderToStaticMarkup(await detail());
    for (const text of ["李经理", "上海临时仓库", "旧产品快照", "OLD-H42", "保存销售送货单", "定稿送货单", "作废送货单"]) expect(html).toContain(text);
    expect(html).not.toContain('value="张建英"');
    expect(html).not.toContain("重新打开为草稿");
  });
  it.each(["DRAFT", "FINAL", "CANCELLED"] as const)("user views %s read-only, without any live options query", async (status) => {
    mocks.session.mockResolvedValue({ user: { email: "user@example.com", role: "user" } });
    mocks.get.mockResolvedValue(existingDeliveryNote(status));
    const html = renderToStaticMarkup(await detail());
    for (const text of ["旧发货公司", "旧客户名称", "旧产品快照", "6400.000", "李经理", "上海临时仓库"]) expect(html).toContain(text);
    expect(html).not.toMatch(/<form|定稿送货单|作废送货单|重新打开为草稿|导出|总数量|总金额/);
    expect(mocks.options).not.toHaveBeenCalled();
  });
  it.each(["FINAL", "CANCELLED"] as const)("admin views %s read-only with appropriate actions", async (status) => {
    mocks.get.mockResolvedValue(existingDeliveryNote(status));
    const html = renderToStaticMarkup(await detail());
    expect(html).not.toContain("<form");
    expect(html.includes("重新打开为草稿")).toBe(status === "FINAL");
    expect(html.includes("作废送货单")).toBe(status === "FINAL");
    expect(mocks.options).not.toHaveBeenCalled();
  });
});
describe("Delivery form defaults, row UX, and canonical identity", () => {
  it("uses only explicit Customer default delivery fields, with no fallback", () => {
    expect(deliveryDefaults(deliveryOptions.customers[0])).toEqual({ deliveryContactName: "张建英", deliveryContactPhone: "13587623210", deliveryAddress: "浙江仓库" });
    expect(deliveryDefaults({ ...deliveryOptions.customers[0], defaultDeliveryContactName: null, defaultDeliveryPhone: null, defaultDeliveryAddress: null })).toEqual({ deliveryContactName: "", deliveryContactPhone: "", deliveryAddress: "" });
  });
  it("preserves persisted values until a different Customer is selected, then allows manual edits", () => {
    expect(changeDeliveryCustomer(deliveryInput, "customer-1", deliveryOptions.customers)).toBe(deliveryInput);
    const customer = { ...deliveryOptions.customers[0], id: "customer-2" };
    const next = changeDeliveryCustomer(deliveryInput, "customer-2", [customer]);
    expect(next).toMatchObject({ customerId: "customer-2", deliveryContactName: "张建英", deliveryContactPhone: "13587623210", deliveryAddress: "浙江仓库" });
    const edited = { ...next, deliveryAddress: "人工修改地址" };
    expect(changeDeliveryCustomer(edited, "customer-2", [customer]).deliveryAddress).toBe("人工修改地址");
  });
  it("requires selected-product deletion confirmation and permits deleting the last row", () => {
    const rows = [{ ...deliveryInput.items[0], key: 0 }];
    const cancel = vi.fn().mockReturnValue(false);
    expect(removeDeliveryRow(rows, 0, deliveryOptions.products, cancel)).toBe(rows);
    expect(cancel).toHaveBeenCalledWith("确定从本送货单中删除“WS-H42 — PVC热收缩套管”吗？保存送货单后生效。");
    expect(removeDeliveryRow(rows, 0, deliveryOptions.products, () => true)).toEqual([]);
    const confirm = vi.fn();
    expect(removeDeliveryRow([{ ...rows[0], productId: "" }], 0, [], confirm)).toEqual([]);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("shows empty state, reason, add entry, and disabled save for zero rows", () => {
    const html = renderToStaticMarkup(<SalesDeliveryNoteForm noteId="note-1" initialValues={{ ...deliveryInput, items: [] }} {...deliveryOptions} />);
    for (const text of ["暂无送货明细", "请点击“添加产品”添加至少一条送货明细。", "请至少添加一条送货明细后再保存。"]) expect(html).toContain(text);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>保存销售送货单/);
    expect(html).not.toContain("明细 1");
  });
  it("renders prominent Product identity and replacement/quantity/remark controls", () => {
    const html = renderToStaticMarkup(<SalesDeliveryNoteForm noteId="note-1" initialValues={deliveryInput} {...deliveryOptions} />);
    for (const text of ["明细 1", "WS-H42", "PVC热收缩套管", "42mm", "米", "产品（可更换）", "选择其它产品即可更换本条送货明细。", "送货数量", "明细备注", "添加产品", "删除明细"]) expect(html).toContain(text);
    const empty = renderToStaticMarkup(<SalesDeliveryNoteForm noteId={null} initialValues={{ ...deliveryInput, items: [{ productId: "", quantity: "", remark: null }] }} {...deliveryOptions} />);
    expect(empty).toContain("尚未选择产品");
  });
  it("renders preserved snapshot until Product is explicitly replaced", () => {
    const snapshot = { ...deliveryOptions.products[0], name: "原始快照名称" };
    const row = { ...deliveryInput.items[0], snapshot };
    expect(deliveryRowProduct(row, deliveryOptions.products)?.name).toBe("原始快照名称");
    const replacement = { ...snapshot, id: "product-2", name: "替换主档" };
    expect(deliveryRowProduct({ ...row, productId: "product-2" }, [replacement])?.name).toBe("替换主档");
  });
  it("resyncs DB IDs and exact values without corrupting local row keys", () => {
    const rows = [{ ...deliveryInput.items[0], itemId: "item-1", key: 10 }, { ...deliveryInput.items[0], key: 11 }];
    const canonical = [{ ...deliveryInput.items[0], itemId: "item-1", quantity: "6400.000" }, { ...deliveryInput.items[0], itemId: "new-id", quantity: "12.500" }];
    expect(synchronizeDeliveryRows(rows, canonical, () => 12)).toEqual(canonical.map((item, index) => ({ ...item, key: index + 10 })));
  });
  it("refreshes existing success, replaces create success, and does neither for failures or idle", () => {
    expect(deliverySaveNavigation("n", { status: "success", message: "" })).toEqual({ type: "refresh" });
    expect(deliverySaveNavigation(null, { status: "success", message: "", noteId: "new" })).toEqual({ type: "replace", href: "/sales-delivery-notes/new" });
    expect(deliverySaveNavigation("n", { status: "error", message: "error" })).toBeNull();
    expect(deliverySaveNavigation("n", { status: "idle", message: "" })).toBeNull();
  });
});
