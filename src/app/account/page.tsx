import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-neutral-500">{APP_NAME}</p>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>{session.user.email}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
