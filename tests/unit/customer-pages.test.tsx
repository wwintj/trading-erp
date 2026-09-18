import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  listCustomers: vi.fn(),
  getCustomerById: vi.fn(),
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

vi.mock("@/lib/customer.server", () => ({
  listCustomers: mocks.listCustomers,
  getCustomerById: mocks.getCustomerById,
}));

vi.mock("@/app/customers/actions", () => ({
  saveCustomerAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ replace: vi.fn() }),
}));

import CustomerPage from "@/app/customers/[id]/page";
import NewCustomerPage from "@/app/customers/new/page";
import CustomersPage from "@/app/customers/page";

const adminSession = {
  user: { email: "admin@example.com", role: "admin" },
};
const userSession = {
  user: { email: "user@example.com", role: "user" },
};

const customer = {
  id: "customer-1",
  code: "CUST001",
  legalName: "测试客户有限公司",
  shortName: "测试客户",
  unifiedCreditCode: "911234567890123456",
  contactName: "王经理",
  phone: "010-10000",
  email: "sales@example.com",
  address: "公司注册地址\n二层",
  defaultDeliveryContactName: "张建英",
  defaultDeliveryPhone: "13800000000",
  defaultDeliveryAddress: "浙江仓库\n一号门",
  notes: "重要客户\n工作日送货",
  createdAt: new Date("2026-09-19T00:00:00.000Z"),
  updatedAt: new Date("2026-09-19T00:00:00.000Z"),
};

describe("Customer pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["list", () => CustomersPage()],
    ["create", () => NewCustomerPage()],
    [
      "detail",
      () => CustomerPage({ params: Promise.resolve({ id: "customer-1" }) }),
    ],
  ])("redirects unauthenticated %s requests to login", async (_name, render) => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.listCustomers).not.toHaveBeenCalled();
    expect(mocks.getCustomerById).not.toHaveBeenCalled();
  });

  it("renders the empty state and create control for an admin", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.listCustomers.mockResolvedValue([]);

    const html = renderToStaticMarkup(await CustomersPage());

    expect(html).toContain("暂无客户。");
    expect(html).toContain("新建客户");
    expect(html).toContain('href="/customers/new"');
    expect(html).toContain("返回仪表盘");
  });

  it("renders the Customer table while hiding create controls from a user", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listCustomers.mockResolvedValue([
      {
        id: customer.id,
        code: customer.code,
        legalName: customer.legalName,
        shortName: customer.shortName,
        contactName: customer.contactName,
        phone: customer.phone,
        defaultDeliveryContactName: customer.defaultDeliveryContactName,
      },
    ]);

    const html = renderToStaticMarkup(await CustomersPage());

    expect(html).toContain("客户代码");
    expect(html).toContain("公司全称");
    expect(html).toContain("公司简称");
    expect(html).toContain("联系人");
    expect(html).toContain("电话");
    expect(html).toContain("默认收货人");
    expect(html).toContain("CUST001");
    expect(html).toContain("测试客户有限公司");
    expect(html).toContain("张建英");
    expect(html).toContain('href="/customers/customer-1"');
    expect(html).not.toContain("新建客户");
    expect(html).toContain("hover:bg-neutral-50");
    expect(html).not.toContain("hover:underline");
  });

  it("renders a safe localized list error", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listCustomers.mockRejectedValue(new Error("MySQL connection details"));

    const html = renderToStaticMarkup(await CustomersPage());

    expect(html).toContain("客户信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("MySQL");
  });

  it("redirects a user away from the create page", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);

    await expect(NewCustomerPage()).rejects.toThrow(
      "NEXT_REDIRECT:/customers",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/customers");
  });

  it("renders the sectioned create form and shared primary action", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);

    const html = renderToStaticMarkup(await NewCustomerPage());
    const createButton = html.match(/<button[^>]*>创建客户<\/button>/)?.[0];

    expect(html).toContain("新建客户");
    expect(html).toContain("← 返回客户列表");
    expect(html).toContain("基本信息");
    expect(html).toContain("联系信息");
    expect(html).toContain("默认收货信息");
    expect(html).toContain("其它");
    expect(html).toContain("客户代码");
    expect(html).toContain("公司全称");
    expect(html).toContain("默认收货人");
    expect(html).toContain("默认收货电话");
    expect(html).toContain("默认收货地址");
    expect(html).toContain('aria-describedby="customer-code-error"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain(">取消</a>");
    expect(createButton).toContain("bg-[#16A34A]");
    expect(createButton).toContain("hover:bg-[#15803D]");
  });

  it("renders Customer values read-only for a user", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getCustomerById.mockResolvedValue(customer);

    const html = renderToStaticMarkup(
      await CustomerPage({ params: Promise.resolve({ id: customer.id }) }),
    );

    expect(html).toContain("CUST001");
    expect(html).toContain("测试客户有限公司");
    expect(html).toContain("王经理");
    expect(html).toContain("张建英");
    expect(html).toContain("默认收货电话");
    expect(html).toContain("默认收货地址");
    expect(html).toContain("公司注册地址\n二层");
    expect(html).toContain("← 返回客户列表");
    expect(html).not.toContain("保存客户");
  });

  it("renders a safe localized detail load error", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getCustomerById.mockRejectedValue(new Error("internal SQL details"));

    const html = renderToStaticMarkup(
      await CustomerPage({ params: Promise.resolve({ id: customer.id }) }),
    );

    expect(html).toContain("客户信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("internal SQL details");
  });

  it("uses normal Next.js not-found behavior for a missing Customer", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getCustomerById.mockResolvedValue(null);

    await expect(
      CustomerPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("renders an editable form for an admin", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.getCustomerById.mockResolvedValue(customer);

    const html = renderToStaticMarkup(
      await CustomerPage({ params: Promise.resolve({ id: customer.id }) }),
    );

    expect(html).toContain('name="customerId" value="customer-1"');
    expect(html).toContain('name="defaultDeliveryContactName"');
    expect(html).toContain('name="defaultDeliveryPhone"');
    expect(html).toContain('name="defaultDeliveryAddress"');
    expect(html).toContain(">保存客户</button>");
    expect(html).not.toContain("创建客户");
  });
});
