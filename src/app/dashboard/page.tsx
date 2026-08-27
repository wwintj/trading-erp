import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  const { APP_NAME } = getServerEnv();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <p className="text-sm font-medium text-neutral-500">{APP_NAME}</p>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">Project bootstrap is ready for development.</p>
        </CardContent>
      </Card>
    </main>
  );
}
