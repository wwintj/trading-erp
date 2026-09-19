import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SALES_DELIVERY_NOTE_LOAD_ERROR } from "@/lib/sales-delivery-note";

export function SalesDeliveryNoteShell({ appName, title, description, actions, children }: {
  appName: string; title: string; description: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5"><p className="text-sm text-neutral-500">{appName}</p><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div>
      {actions ?? <DeliveryListLink />}
    </div></CardHeader><CardContent>{children}</CardContent>
  </Card></main>;
}
export function DeliveryListLink() {
  return <Link href="/sales-delivery-notes" className="text-sm font-medium text-neutral-600 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]">← 返回销售送货单列表</Link>;
}
export function DeliveryLoadError({ appName, email }: { appName: string; email: string }) {
  return <SalesDeliveryNoteShell appName={appName} title="销售送货单" description={email}>
    <p role="alert" className="text-sm text-red-700">{SALES_DELIVERY_NOTE_LOAD_ERROR}</p>
  </SalesDeliveryNoteShell>;
}
