import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SupplierShell } from "@/components/supplier/supplier-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import { listSuppliers } from "@/lib/supplier.server";

export const metadata: Metadata = {
  title: "供应商",
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
        <Link href="/dashboard">返回仪表盘</Link>
      </Button>
      {canEdit ? (
        <Button size="sm" asChild>
          <Link href="/suppliers/new">新建供应商</Link>
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
        title="供应商"
        description={session.user.email}
        actions={actions}
      >
        <p role="alert" className="text-sm text-red-700">
          供应商信息暂时无法加载，请稍后重试。
        </p>
      </SupplierShell>
    );
  }

  return (
    <SupplierShell
      appName={APP_NAME}
      title="供应商"
      description={session.user.email}
      actions={actions}
    >
      {suppliers.length === 0 ? (
        <p className="text-sm text-neutral-600">暂无供应商。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-3 py-3 font-medium">供应商代码</th>
                <th className="px-3 py-3 font-medium">公司全称</th>
                <th className="px-3 py-3 font-medium">公司简称</th>
                <th className="px-3 py-3 font-medium">联系人</th>
                <th className="px-3 py-3 font-medium">电话</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-b transition-colors last:border-b-0 hover:bg-neutral-50 focus-within:bg-neutral-50"
                >
                  <td className="px-3 py-3 font-medium">
                    <Link
                      className="cursor-pointer text-neutral-900 transition-colors hover:text-[#15803D] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
                      href={`/suppliers/${supplier.id}`}
                    >
                      {supplier.code}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      className="cursor-pointer text-neutral-900 transition-colors hover:text-[#15803D] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
                      href={`/suppliers/${supplier.id}`}
                    >
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
