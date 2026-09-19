import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SalesDeliveryNoteShell } from "@/components/sales-delivery-note/sales-delivery-note-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import { SALES_DELIVERY_NOTE_LOAD_ERROR, SALES_DELIVERY_NOTE_STATUS_LABELS } from "@/lib/sales-delivery-note";
import { listSalesDeliveryNotes } from "@/lib/sales-delivery-note.server";

export const metadata: Metadata = { title: "销售送货单" };
export default async function SalesDeliveryNotesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const { APP_NAME } = getServerEnv();
  const actions = <div className="flex gap-3">
    <Button variant="outline" asChild><Link href="/dashboard">返回仪表盘</Link></Button>
    {session.user.role === "admin" ? <Button asChild><Link href="/sales-delivery-notes/new">新建销售送货单</Link></Button> : null}
  </div>;
  let notes;
  try { notes = await listSalesDeliveryNotes(); }
  catch {
    return <SalesDeliveryNoteShell appName={APP_NAME} title="销售送货单" description={session.user.email} actions={actions}>
      <p role="alert" className="text-sm text-red-700">{SALES_DELIVERY_NOTE_LOAD_ERROR}</p>
    </SalesDeliveryNoteShell>;
  }
  return <SalesDeliveryNoteShell appName={APP_NAME} title="销售送货单" description={session.user.email} actions={actions}>
    {!notes.length ? <p className="text-sm text-neutral-600">暂无销售送货单。</p> : <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr className="border-b text-neutral-500">{["送货单号", "送货日期", "客户", "客户 PO", "状态"].map((label) => <th className="px-3 py-3 font-medium" key={label}>{label}</th>)}</tr></thead>
        <tbody>{notes.map((note) => <tr key={note.id} className="border-b transition-colors last:border-b-0 hover:bg-neutral-50 focus-within:bg-neutral-50">
          <td className="px-3 py-3"><NoteLink id={note.id}>{note.deliveryNo}</NoteLink></td>
          <td className="px-3 py-3">{note.deliveryDate.toISOString().slice(0, 10)}</td>
          <td className="px-3 py-3"><NoteLink id={note.id}>{note.customerLegalName}</NoteLink></td>
          <td className="px-3 py-3">{note.customerPoNo ?? "—"}</td>
          <td className="px-3 py-3">{SALES_DELIVERY_NOTE_STATUS_LABELS[note.status]}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </SalesDeliveryNoteShell>;
}
function NoteLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/sales-delivery-notes/${id}`} className="cursor-pointer text-neutral-900 hover:text-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]">{children}</Link>;
}
