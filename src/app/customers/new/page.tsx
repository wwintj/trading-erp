import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerForm } from "@/components/customer/customer-form";
import { CustomerShell } from "@/components/customer/customer-shell";
import { getCurrentSession } from "@/lib/auth-session";
import type { CustomerInput } from "@/lib/customer";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "新建客户",
};

const emptyCustomer: CustomerInput = {
  code: "",
  legalName: "",
  shortName: null,
  unifiedCreditCode: null,
  contactName: null,
  phone: null,
  email: null,
  address: null,
  defaultDeliveryContactName: null,
  defaultDeliveryPhone: null,
  defaultDeliveryAddress: null,
  notes: null,
};

export default async function NewCustomerPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/customers");
  }

  const { APP_NAME } = getServerEnv();

  return (
    <CustomerShell
      appName={APP_NAME}
      title="新建客户"
      description={session.user.email}
      actions={<CustomerListLink />}
    >
      <CustomerForm customerId={null} initialValues={emptyCustomer} />
    </CustomerShell>
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
