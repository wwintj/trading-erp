import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliveryInput, deliveryOptions } from "../helpers/sales-delivery-note";
import type { SalesDeliveryNoteFormState, SalesDeliveryNoteFormValues } from "@/lib/sales-delivery-note";

// A small hook harness exercises the actual component handlers/effects without adding a DOM package.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[],
  state: { status: "idle", message: "" } as SalesDeliveryNoteFormState,
  pending: false, replace: vi.fn(), refresh: vi.fn(), notify: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[slot], (next: unknown) => { hooks.slots[slot] = typeof next === "function" ? next(hooks.slots[slot]) : next; }];
  },
  useRef: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial };
    return hooks.slots[slot];
  },
  useActionState: () => [hooks.state, vi.fn(), hooks.pending],
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: hooks.replace, refresh: hooks.refresh }) }));
vi.mock("@/app/sales-delivery-notes/actions", () => ({ saveSalesDeliveryNoteAction: vi.fn() }));
vi.mock("@/lib/sales-delivery-note-feedback", () => ({ notifySalesDeliveryNote: hooks.notify }));
import { SalesDeliveryNoteForm } from "@/components/sales-delivery-note/sales-delivery-note-form";

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
function render(initialValues: SalesDeliveryNoteFormValues = deliveryInput, noteId: string | null = "note-1") {
  hooks.cursor = 0; hooks.effects = [];
  return SalesDeliveryNoteForm({ noteId, initialValues, ...deliveryOptions,
    customers: [...deliveryOptions.customers, { ...deliveryOptions.customers[0], id: "customer-2", defaultDeliveryContactName: "新收货人" }],
  });
}
function change(tree: ReactNode, id: string, value: string) {
  const element = elements(tree).find((element) => element.props.id === id && element.props.onChange)!;
  (element.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function click(tree: ReactNode, label: string) {
  const element = elements(tree).find((element) => element.props.children === label && element.props.onClick)!;
  (element.props.onClick as () => void)();
}
function serialized(tree: ReactNode) {
  return JSON.parse(elements(tree).find((element) => element.props.name === "itemsJson")!.props.value as string);
}
describe("Sales Delivery Note actual form handlers", () => {
  beforeEach(() => {
    hooks.slots = []; hooks.state = { status: "idle", message: "" }; hooks.pending = false;
    vi.clearAllMocks();
    vi.stubGlobal("window", { confirm: vi.fn().mockReturnValue(true) });
  });
  it("imports defaults only after explicit change, then submits manual edits", () => {
    let tree = render();
    expect(elements(tree).find((element) => element.props.name === "deliveryContactName")?.props.value).toBe("李经理");
    change(tree, "delivery-customer", "customer-2");
    tree = render();
    expect(elements(tree).find((element) => element.props.name === "deliveryContactName")?.props.value).toBe("新收货人");
    change(tree, "delivery-deliveryAddress", "手动地址");
    tree = render();
    expect(elements(tree).find((element) => element.props.name === "deliveryAddress")?.props.value).toBe("手动地址");
  });
  it("adds a new product row, edits its quantity/remark, and deletes to zero with submit guard", () => {
    let tree = render();
    click(tree, "添加产品");
    tree = render();
    expect(serialized(tree)).toHaveLength(2);
    change(tree, "delivery-item-1", "product-1");
    change(tree, "delivery-item-1-quantity", "12.500");
    change(tree, "delivery-item-1-remark", "第二行备注");
    tree = render();
    expect(serialized(tree)[1]).toEqual({ productId: "product-1", quantity: "12.500", remark: "第二行备注" });
    click(tree, "删除明细"); tree = render();
    click(tree, "删除明细"); tree = render();
    expect(serialized(tree)).toEqual([]);
    expect(elements(tree).find((element) => element.props.type === "submit")?.props.disabled).toBe(true);
    const preventDefault = vi.fn();
    (tree.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });
  it("leaves selected row untouched when confirmation is cancelled", () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    click(render(), "删除明细");
    expect(serialized(render())).toHaveLength(1);
  });
  it("syncs canonical IDs/quantities after success and refreshes exactly once", () => {
    render();
    hooks.state = { status: "success", message: "销售送货单保存成功。", noteId: "note-1", items: [
      { ...deliveryInput.items[0], itemId: "canonical-1", quantity: "6400.000" },
    ] };
    render(); hooks.effects.forEach((effect) => effect());
    let tree = render(); hooks.effects.forEach((effect) => effect());
    tree = render(); hooks.effects.forEach((effect) => effect());
    expect(serialized(tree)[0]).toMatchObject({ itemId: "canonical-1", quantity: "6400.000" });
    expect(hooks.refresh).toHaveBeenCalledOnce();
    expect(hooks.replace).not.toHaveBeenCalled();
  });
  it("does not sync or refresh on pending or validation failure; identity error is visible", () => {
    let tree = render();
    change(tree, "delivery-item-0-quantity", "17");
    hooks.state = { status: "error", message: "请检查并修正标记的字段。", fieldErrors: { "items.0.itemId": "送货明细身份无效。" } };
    tree = render(); hooks.effects.forEach((effect) => effect());
    expect(elements(tree).some((element) => element.props.children === "送货明细身份无效。")).toBe(true);
    hooks.pending = true;
    hooks.state = { status: "success", message: "", items: [{ ...deliveryInput.items[0], itemId: "not-yet", quantity: "999" }] };
    tree = render(); hooks.effects.forEach((effect) => effect());
    expect(serialized(tree)[0].quantity).toBe("17");
    expect(hooks.refresh).not.toHaveBeenCalled();
  });
  it("new-note success only replaces the route", () => {
    render(deliveryInput, null);
    hooks.state = { status: "success", noteId: "created-note", message: "销售送货单创建成功。" };
    render(deliveryInput, null); hooks.effects.forEach((effect) => effect());
    expect(hooks.replace).toHaveBeenCalledWith("/sales-delivery-notes/created-note");
    expect(hooks.refresh).not.toHaveBeenCalled();
  });
});
