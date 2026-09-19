import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SalesDeliveryNoteForm } from "@/components/sales-delivery-note/sales-delivery-note-form";
import { DeliveryLoadError, SalesDeliveryNoteShell } from "@/components/sales-delivery-note/sales-delivery-note-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import { deliveryDefaults, type SalesDeliveryNoteFormValues } from "@/lib/sales-delivery-note";
import { getSalesDeliveryNoteFormOptions, suggestSalesDeliveryNoteNumber } from "@/lib/sales-delivery-note.server";

export const metadata: Metadata = { title: "新建销售送货单" };
export default async function NewSalesDeliveryNotePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/sales-delivery-notes");
  const { APP_NAME } = getServerEnv();
  let options, deliveryNo;
  try {
    [options, deliveryNo] = await Promise.all([getSalesDeliveryNoteFormOptions(), suggestSalesDeliveryNoteNumber()]);
  } catch { return <DeliveryLoadError appName={APP_NAME} email={session.user.email} />; }
  const initialValues: SalesDeliveryNoteFormValues = {
    deliveryNo, deliveryDate: new Date().toISOString().slice(0, 10),
    companyId: options.companies[0]?.id ?? "", customerId: options.customers[0]?.id ?? "",
    customerPoNo: null, ...deliveryDefaults(options.customers[0]),
    shippingMethod: null, logisticsCompany: null, trackingNo: null, notes: null,
    items: [{ productId: options.products[0]?.id ?? "", quantity: "", remark: null }],
  };
  return <SalesDeliveryNoteShell appName={APP_NAME} title="新建销售送货单" description={session.user.email}>
    <SalesDeliveryNoteForm noteId={null} initialValues={initialValues} {...options} />
  </SalesDeliveryNoteShell>;
}
