"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutCurrentSession } from "@/lib/auth-flow";

export const SIGN_OUT_LABEL = "退出登录";
export const SIGN_OUT_PENDING_LABEL = "正在退出…";
export const SIGN_OUT_ERROR_MESSAGE = "退出登录失败，请稍后重试。";

export function getSignOutButtonLabel(pending: boolean) {
  return pending ? SIGN_OUT_PENDING_LABEL : SIGN_OUT_LABEL;
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSignOut() {
    setPending(true);
    setError(undefined);

    const result = await signOutCurrentSession();

    if (!result.ok) {
      setError(SIGN_OUT_ERROR_MESSAGE);
      setPending(false);
      return;
    }

    router.replace(result.redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" size="sm" onClick={handleSignOut} disabled={pending}>
        {getSignOutButtonLabel(pending)}
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
