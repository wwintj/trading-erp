export const SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE = "销售送货单保存失败，请稍后重试。";
export const SALES_DELIVERY_NOTE_DUPLICATE_NO_MESSAGE = "送货单号已存在。";
export const SALES_DELIVERY_NOTE_FORBIDDEN_MESSAGE = "你没有权限修改销售送货单。";
export const SALES_DELIVERY_NOTE_SIGN_IN_MESSAGE = "请先登录后再修改销售送货单。";
export const SALES_DELIVERY_NOTE_IMMUTABLE_MESSAGE = "当前状态的销售送货单不允许此操作。";
export const SALES_DELIVERY_NOTE_VALIDATION_MESSAGE = "请检查并修正标记的字段。";
export const SALES_DELIVERY_NOTE_LOAD_ERROR = "销售送货单信息暂时无法加载，请稍后重试。";
export const SALES_DELIVERY_NOTE_FIELD_LIMITS = {
  deliveryNo: 64,
  customerPoNo: 128,
  deliveryContactName: 128,
  deliveryContactPhone: 64,
  deliveryAddress: 2000,
  shippingMethod: 255,
  logisticsCompany: 255,
  trackingNo: 128,
  notes: 4000,
} as const;
export const SALES_DELIVERY_NOTE_ITEM_REMARK_LIMIT = 2000;
export type SalesDeliveryNoteStatus = "DRAFT" | "FINAL" | "CANCELLED";
export type SalesDeliveryNoteOperation = "finalize" | "reopen" | "cancel";
export const SALES_DELIVERY_NOTE_STATUS_LABELS = {
  DRAFT: "草稿", FINAL: "已定稿", CANCELLED: "已作废",
} satisfies Record<SalesDeliveryNoteStatus, string>;
export type SalesDeliveryNoteItemInput = {
  itemId?: string;
  productId: string;
  quantity: string;
  remark: string | null;
};
export type SalesDeliveryNoteInput = {
  deliveryNo: string;
  deliveryDate: string;
  companyId: string;
  customerId: string;
} & Record<Exclude<keyof typeof SALES_DELIVERY_NOTE_FIELD_LIMITS, "deliveryNo">, string | null> & {
  items: SalesDeliveryNoteItemInput[];
};
export type DeliveryProductOption = {
  id: string; code: string; name: string; specification: string | null; unit: string;
};
export type DeliveryCustomerOption = {
  id: string; code: string; legalName: string;
  defaultDeliveryContactName: string | null;
  defaultDeliveryPhone: string | null;
  defaultDeliveryAddress: string | null;
};
export type DeliveryFormItem = SalesDeliveryNoteItemInput & {
  snapshot?: DeliveryProductOption;
};
export type SalesDeliveryNoteFormValues = Omit<SalesDeliveryNoteInput, "items"> & {
  items: DeliveryFormItem[];
};
export type SalesDeliveryNoteFormState = {
  status: "idle" | "success" | "error";
  message: string;
  noteId?: string;
  fieldErrors?: Record<string, string>;
  // Canonical persisted IDs and snapshots returned after the atomic save.
  items?: DeliveryFormItem[];
};
export const INITIAL_SALES_DELIVERY_NOTE_FORM_STATE: SalesDeliveryNoteFormState = {
  status: "idle", message: "",
};

export function salesDeliveryNoteNumberPrefix(year: number) {
  return `DN${String(year).slice(-2)}WS`;
}
export function suggestNextSalesDeliveryNoteNumber(numbers: string[], year: number) {
  const prefix = salesDeliveryNoteNumberPrefix(year);
  const pattern = new RegExp(`^${prefix}(\\d{4})$`);
  const maximum = numbers.reduce((max, value) => {
    const match = value.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  if (maximum >= 9999) throw new Error("销售送货单号已用尽，请手动指定单号。");
  return `${prefix}${String(maximum + 1).padStart(4, "0")}`;
}
export function validDeliveryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1000-01-01") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function exactDeliveryQuantity(value: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const integer = match[1].replace(/^0+(?=\d)/, "");
  const fraction = (match[2] ?? "").padEnd(3, "0");
  if (integer.length > 15 || BigInt(integer + fraction) <= BigInt(0)) return null;
  return `${integer}.${fraction}`;
}
export function validDeliveryItemId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/.test(value);
}
function textValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function validateSalesDeliveryNoteForm(form: FormData):
  | { ok: true; input: SalesDeliveryNoteInput }
  | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const deliveryNo = textValue(form.get("deliveryNo"));
  const deliveryDate = textValue(form.get("deliveryDate"));
  const companyId = textValue(form.get("companyId"));
  const customerId = textValue(form.get("customerId"));
  if (!deliveryNo) fieldErrors.deliveryNo = "请输入送货单号。";
  if (!validDeliveryDate(deliveryDate)) fieldErrors.deliveryDate = "请输入有效的送货日期。";
  if (!companyId) fieldErrors.companyId = "请选择发货方。";
  if (!customerId) fieldErrors.customerId = "请选择客户。";
  const values = {} as Record<keyof typeof SALES_DELIVERY_NOTE_FIELD_LIMITS, string | null>;
  for (const field of Object.keys(SALES_DELIVERY_NOTE_FIELD_LIMITS) as Array<keyof typeof SALES_DELIVERY_NOTE_FIELD_LIMITS>) {
    const value = textValue(form.get(field));
    values[field] = value || null;
    if (value.length > SALES_DELIVERY_NOTE_FIELD_LIMITS[field]) {
      fieldErrors[field] = `不能超过 ${SALES_DELIVERY_NOTE_FIELD_LIMITS[field]} 个字符。`;
    }
  }
  let rawItems: unknown;
  try { rawItems = JSON.parse(textValue(form.get("itemsJson")) || "[]"); }
  catch { fieldErrors.items = "送货明细格式无效。"; }
  const items: SalesDeliveryNoteItemInput[] = [];
  const identities = new Set<string>();
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    fieldErrors.items ??= "请至少添加一条送货明细。";
  } else {
    rawItems.forEach((raw, index) => {
      const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      const productId = textValue(row.productId);
      const quantity = textValue(row.quantity);
      const remark = textValue(row.remark) || null;
      if (!productId) fieldErrors[`items.${index}.productId`] = "请选择产品。";
      if (!exactDeliveryQuantity(quantity)) fieldErrors[`items.${index}.quantity`] = "请输入大于 0、最多 3 位小数的有效数量。";
      if (remark && remark.length > SALES_DELIVERY_NOTE_ITEM_REMARK_LIMIT) fieldErrors[`items.${index}.remark`] = "不能超过 2000 个字符。";
      if (row.itemId !== undefined) {
        if (!validDeliveryItemId(row.itemId) || identities.has(row.itemId)) {
          fieldErrors[`items.${index}.itemId`] = "送货明细身份无效。";
        } else identities.add(row.itemId);
      }
      items.push({ ...(row.itemId !== undefined ? { itemId: row.itemId } : {}), productId, quantity, remark });
    });
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, input: { ...values, deliveryNo, deliveryDate, companyId, customerId, items } };
}
export function deliveryDefaults(customer?: DeliveryCustomerOption) {
  return {
    deliveryContactName: customer?.defaultDeliveryContactName ?? "",
    deliveryContactPhone: customer?.defaultDeliveryPhone ?? "",
    deliveryAddress: customer?.defaultDeliveryAddress ?? "",
  };
}
