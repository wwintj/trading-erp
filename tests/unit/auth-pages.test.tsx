import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("@/lib/auth-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/lib/auth-flow", () => ({
  signInWithEmail: vi.fn(),
  signOutCurrentSession: vi.fn(),
}));

vi.mock("@/lib/password-change-flow", () => ({
  changeCurrentPassword: vi.fn(),
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import AccountPage from "@/app/account/page";
import DashboardPage from "@/app/dashboard/page";
import LoginPage from "@/app/login/page";
import Home from "@/app/page";

describe("authentication pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form without deferred account-management links", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const html = renderToStaticMarkup(await LoginPage());

    expect(html).toContain("Email");
    expect(html).toContain("Password");
    expect(html).toContain("Sign In");
    expect(html).not.toContain("Create account");
    expect(html).not.toContain("Forgot password");
  });

  it("redirects an unauthenticated dashboard request to login", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects an unauthenticated account request to login", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects an authenticated visitor away from login", async () => {
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "user-id" } });

    await expect(LoginPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("routes the root page according to authentication state", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null).mockResolvedValueOnce({
      user: { id: "user-id" },
    });

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders the authenticated dashboard with minimal user information", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      session: {
        id: "session-id",
        userId: "user-id",
        token: "session-token",
        expiresAt: new Date("2026-09-04T00:00:00.000Z"),
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      },
      user: {
        id: "user-id",
        name: "Admin User",
        email: "admin@example.com",
        emailVerified: true,
        image: null,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
        role: "admin",
        banned: false,
        banReason: null,
        banExpires: null,
      },
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Welcome, Admin User");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("admin");
    expect(html).toContain("Sign Out");
    expect(html).toContain("Account / Change Password");
  });

  it("renders the account page and password bounds for an authenticated user", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: {
        id: "user-id",
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
      },
    });

    const html = renderToStaticMarkup(await AccountPage());

    expect(html).toContain("Change Password");
    expect(html).toContain("Current password");
    expect(html).toContain("New password");
    expect(html).toContain("Confirm new password");
    expect(html).toContain('minLength="8"');
    expect(html).toContain('maxLength="128"');
  });
});
