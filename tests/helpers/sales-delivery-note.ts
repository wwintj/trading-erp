import { Prisma } from "@/generated/prisma/client";
import type { SalesDeliveryNoteInput, SalesDeliveryNoteStatus } from "@/lib/sales-delivery-note";

export const deliveryInput: SalesDeliveryNoteInput = {
  deliveryNo: "DN26WS0001", deliveryDate: "2026-09-19", companyId: "company-1", customerId: "customer-1",
  customerPoNo: "PO-001", deliveryContactName: "李经理", deliveryContactPhone: "13800000000",
  deliveryAddress: "上海临时仓库", shippingMethod: "物流", logisticsCompany: "德邦", trackingNo: "123456",
  notes: "周一送货\n请提前联系",
  items: [{ productId: "product-1", quantity: "6400", remark: "小心轻放" }],
};
export const deliveryOptions = {
  companies: [{ id: "company-1", legalName: "新发货公司", contactName: "新联系人", phone: "10000", address: "新地址" }],
  customers: [{
    id: "customer-1", code: "CUST001", legalName: "新客户名称",
    defaultDeliveryContactName: "张建英", defaultDeliveryPhone: "13587623210", defaultDeliveryAddress: "浙江仓库",
  }],
  products: [{ id: "product-1", code: "WS-H42", name: "PVC热收缩套管", specification: "42mm", unit: "米" }],
};
export function deliveryForm(overrides: Record<string, unknown> = {}) {
  const form = new FormData();
  const { items, ...header } = deliveryInput;
  Object.entries(header).forEach(([key, value]) => form.set(key, value ?? ""));
  form.set("itemsJson", JSON.stringify(items));
  Object.entries(overrides).forEach(([key, value]) => form.set(key, String(value)));
  return form;
}
export function existingDeliveryNote(status: SalesDeliveryNoteStatus = "DRAFT") {
  return {
    ...deliveryInput, id: "note-1", status, deliveryDate: new Date("2026-09-19T00:00:00.000Z"),
    senderLegalName: "旧发货公司", senderContactName: "旧联系人", senderPhone: "旧电话", senderAddress: "旧地址",
    customerLegalName: "旧客户名称", createdAt: new Date("2026-09-19T00:00:00.000Z"), updatedAt: new Date("2026-09-19T00:00:00.000Z"),
    items: [{
      id: "item-1", salesDeliveryNoteId: "note-1", productId: "product-1", sortOrder: 0,
      productCode: "OLD-H42", productName: "旧产品快照", specification: "旧规格", unit: "米",
      quantity: new Prisma.Decimal("6400.000"), remark: "小心轻放",
    }],
  };
}
