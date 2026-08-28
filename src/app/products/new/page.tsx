import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductForm } from "@/components/product/product-form";
import { ProductShell } from "@/components/product/product-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import type { ProductInput } from "@/lib/product";

export const metadata: Metadata = {
  title: "新建产品",
};

const emptyProduct: ProductInput = {
  code: "",
  name: "",
  specification: null,
  unit: "",
  notes: null,
};

export default async function NewProductPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/products");
  }

  const { APP_NAME } = getServerEnv();

  return (
    <ProductShell
      appName={APP_NAME}
      title="新建产品"
      description={session.user.email}
      actions={<ProductListLink />}
    >
      <ProductForm productId={null} initialValues={emptyProduct} />
    </ProductShell>
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
