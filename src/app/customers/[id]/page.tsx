import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CustomerForm } from "@/components/customer/customer-form";
import { CustomerShell } from "@/components/customer/customer-shell";
import { getCurrentSession } from "@/lib/auth-session";
import type { CustomerInput } from "@/lib/customer";
import { getCustomerById } from "@/lib/customer.server";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "客户",
};

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const { APP_NAME } = getServerEnv();

  let customer;
  try {
    customer = await getCustomerById(id);
  } catch {
    return (
      <CustomerShell
        appName={APP_NAME}
        title="客户"
        description={session.user.email}
        actions={<CustomerListLink />}
      >
        <p role="alert" className="text-sm text-red-700">
          客户信息暂时无法加载，请稍后重试。
        </p>
      </CustomerShell>
    );
  }

  if (!customer) {
    notFound();
  }

  const canEdit = session.user.role === "admin";

  return (
    <CustomerShell
      appName={APP_NAME}
      title={customer.code}
      description={customer.legalName}
      actions={<CustomerListLink />}
    >
      {canEdit ? (
        <CustomerForm customerId={customer.id} initialValues={customer} />
      ) : (
        <CustomerDetails customer={customer} />
      )}
    </CustomerShell>
  );
}

function CustomerDetails({ customer }: { customer: CustomerInput }) {
  const fields = [
    ["客户代码", customer.code],
    ["公司全称", customer.legalName],
    ["公司简称", customer.shortName],
    ["统一社会信用代码", customer.unifiedCreditCode],
    ["联系人", customer.contactName],
    ["电话", customer.phone],
    ["邮箱", customer.email],
    ["地址", customer.address],
    ["默认收货人", customer.defaultDeliveryContactName],
    ["默认收货电话", customer.defaultDeliveryPhone],
    ["默认收货地址", customer.defaultDeliveryAddress],
    ["备注", customer.notes],
  ];

  return (
    <dl className="grid gap-5 text-sm sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="space-y-1">
          <dt className="font-medium text-neutral-500">{label}</dt>
          <dd className="whitespace-pre-wrap">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function CustomerListLink() {
  return (
    <Link
      href="/customers"
      className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
    >
      ← 返回客户列表
    </Link>
  );
}
