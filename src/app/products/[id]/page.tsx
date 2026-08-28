import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/product/product-form";
import { ProductShell } from "@/components/product/product-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import type { ProductInput } from "@/lib/product";
import { getProductById } from "@/lib/product.server";

export const metadata: Metadata = {
  title: "产品",
};

export default async function ProductPage({
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

  let product;
  try {
    product = await getProductById(id);
  } catch {
    return (
      <ProductShell
        appName={APP_NAME}
        title="产品"
        description={session.user.email}
        actions={<ProductListLink />}
      >
        <p role="alert" className="text-sm text-red-700">
          产品信息暂时无法加载，请稍后重试。
        </p>
      </ProductShell>
    );
  }

  if (!product) {
    notFound();
  }

  const canEdit = session.user.role === "admin";

  return (
    <ProductShell
      appName={APP_NAME}
      title={product.code}
      description={product.name}
      actions={<ProductListLink />}
    >
      {canEdit ? (
        <ProductForm productId={product.id} initialValues={product} />
      ) : (
        <ProductDetails product={product} />
      )}
    </ProductShell>
  );
}

function ProductDetails({ product }: { product: ProductInput }) {
  const fields = [
    ["产品代码", product.code],
    ["产品名称", product.name],
    ["规格/型号", product.specification],
    ["单位", product.unit],
    ["备注", product.notes],
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

function ProductListLink() {
  return (
    <Link
      href="/products"
      className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
    >
      ← 返回产品列表
    </Link>
  );
}
