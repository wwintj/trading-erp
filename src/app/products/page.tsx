import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductShell } from "@/components/product/product-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import { listProducts } from "@/lib/product.server";

export const metadata: Metadata = {
  title: "产品",
};

export default async function ProductsPage() {
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
          <Link href="/products/new">新建产品</Link>
        </Button>
      ) : null}
    </>
  );

  let products;
  try {
    products = await listProducts();
  } catch {
    return (
      <ProductShell
        appName={APP_NAME}
        title="产品"
        description={session.user.email}
        actions={actions}
      >
        <p role="alert" className="text-sm text-red-700">
          产品信息暂时无法加载，请稍后重试。
        </p>
      </ProductShell>
    );
  }

  return (
    <ProductShell
      appName={APP_NAME}
      title="产品"
      description={session.user.email}
      actions={actions}
    >
      {products.length === 0 ? (
        <p className="text-sm text-neutral-600">暂无产品。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-3 py-3 font-medium">产品代码</th>
                <th className="px-3 py-3 font-medium">产品名称</th>
                <th className="px-3 py-3 font-medium">规格/型号</th>
                <th className="px-3 py-3 font-medium">单位</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b transition-colors last:border-b-0 hover:bg-neutral-50 focus-within:bg-neutral-50"
                >
                  <td className="px-3 py-3 font-medium">
                    <ProductLink id={product.id}>{product.code}</ProductLink>
                  </td>
                  <td className="px-3 py-3">
                    <ProductLink id={product.id}>{product.name}</ProductLink>
                  </td>
                  <td className="px-3 py-3">
                    {product.specification ?? "—"}
                  </td>
                  <td className="px-3 py-3">{product.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProductShell>
  );
}

function ProductLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link
      className="cursor-pointer text-neutral-900 transition-colors hover:text-[#15803D] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
      href={`/products/${id}`}
    >
      {children}
    </Link>
  );
}
