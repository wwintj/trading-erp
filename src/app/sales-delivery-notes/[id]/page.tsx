import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SalesDeliveryNoteForm } from "@/components/sales-delivery-note/sales-delivery-note-form";
import { SalesDeliveryNoteStatusActions } from "@/components/sales-delivery-note/sales-delivery-note-status-actions";
import { DeliveryLoadError, SalesDeliveryNoteShell } from "@/components/sales-delivery-note/sales-delivery-note-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import { SALES_DELIVERY_NOTE_STATUS_LABELS, type SalesDeliveryNoteFormValues } from "@/lib/sales-delivery-note";
import { getSalesDeliveryNoteById, getSalesDeliveryNoteFormOptions } from "@/lib/sales-delivery-note.server";

export const metadata: Metadata = { title: "销售送货单" };
type Note = NonNullable<Awaited<ReturnType<typeof getSalesDeliveryNoteById>>>;
export default async function SalesDeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { APP_NAME } = getServerEnv();
  const { id } = await params;
  let note;
  try { note = await getSalesDeliveryNoteById(id); }
  catch { return <DeliveryLoadError appName={APP_NAME} email={session.user.email} />; }
  if (!note) notFound();
  const admin = session.user.role === "admin";
  let options = null;
  if (admin && note.status === "DRAFT") {
    try { options = await getSalesDeliveryNoteFormOptions(); }
    catch { return <DeliveryLoadError appName={APP_NAME} email={session.user.email} />; }
  }
  return <SalesDeliveryNoteShell appName={APP_NAME} title={note.deliveryNo} description={`${SALES_DELIVERY_NOTE_STATUS_LABELS[note.status]} · ${note.customerLegalName}`}>
    {options ? <SalesDeliveryNoteForm noteId={note.id} initialValues={toFormValues(note)} {...options} /> : <SalesDeliveryNoteDetails note={note} />}
    {admin ? <SalesDeliveryNoteStatusActions noteId={note.id} status={note.status} /> : null}
  </SalesDeliveryNoteShell>;
}
function toFormValues(note: Note): SalesDeliveryNoteFormValues {
  return {
    deliveryNo: note.deliveryNo, deliveryDate: note.deliveryDate.toISOString().slice(0, 10),
    companyId: note.companyId, customerId: note.customerId, customerPoNo: note.customerPoNo,
    deliveryContactName: note.deliveryContactName, deliveryContactPhone: note.deliveryContactPhone, deliveryAddress: note.deliveryAddress,
    shippingMethod: note.shippingMethod, logisticsCompany: note.logisticsCompany, trackingNo: note.trackingNo, notes: note.notes,
    items: note.items.map((item) => ({
      itemId: item.id, productId: item.productId, quantity: item.quantity.toFixed(3), remark: item.remark,
      snapshot: { id: item.productId, code: item.productCode, name: item.productName, specification: item.specification, unit: item.unit },
    })),
  };
}
function SalesDeliveryNoteDetails({ note }: { note: Note }) {
  const fields = [
    ["送货单号", note.deliveryNo], ["状态", SALES_DELIVERY_NOTE_STATUS_LABELS[note.status]],
    ["送货日期", note.deliveryDate.toISOString().slice(0, 10)],
    ["发货方", note.senderLegalName], ["发货方联系人", note.senderContactName], ["发货方电话", note.senderPhone], ["发货方地址", note.senderAddress],
    ["客户", note.customerLegalName], ["客户订单号 / PO No.", note.customerPoNo],
    ["收货人", note.deliveryContactName], ["收货电话", note.deliveryContactPhone], ["收货地址", note.deliveryAddress],
    ["运输方式", note.shippingMethod], ["物流公司", note.logisticsCompany], ["物流单号", note.trackingNo], ["备注", note.notes],
  ];
  return <div className="space-y-8">
    <dl className="grid gap-5 text-sm sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}>
      <dt className="font-medium text-neutral-500">{label}</dt><dd className="whitespace-pre-wrap">{value || "—"}</dd>
    </div>)}</dl>
    <section className="space-y-3"><h2 className="font-semibold">送货明细</h2><div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr>{["产品代码", "产品名称", "规格/型号", "数量", "单位", "备注"].map((label) => <th key={label} className="border-b px-3 py-3">{label}</th>)}</tr></thead>
        <tbody>{note.items.map((item) => <tr key={item.id} className="border-b">
          {[item.productCode, item.productName, item.specification, item.quantity.toFixed(3), item.unit, item.remark].map((value, index) => <td key={index} className="whitespace-pre-wrap px-3 py-3">{value ?? "—"}</td>)}
        </tr>)}</tbody>
      </table>
    </div></section>
  </div>;
}
