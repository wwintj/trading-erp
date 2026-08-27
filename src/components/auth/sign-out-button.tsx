"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutCurrentSession } from "@/lib/auth-flow";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSignOut() {
    setPending(true);
    setError(undefined);

    const result = await signOutCurrentSession();

    if (!result.ok) {
      setError("Unable to sign out. Please try again.");
      setPending(false);
      return;
    }

    router.replace(result.redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" size="sm" onClick={handleSignOut} disabled={pending}>
        {pending ? "Signing out…" : "Sign Out"}
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
