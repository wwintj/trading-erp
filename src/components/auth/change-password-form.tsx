"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeCurrentPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-change-flow";

type Feedback = {
  kind: "error" | "success";
  message: string;
};

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    setPending(true);
    setFeedback(undefined);

    const result = await changeCurrentPassword(currentPassword, newPassword, confirmPassword);

    setFeedback({
      kind: result.ok ? "success" : "error",
      message: result.message,
    });
    setPending(false);

    if (result.ok) {
      form.reset();
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
          disabled={pending}
        />
      </div>
      <p
        className={feedback?.kind === "error" ? "min-h-5 text-sm text-red-700" : "min-h-5 text-sm text-green-700"}
        role={feedback?.kind === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {feedback?.message}
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Changing password…" : "Change Password"}
      </Button>
    </form>
  );
}
