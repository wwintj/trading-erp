import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  listSuppliers: vi.fn(),
  getSupplierById: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/lib/supplier.server", () => ({
  listSuppliers: mocks.listSuppliers,
  getSupplierById: mocks.getSupplierById,
}));

vi.mock("@/app/suppliers/actions", () => ({
  saveSupplierAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ replace: vi.fn() }),
}));

import SupplierPage from "@/app/suppliers/[id]/page";
import NewSupplierPage from "@/app/suppliers/new/page";
import SuppliersPage from "@/app/suppliers/page";

const adminSession = {
  user: { email: "admin@example.com", role: "admin" },
};
const userSession = {
  user: { email: "user@example.com", role: "user" },
};

const supplier = {
  id: "supplier-1",
  code: "HYS",
  legalName: "惠州市华业升塑胶制品有限公司",
  shortName: "华业升",
  unifiedCreditCode: null,
  contactName: "Test Contact",
  phone: "123456",
  email: null,
  address: null,
  bankName: null,
  bankAccount: null,
  notes: null,
  createdAt: new Date("2026-08-28T00:00:00.000Z"),
  updatedAt: new Date("2026-08-28T00:00:00.000Z"),
};

describe("Supplier pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["list", () => SuppliersPage()],
    ["create", () => NewSupplierPage()],
    [
      "detail",
      () => SupplierPage({ params: Promise.resolve({ id: "supplier-1" }) }),
    ],
  ])("redirects unauthenticated %s requests to login", async (_name, render) => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.listSuppliers).not.toHaveBeenCalled();
    expect(mocks.getSupplierById).not.toHaveBeenCalled();
  });

  it("renders an empty list and New Supplier control for an admin", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.listSuppliers.mockResolvedValue([]);

    const html = renderToStaticMarkup(await SuppliersPage());

    expect(html).toContain("暂无供应商。");
    expect(html).toContain("新建供应商");
    expect(html).toContain("返回仪表盘");
    expect(html).toContain('href="/suppliers/new"');
  });

  it("renders a safe localized list error", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listSuppliers.mockRejectedValue(new Error("MySQL connection details"));

    const html = renderToStaticMarkup(await SuppliersPage());

    expect(html).toContain("供应商信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("MySQL");
  });

  it("redirects a user away from the create page to the read-only list", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);

    await expect(NewSupplierPage()).rejects.toThrow(
      "NEXT_REDIRECT:/suppliers",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/suppliers");
  });

  it("renders the deterministic Supplier list and detail links", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listSuppliers.mockResolvedValue([
      {
        id: "supplier-1",
        code: "HYS",
        legalName: "惠州市华业升塑胶制品有限公司",
        shortName: "华业升",
        contactName: "First Contact",
        phone: "10000",
      },
      {
        id: "supplier-2",
        code: "ZZZ",
        legalName: "Zeta Supplier",
        shortName: null,
        contactName: null,
        phone: null,
      },
    ]);

    const html = renderToStaticMarkup(await SuppliersPage());

    expect(html.indexOf("HYS")).toBeLessThan(html.indexOf("ZZZ"));
    expect(html).toContain("惠州市华业升塑胶制品有限公司");
    expect(html).toContain("First Contact");
    expect(html).toContain('href="/suppliers/supplier-1"');
    expect(html).toContain("供应商代码");
    expect(html).toContain("公司全称");
    expect(html).toContain("公司简称");
    expect(html).toContain("联系人");
    expect(html).toContain("电话");
    expect(html).not.toContain("新建供应商");
    expect(html).toContain("hover:bg-neutral-50");
    expect(html).toContain("focus-within:bg-neutral-50");
    expect(html).toContain("hover:text-[#15803D]");
    expect(html).toContain("focus-visible:ring-[#16A34A]");
    expect(html).not.toContain("hover:underline");
  });

  it("renders Supplier values read-only for a user", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getSupplierById.mockResolvedValue(supplier);

    const html = renderToStaticMarkup(
      await SupplierPage({ params: Promise.resolve({ id: supplier.id }) }),
    );

    expect(html).toContain("HYS");
    expect(html).toContain("惠州市华业升塑胶制品有限公司");
    expect(html).toContain("Test Contact");
    expect(html).not.toContain("Save Supplier");
  });

  it("uses normal Next.js not-found behavior for a missing Supplier", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getSupplierById.mockResolvedValue(null);

    await expect(
      SupplierPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("renders Create Supplier with the shared primary Button styling", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);

    const html = renderToStaticMarkup(await NewSupplierPage());
    const createButton = html.match(
      /<button[^>]*>Create Supplier<\/button>/,
    )?.[0];

    expect(createButton).toContain("bg-[#16A34A]");
    expect(createButton).toContain("hover:bg-[#15803D]");
    expect(createButton).toContain("text-white");
    expect(createButton).not.toContain("bg-white");
  });
});
