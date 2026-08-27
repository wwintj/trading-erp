import { authClient } from "@/lib/auth-client";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_CHANGE_SUCCESS_MESSAGE = "Password changed successfully.";
export const PASSWORD_CHANGE_ERROR_MESSAGE =
  "Unable to change password. Check your current password and try again.";
export const PASSWORD_MISMATCH_MESSAGE = "New passwords do not match.";
export const PASSWORD_LENGTH_MESSAGE = "New password must be between 8 and 128 characters.";

type AuthClientResult = {
  error?: unknown;
};

export type ChangePassword = (input: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: true;
}) => Promise<AuthClientResult>;

const defaultChangePassword: ChangePassword = (input) => authClient.changePassword(input);

export async function changeCurrentPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  changePassword: ChangePassword = defaultChangePassword,
) {
  if (!currentPassword) {
    return { ok: false as const, message: "Current password is required." };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false as const, message: PASSWORD_MISMATCH_MESSAGE };
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
    return { ok: false as const, message: PASSWORD_LENGTH_MESSAGE };
  }

  try {
    const result = await changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    if (result.error) {
      return { ok: false as const, message: PASSWORD_CHANGE_ERROR_MESSAGE };
    }

    return { ok: true as const, message: PASSWORD_CHANGE_SUCCESS_MESSAGE };
  } catch {
    return { ok: false as const, message: PASSWORD_CHANGE_ERROR_MESSAGE };
  }
}
