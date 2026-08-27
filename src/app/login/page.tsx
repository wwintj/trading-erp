import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  const { APP_NAME } = getServerEnv();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-medium text-neutral-500">{APP_NAME}</p>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Authentication will be connected in the next project step.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                disabled
              />
            </div>
            <Button className="w-full" type="submit" disabled>
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
