import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "仪表盘",
};

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();
  const role = session.user.role ?? "user";
  const roleLabel = role === "admin" ? "管理员" : "用户";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-neutral-500">{APP_NAME}</p>
              <CardTitle>欢迎，{session.user.name}</CardTitle>
            </div>
            <SignOutButton />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-neutral-500">邮箱</dt>
              <dd>{session.user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">角色</dt>
              <dd>{roleLabel}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/purchase-contracts">采购合同</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/products">产品</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/suppliers">供应商</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/company">公司信息</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account">账户 / 修改密码</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
