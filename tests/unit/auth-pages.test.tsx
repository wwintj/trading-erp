import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getCompanySingleton: vi.fn(),
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

vi.mock("@/lib/company.server", () => ({
  getCompanySingleton: mocks.getCompanySingleton,
}));

vi.mock("@/app/company/actions", () => ({
  saveCompanyAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import AccountPage from "@/app/account/page";
import CompanyPage from "@/app/company/page";
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

  it("redirects an unauthenticated company request to login", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(CompanyPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.getCompanySingleton).not.toHaveBeenCalled();
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
    expect(html).toContain('href="/products"');
    expect(html).toContain("产品");
    expect(html).toContain('href="/suppliers"');
    expect(html).toContain('href="/company"');
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

  it("renders the create form when no Company exists for an admin", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { email: "admin@example.com", role: "admin" },
    });
    mocks.getCompanySingleton.mockResolvedValue(null);

    const html = renderToStaticMarkup(await CompanyPage());

    expect(html).toContain("Create the single Company record");
    expect(html).toContain("Legal name / 公司全称");
    expect(html).toContain("Unified social credit code / 统一社会信用代码");
    expect(html).toContain("Create Company");
  });

  it("renders existing Company values read-only for a user", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { email: "user@example.com", role: "user" },
    });
    mocks.getCompanySingleton.mockResolvedValue({
      id: "company-1",
      legalName: "天津纬信科技有限公司",
      shortName: "纬信科技",
      unifiedCreditCode: null,
      contactName: "Test Contact",
      phone: null,
      email: "company@example.com",
      address: null,
      bankName: null,
      bankAccount: null,
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
      updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    });

    const html = renderToStaticMarkup(await CompanyPage());

    expect(html).toContain("天津纬信科技有限公司");
    expect(html).toContain("纬信科技");
    expect(html).toContain("company@example.com");
    expect(html).not.toContain("Save Company");
    expect(html).not.toContain("Create Company");
  });

  it("renders Save Company as the primary action for an admin", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      user: { email: "admin@example.com", role: "admin" },
    });
    mocks.getCompanySingleton.mockResolvedValue({
      id: "company-1",
      legalName: "天津纬信科技有限公司",
      shortName: null,
      unifiedCreditCode: null,
      contactName: null,
      phone: null,
      email: null,
      address: null,
      bankName: null,
      bankAccount: null,
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
      updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    });

    const html = renderToStaticMarkup(await CompanyPage());
    const saveButton = html.match(/<button[^>]*>Save Company<\/button>/)?.[0];

    expect(saveButton).toContain("bg-[#16A34A]");
    expect(saveButton).toContain("hover:bg-[#15803D]");
    expect(saveButton).toContain("active:bg-[#15803D]");
    expect(saveButton).toContain("focus-visible:ring-[#16A34A]");
    expect(saveButton).toContain("text-white");
    expect(saveButton).not.toContain("bg-white");
    expect(saveButton).not.toContain("bg-[#0F62FE]");
  });
});
