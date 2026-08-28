import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SupplierForm } from "@/components/supplier/supplier-form";
import { SupplierShell } from "@/components/supplier/supplier-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import type { SupplierInput } from "@/lib/supplier";

export const metadata: Metadata = {
  title: "New Supplier",
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
      title="New Supplier"
      description={session.user.email}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/suppliers">Back to Suppliers</Link>
        </Button>
      }
    >
      <SupplierForm supplierId={null} initialValues={emptySupplier} />
    </SupplierShell>
  );
}
