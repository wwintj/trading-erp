import { describe, expect, it, vi } from "vitest";

import {
  INVALID_CREDENTIALS_MESSAGE,
  signInWithEmail,
  signOutCurrentSession,
} from "@/lib/auth-flow";

describe("authentication application flow", () => {
  it("returns the authenticated dashboard destination after sign-in", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });

    await expect(
      signInWithEmail(" admin@example.com ", "a sufficiently long password", signIn),
    ).resolves.toEqual({ ok: true, redirectTo: "/dashboard" });
    expect(signIn).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "a sufficiently long password",
    });
  });

  it("returns a generic error for invalid credentials", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: { message: "User does not exist" } });

    const result = await signInWithEmail("missing@example.com", "invalid password", signIn);

    expect(result).toEqual({ ok: false, message: INVALID_CREDENTIALS_MESSAGE });
    expect(result.message).not.toContain("exist");
  });

  it("ends the authenticated flow through the auth client", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await expect(signOutCurrentSession(signOut)).resolves.toEqual({
      ok: true,
      redirectTo: "/login",
    });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
