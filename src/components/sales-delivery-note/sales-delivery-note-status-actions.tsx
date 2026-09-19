"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { finalizeSalesDeliveryNoteAction, reopenSalesDeliveryNoteAction, cancelSalesDeliveryNoteAction } from "@/app/sales-delivery-notes/actions";
import { SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE, type SalesDeliveryNoteFormState, type SalesDeliveryNoteOperation, type SalesDeliveryNoteStatus } from "@/lib/sales-delivery-note";
import { notifySalesDeliveryNote } from "@/lib/sales-delivery-note-feedback";

export const SALES_DELIVERY_NOTE_CONFIRMATIONS = {
  finalize: "确认将销售送货单定稿？定稿后送货单内容不可修改。",
  reopen: "确认重新打开该销售送货单？重新打开后送货单将恢复为草稿状态并可继续修改。",
  cancel: "确认作废销售送货单？作废后不可恢复。",
};
export async function requestDeliveryStatusChange(id: string, operation: SalesDeliveryNoteOperation, deps: {
  confirm: (message: string) => boolean;
  finalize: (id: string) => Promise<SalesDeliveryNoteFormState>;
  reopen: (id: string) => Promise<SalesDeliveryNoteFormState>;
  cancel: (id: string) => Promise<SalesDeliveryNoteFormState>;
  notify: (state: SalesDeliveryNoteFormState) => void;
  refresh: () => void;
}) {
  if (!deps.confirm(SALES_DELIVERY_NOTE_CONFIRMATIONS[operation])) return;
  let result: SalesDeliveryNoteFormState;
  try { result = await deps[operation](id); }
  catch { result = { status: "error", message: SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE }; }
  deps.notify(result);
  if (result.status === "success") deps.refresh();
}
export function SalesDeliveryNoteStatusActions({ noteId, status }: { noteId: string; status: SalesDeliveryNoteStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(operation: SalesDeliveryNoteOperation) {
    startTransition(() => requestDeliveryStatusChange(noteId, operation, {
      confirm: (message) => window.confirm(message),
      finalize: finalizeSalesDeliveryNoteAction, reopen: reopenSalesDeliveryNoteAction, cancel: cancelSalesDeliveryNoteAction,
      notify: notifySalesDeliveryNote, refresh: () => router.refresh(),
    }));
  }
  if (status === "CANCELLED") return null;
  return <div className="mt-8 flex gap-3 border-t pt-6">
    <Button disabled={pending} type="button" onClick={() => run(status === "DRAFT" ? "finalize" : "reopen")}>{pending ? "处理中…" : status === "DRAFT" ? "定稿送货单" : "重新打开为草稿"}</Button>
    <Button disabled={pending} type="button" variant="outline" onClick={() => run("cancel")}>作废送货单</Button>
  </div>;
}
