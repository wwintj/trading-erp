import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SupplierForm } from "@/components/supplier/supplier-form";
import { SupplierShell } from "@/components/supplier/supplier-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import type { SupplierInput } from "@/lib/supplier";
import { getSupplierById } from "@/lib/supplier.server";

export const metadata: Metadata = {
  title: "Supplier",
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
        title="Supplier"
        description={session.user.email}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/suppliers">Back to Suppliers</Link>
          </Button>
        }
      >
        <p role="alert" className="text-sm text-red-700">
          Supplier information is temporarily unavailable.
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
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/suppliers">Back to Suppliers</Link>
        </Button>
      }
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
    ["Supplier code / 供应商代码", supplier.code],
    ["Legal name / 公司全称", supplier.legalName],
    ["Short name / 公司简称", supplier.shortName],
    ["Unified social credit code / 统一社会信用代码", supplier.unifiedCreditCode],
    ["Contact name / 联系人", supplier.contactName],
    ["Phone / 电话", supplier.phone],
    ["Email / 邮箱", supplier.email],
    ["Address / 地址", supplier.address],
    ["Bank name / 开户行", supplier.bankName],
    ["Bank account / 银行账号", supplier.bankAccount],
    ["Notes / 备注", supplier.notes],
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
