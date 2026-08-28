import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SupplierForm } from "@/components/supplier/supplier-form";
import { SupplierShell } from "@/components/supplier/supplier-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import type { SupplierInput } from "@/lib/supplier";

export const metadata: Metadata = {
  title: "新建供应商",
};

const emptySupplier: SupplierInput = {
  code: "",
  legalName: "",
  shortName: null,
  unifiedCreditCode: null,
  contactName: null,
  phone: null,
  email: null,
  address: null,
  bankName: null,
  bankAccount: null,
  notes: null,
};

export default async function NewSupplierPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/suppliers");
  }

  const { APP_NAME } = getServerEnv();

  return (
    <SupplierShell
      appName={APP_NAME}
      title="新建供应商"
      description={session.user.email}
      actions={
        <Link
          href="/suppliers"
          className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
        >
          ← 返回供应商列表
        </Link>
      }
    >
      <SupplierForm supplierId={null} initialValues={emptySupplier} />
    </SupplierShell>
  );
}
