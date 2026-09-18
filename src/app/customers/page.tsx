import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerShell } from "@/components/customer/customer-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { listCustomers } from "@/lib/customer.server";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "客户",
};

export default async function CustomersPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();
  const canEdit = session.user.role === "admin";
  const actions = (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">返回仪表盘</Link>
      </Button>
      {canEdit ? (
        <Button size="sm" asChild>
          <Link href="/customers/new">新建客户</Link>
        </Button>
      ) : null}
    </>
  );

  let customers;
  try {
    customers = await listCustomers();
  } catch {
    return (
      <CustomerShell
        appName={APP_NAME}
        title="客户"
        description={session.user.email}
        actions={actions}
      >
        <p role="alert" className="text-sm text-red-700">
          客户信息暂时无法加载，请稍后重试。
        </p>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell
      appName={APP_NAME}
      title="客户"
      description={session.user.email}
      actions={actions}
    >
      {customers.length === 0 ? (
        <p className="text-sm text-neutral-600">暂无客户。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-3 py-3 font-medium">客户代码</th>
                <th className="px-3 py-3 font-medium">公司全称</th>
                <th className="px-3 py-3 font-medium">公司简称</th>
                <th className="px-3 py-3 font-medium">联系人</th>
                <th className="px-3 py-3 font-medium">电话</th>
                <th className="px-3 py-3 font-medium">默认收货人</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b transition-colors last:border-b-0 hover:bg-neutral-50 focus-within:bg-neutral-50"
                >
                  <td className="px-3 py-3 font-medium">
                    <CustomerDetailLink customer={customer} value={customer.code} />
                  </td>
                  <td className="px-3 py-3">
                    <CustomerDetailLink
                      customer={customer}
                      value={customer.legalName}
                    />
                  </td>
                  <td className="px-3 py-3">{customer.shortName ?? "—"}</td>
                  <td className="px-3 py-3">{customer.contactName ?? "—"}</td>
                  <td className="px-3 py-3">{customer.phone ?? "—"}</td>
                  <td className="px-3 py-3">
                    {customer.defaultDeliveryContactName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CustomerShell>
  );
}

function CustomerDetailLink({
  customer,
  value,
}: {
  customer: { id: string };
  value: string;
}) {
  return (
    <Link
      className="cursor-pointer text-neutral-900 transition-colors hover:text-[#15803D] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
      href={`/customers/${customer.id}`}
    >
      {value}
    </Link>
  );
}
