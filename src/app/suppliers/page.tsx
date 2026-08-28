import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SupplierShell } from "@/components/supplier/supplier-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import { listSuppliers } from "@/lib/supplier.server";

export const metadata: Metadata = {
  title: "Suppliers",
};

export default async function SuppliersPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();
  const canEdit = session.user.role === "admin";
  const actions = (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
      {canEdit ? (
        <Button size="sm" asChild>
          <Link href="/suppliers/new">New Supplier</Link>
        </Button>
      ) : null}
    </>
  );

  let suppliers;
  try {
    suppliers = await listSuppliers();
  } catch {
    return (
      <SupplierShell
        appName={APP_NAME}
        title="Suppliers"
        description={session.user.email}
        actions={actions}
      >
        <p role="alert" className="text-sm text-red-700">
          Supplier information is temporarily unavailable.
        </p>
      </SupplierShell>
    );
  }

  return (
    <SupplierShell
      appName={APP_NAME}
      title="Suppliers"
      description={session.user.email}
      actions={actions}
    >
      {suppliers.length === 0 ? (
        <p className="text-sm text-neutral-600">No suppliers have been created yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Legal name</th>
                <th className="px-3 py-3 font-medium">Short name</th>
                <th className="px-3 py-3 font-medium">Contact</th>
                <th className="px-3 py-3 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b last:border-b-0">
                  <td className="px-3 py-3 font-medium">
                    <Link className="underline-offset-4 hover:underline" href={`/suppliers/${supplier.id}`}>
                      {supplier.code}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link className="underline-offset-4 hover:underline" href={`/suppliers/${supplier.id}`}>
                      {supplier.legalName}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{supplier.shortName ?? "—"}</td>
                  <td className="px-3 py-3">{supplier.contactName ?? "—"}</td>
                  <td className="px-3 py-3">{supplier.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SupplierShell>
  );
}
