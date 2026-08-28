import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  listProducts: vi.fn(),
  getProductById: vi.fn(),
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

vi.mock("@/lib/product.server", () => ({
  listProducts: mocks.listProducts,
  getProductById: mocks.getProductById,
}));

vi.mock("@/app/products/actions", () => ({
  saveProductAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ replace: vi.fn() }),
}));

import ProductPage from "@/app/products/[id]/page";
import NewProductPage from "@/app/products/new/page";
import ProductsPage from "@/app/products/page";

const adminSession = {
  user: { email: "admin@example.com", role: "admin" },
};
const userSession = {
  user: { email: "user@example.com", role: "user" },
};

const product = {
  id: "product-1",
  code: "WS-H42",
  name: "PVC热收缩套管",
  specification: null,
  unit: "米",
  notes: null,
  createdAt: new Date("2026-08-28T00:00:00.000Z"),
  updatedAt: new Date("2026-08-28T00:00:00.000Z"),
};

describe("Product pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["list", () => ProductsPage()],
    ["create", () => NewProductPage()],
    [
      "detail",
      () => ProductPage({ params: Promise.resolve({ id: "product-1" }) }),
    ],
  ])("redirects unauthenticated %s requests to login", async (_name, render) => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.listProducts).not.toHaveBeenCalled();
    expect(mocks.getProductById).not.toHaveBeenCalled();
  });

  it("renders a Chinese empty state and create control for an admin", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.listProducts.mockResolvedValue([]);

    const html = renderToStaticMarkup(await ProductsPage());

    expect(html).toContain("暂无产品。");
    expect(html).toContain("新建产品");
    expect(html).toContain("返回仪表盘");
    expect(html).toContain('href="/products/new"');
  });

  it("renders a safe Chinese list error", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listProducts.mockRejectedValue(new Error("MySQL connection details"));

    const html = renderToStaticMarkup(await ProductsPage());

    expect(html).toContain("产品信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("MySQL");
  });

  it("redirects a user away from the create page to the read-only list", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);

    await expect(NewProductPage()).rejects.toThrow("NEXT_REDIRECT:/products");
    expect(mocks.redirect).toHaveBeenCalledWith("/products");
  });

  it("renders ordered Product links, Chinese headers, and accepted table UX", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listProducts.mockResolvedValue([
      {
        id: "product-1",
        code: "AA-100",
        name: "A 产品",
        specification: "10mm",
        unit: "件",
      },
      {
        id: "product-2",
        code: "WS-H42",
        name: "PVC热收缩套管",
        specification: null,
        unit: "米",
      },
    ]);

    const html = renderToStaticMarkup(await ProductsPage());

    expect(html.indexOf("AA-100")).toBeLessThan(html.indexOf("WS-H42"));
    expect(html).toContain("PVC热收缩套管");
    expect(html).toContain('href="/products/product-2"');
    expect(html).toContain("产品代码");
    expect(html).toContain("产品名称");
    expect(html).toContain("规格/型号");
    expect(html).toContain("单位");
    expect(html).not.toContain("新建产品");
    expect(html).toContain("hover:bg-neutral-50");
    expect(html).toContain("focus-within:bg-neutral-50");
    expect(html).toContain("hover:text-[#15803D]");
    expect(html).toContain("focus-visible:ring-[#16A34A]");
    expect(html).not.toContain("hover:underline");
  });

  it("renders Product values read-only for a user", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getProductById.mockResolvedValue(product);

    const html = renderToStaticMarkup(
      await ProductPage({ params: Promise.resolve({ id: product.id }) }),
    );

    expect(html).toContain("WS-H42");
    expect(html).toContain("PVC热收缩套管");
    expect(html).toContain("产品代码");
    expect(html).toContain("产品名称");
    expect(html).toContain("← 返回产品列表");
    expect(html).not.toContain("保存产品");
  });

  it("renders a safe Chinese detail-load error", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getProductById.mockRejectedValue(new Error("Prisma internal details"));

    const html = renderToStaticMarkup(
      await ProductPage({ params: Promise.resolve({ id: product.id }) }),
    );

    expect(html).toContain("产品信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("Prisma");
  });

  it("uses normal Next.js not-found behavior for a missing Product", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getProductById.mockResolvedValue(null);

    await expect(
      ProductPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("renders localized create actions with the shared primary Button styling", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);

    const html = renderToStaticMarkup(await NewProductPage());
    const createButton = html.match(/<button[^>]*>创建产品<\/button>/)?.[0];

    expect(html).toContain("新建产品");
    expect(html).toContain("产品代码");
    expect(html).toContain("产品名称");
    expect(html).toContain("规格/型号");
    expect(html).toContain("单位");
    expect(html).toContain("备注");
    expect(html).toContain("← 返回产品列表");
    expect(html).toContain(">取消</a>");
    expect(html.match(/← 返回产品列表/g)).toHaveLength(1);
    expect(createButton).toContain("bg-[#16A34A]");
    expect(createButton).toContain("hover:bg-[#15803D]");
    expect(createButton).toContain("text-white");
    expect(createButton).not.toContain("bg-white");
  });

  it("renders localized edit actions without duplicating the primary action", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.getProductById.mockResolvedValue(product);

    const html = renderToStaticMarkup(
      await ProductPage({ params: Promise.resolve({ id: product.id }) }),
    );

    expect(html).toContain("← 返回产品列表");
    expect(html).toContain(">取消</a>");
    expect(html.match(/保存产品/g)).toHaveLength(1);
  });
});
