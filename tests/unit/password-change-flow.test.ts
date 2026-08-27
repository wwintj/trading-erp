import { describe, expect, it, vi } from "vitest";

import {
  changeCurrentPassword,
  PASSWORD_CHANGE_ERROR_MESSAGE,
  PASSWORD_CHANGE_SUCCESS_MESSAGE,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/lib/password-change-flow";

describe("change-password application flow", () => {
  it("rejects mismatched confirmation without calling Better Auth", async () => {
    const changePassword = vi.fn();

    await expect(
      changeCurrentPassword("current password", "new password", "different password", changePassword),
    ).resolves.toEqual({ ok: false, message: PASSWORD_MISMATCH_MESSAGE });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("returns visible success feedback and revokes other sessions", async () => {
    const changePassword = vi.fn().mockResolvedValue({ error: null });

    await expect(
      changeCurrentPassword(
        "current password",
        "new password",
        "new password",
        changePassword,
      ),
    ).resolves.toEqual({ ok: true, message: PASSWORD_CHANGE_SUCCESS_MESSAGE });
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "current password",
      newPassword: "new password",
      revokeOtherSessions: true,
    });
  });

  it("returns a generic failure without exposing Better Auth details", async () => {
    const changePassword = vi.fn().mockResolvedValue({
      error: { message: "Incorrect current password for account id 123" },
    });

    const result = await changeCurrentPassword(
      "wrong password",
      "new password",
      "new password",
      changePassword,
    );

    expect(result).toEqual({ ok: false, message: PASSWORD_CHANGE_ERROR_MESSAGE });
    expect(result.message).not.toContain("account id");
  });

  it("enforces the 8–128 character password bounds before submission", async () => {
    const changePassword = vi.fn().mockResolvedValue({ error: null });

    await expect(
      changeCurrentPassword("current password", "a".repeat(7), "a".repeat(7), changePassword),
    ).resolves.toEqual({ ok: false, message: PASSWORD_LENGTH_MESSAGE });
    await expect(
      changeCurrentPassword("current password", "a".repeat(129), "a".repeat(129), changePassword),
    ).resolves.toEqual({ ok: false, message: PASSWORD_LENGTH_MESSAGE });
    expect(changePassword).not.toHaveBeenCalled();

    await changeCurrentPassword(
      "current password",
      "a".repeat(PASSWORD_MIN_LENGTH),
      "a".repeat(PASSWORD_MIN_LENGTH),
      changePassword,
    );
    await changeCurrentPassword(
      "current password",
      "a".repeat(PASSWORD_MAX_LENGTH),
      "a".repeat(PASSWORD_MAX_LENGTH),
      changePassword,
    );
    expect(changePassword).toHaveBeenCalledTimes(2);
  });
});
