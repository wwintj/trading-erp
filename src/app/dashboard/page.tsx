import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();
  const role = session.user.role ?? "user";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-neutral-500">{APP_NAME}</p>
              <CardTitle>Welcome, {session.user.name}</CardTitle>
            </div>
            <SignOutButton />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-neutral-500">Email</dt>
              <dd>{session.user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Role</dt>
              <dd>{role}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/products">产品</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/suppliers">Suppliers</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/company">Company</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account">Account / Change Password</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
