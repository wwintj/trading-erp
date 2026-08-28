import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SupplierForm } from "@/components/supplier/supplier-form";
import { SupplierShell } from "@/components/supplier/supplier-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import type { SupplierInput } from "@/lib/supplier";
import { getSupplierById } from "@/lib/supplier.server";

export const metadata: Metadata = {
  title: "供应商",
};

export default async function SupplierPage({
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

  let supplier;
  try {
    supplier = await getSupplierById(id);
  } catch {
    return (
      <SupplierShell
        appName={APP_NAME}
        title="供应商"
        description={session.user.email}
        actions={
          <SupplierListLink />
        }
      >
        <p role="alert" className="text-sm text-red-700">
          供应商信息暂时无法加载，请稍后重试。
        </p>
      </SupplierShell>
    );
  }

  if (!supplier) {
    notFound();
  }

  const canEdit = session.user.role === "admin";

  return (
    <SupplierShell
      appName={APP_NAME}
      title={supplier.code}
      description={supplier.legalName}
      actions={<SupplierListLink />}
    >
      {canEdit ? (
        <SupplierForm supplierId={supplier.id} initialValues={supplier} />
      ) : (
        <SupplierDetails supplier={supplier} />
      )}
    </SupplierShell>
  );
}

function SupplierDetails({ supplier }: { supplier: SupplierInput }) {
  const fields = [
    ["供应商代码", supplier.code],
    ["公司全称", supplier.legalName],
    ["公司简称", supplier.shortName],
    ["统一社会信用代码", supplier.unifiedCreditCode],
    ["联系人", supplier.contactName],
    ["电话", supplier.phone],
    ["邮箱", supplier.email],
    ["地址", supplier.address],
    ["开户行", supplier.bankName],
    ["银行账号", supplier.bankAccount],
    ["备注", supplier.notes],
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

function SupplierListLink() {
  return (
    <Link
      href="/suppliers"
      className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
    >
      ← 返回供应商列表
    </Link>
  );
}
