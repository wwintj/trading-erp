import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  listPurchaseContracts: vi.fn(),
  getPurchaseContractById: vi.fn(),
  getPurchaseContractFormOptions: vi.fn(),
  suggestPurchaseContractNumber: vi.fn(),
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

vi.mock("@/lib/purchase-contract.server", () => ({
  listPurchaseContracts: mocks.listPurchaseContracts,
  getPurchaseContractById: mocks.getPurchaseContractById,
  getPurchaseContractFormOptions: mocks.getPurchaseContractFormOptions,
  suggestPurchaseContractNumber: mocks.suggestPurchaseContractNumber,
}));

vi.mock("@/app/purchase-contracts/actions", () => ({
  savePurchaseContractAction: vi.fn(),
  finalizePurchaseContractAction: vi.fn(),
  reopenPurchaseContractAction: vi.fn(),
  cancelPurchaseContractAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { Prisma } from "@/generated/prisma/client";
import PurchaseContractPage from "@/app/purchase-contracts/[id]/page";
import NewPurchaseContractPage from "@/app/purchase-contracts/new/page";
import PurchaseContractsPage from "@/app/purchase-contracts/page";
import {
  PURCHASE_CONTRACT_SUPPLIER_REFRESH_CONFIRMATION,
  PurchaseContractItemIdentityError,
  confirmPurchaseContractSupplierRefresh,
  getPurchaseContractSaveNavigation,
  purchaseContractItemDeleteConfirmation,
  removePurchaseContractFormRow,
  synchronizePurchaseContractFormRows,
} from "@/components/purchase-contract/purchase-contract-form";
import {
  PURCHASE_CONTRACT_STATUS_CONFIRMATIONS,
  requestPurchaseContractStatusChange,
} from "@/components/purchase-contract/purchase-contract-status-actions";

const adminSession = { user: { email: "admin@example.com", role: "admin" } };
const userSession = { user: { email: "user@example.com", role: "user" } };
const options = {
  companies: [{ id: "company-1", legalName: "天津纬信科技有限公司" }],
  suppliers: [
    {
      id: "supplier-1",
      code: "HYS",
      legalName: "惠州市华业升塑胶制品有限公司",
    },
  ],
  products: [
    {
      id: "product-1",
      code: "WS-H42",
      name: "PVC热收缩套管",
      specification: "WS-H42",
      unit: "米",
    },
  ],
};

function contract(status: "DRAFT" | "FINAL" | "CANCELLED" = "DRAFT") {
  return {
    id: "contract-1",
    contractNo: "PUR26WS0826",
    status,
    signingDate: new Date("2026-08-28T00:00:00.000Z"),
    signingPlace: "天津",
    companyId: "company-1",
    supplierId: "supplier-1",
    buyerLegalName: "天津纬信科技有限公司",
    buyerUnifiedCreditCode: null,
    buyerContactName: null,
    buyerPhone: null,
    buyerAddress: null,
    buyerBankName: null,
    buyerBankAccount: null,
    sellerLegalName: "惠州市华业升塑胶制品有限公司",
    sellerUnifiedCreditCode: null,
    sellerContactName: null,
    sellerPhone: null,
    sellerAddress: null,
    sellerBankName: null,
    sellerBankAccount: null,
    deliveryDate: new Date("2026-09-01T00:00:00.000Z"),
    deliveryAddress: "浙江乐清",
    deliveryContactName: "张建英",
    deliveryContactPhone: null,
    packagingTerms: "100米/盘",
    inspectionTerms: "按样验收",
    paymentTerms: "款到发货",
    shippingMethod: "德邦",
    breachTerms: null,
    qualityTerms: null,
    changeTerms: null,
    specialNotice: null,
    disputeTerms: null,
    additionalTerms: null,
    totalAmount: new Prisma.Decimal("5760.00"),
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    items: [
      {
        id: "item-1",
        purchaseContractId: "contract-1",
        productId: "product-1",
        sortOrder: 0,
        productCode: "WS-H42",
        productName: "PVC热收缩套管",
        specification: "WS-H42",
        unit: "米",
        quantity: new Prisma.Decimal("6400.000"),
        unitPrice: new Prisma.Decimal("0.9000"),
        amount: new Prisma.Decimal("5760.00"),
      },
    ],
  };
}

describe("Purchase Contract pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPurchaseContractFormOptions.mockResolvedValue(options);
    mocks.suggestPurchaseContractNumber.mockResolvedValue("PUR26WS0001");
  });

  it.each([
    ["list", () => PurchaseContractsPage()],
    ["new", () => NewPurchaseContractPage()],
    [
      "detail",
      () => PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    ],
  ])("redirects unauthenticated %s requests to login", async (_name, render) => {
    mocks.getCurrentSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.listPurchaseContracts).not.toHaveBeenCalled();
    expect(mocks.getPurchaseContractById).not.toHaveBeenCalled();
  });

  it("redirects a regular user away from the new route", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);

    await expect(NewPurchaseContractPage()).rejects.toThrow(
      "NEXT_REDIRECT:/purchase-contracts",
    );
  });

  it("renders a Chinese empty state and green create control for admin", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.listPurchaseContracts.mockResolvedValue([]);

    const html = renderToStaticMarkup(await PurchaseContractsPage());
    const createLink = html.match(/<a[^>]*href="\/purchase-contracts\/new"[^>]*>新建采购合同<\/a>/)?.[0];

    expect(html).toContain("暂无采购合同。");
    expect(html).toContain("返回仪表盘");
    expect(createLink).toContain("bg-[#16A34A]");
  });

  it("renders Chinese list columns and accepted row/link interaction for user", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listPurchaseContracts.mockResolvedValue([
      {
        id: "contract-1",
        contractNo: "PUR26WS0826",
        signingDate: new Date("2026-08-28T00:00:00.000Z"),
        sellerLegalName: "惠州市华业升塑胶制品有限公司",
        totalAmount: new Prisma.Decimal("5760.00"),
        status: "DRAFT",
      },
    ]);

    const html = renderToStaticMarkup(await PurchaseContractsPage());

    for (const text of ["合同编号", "签订日期", "卖方", "总金额（元）", "状态", "草稿"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('href="/purchase-contracts/contract-1"');
    expect(html).toContain("hover:bg-neutral-50");
    expect(html).toContain("focus-within:bg-neutral-50");
    expect(html).toContain("hover:text-[#15803D]");
    expect(html).not.toContain("hover:underline");
    expect(html).not.toContain("新建采购合同");
  });

  it("renders a safe Chinese list error", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.listPurchaseContracts.mockRejectedValue(new Error("MySQL details"));

    const html = renderToStaticMarkup(await PurchaseContractsPage());
    expect(html).toContain("采购合同信息暂时无法加载，请稍后重试。");
    expect(html).not.toContain("MySQL");
  });

  it("renders suggested numbering, sections, items, and accepted form actions", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);

    const html = renderToStaticMarkup(await NewPurchaseContractPage());
    const createButton = html.match(/<button[^>]*>创建采购合同<\/button>/)?.[0];

    expect(html).toContain('value="PUR26WS0001"');
    for (const section of ["基本信息", "买卖双方", "合同明细", "交货与验收", "付款与运输", "合同条款"]) {
      expect(html).toContain(section);
    }
    expect(html).toContain("添加产品");
    expect(html).toContain("删除明细");
    expect(html).toContain("明细 1");
    expect(html).toContain("WS-H42 — PVC热收缩套管");
    expect(html).toContain("规格/型号：WS-H42 · 单位：米");
    expect(html).toContain("text-base font-semibold text-neutral-950");
    expect(html).toContain("产品（可更换）");
    expect(html).toContain("选择其它产品即可更换本条合同明细。");
    expect(html).toContain("border-red-200 text-red-700");
    expect(html).toContain("合同总金额（元）");
    expect(html).toContain("合同变更");
    expect(html).toContain("特别注意");
    expect(html).toContain(
      "可选。填写后将在采购合同 PDF 中以加粗重点说明显示。",
    );
    expect(html).not.toContain("变更条款");
    expect(html).toContain("← 返回采购合同列表");
    expect(html).toContain(">取消</a>");
    expect(createButton).toContain("bg-[#16A34A]");
    expect(html).not.toContain("更新供应商资料");
    expect(createButton).toContain('name="intent"');
    expect(createButton).toContain('value="save"');
  });

  it("refreshes existing successful saves once and only replaces after create", () => {
    expect(
      getPurchaseContractSaveNavigation("contract-1", {
        status: "success",
        message: "采购合同保存成功。",
        contractId: "contract-1",
      }),
    ).toEqual({ type: "refresh" });
    expect(
      getPurchaseContractSaveNavigation(null, {
        status: "success",
        message: "采购合同创建成功。",
        contractId: "contract-2",
      }),
    ).toEqual({
      type: "replace",
      href: "/purchase-contracts/contract-2",
    });
    expect(
      getPurchaseContractSaveNavigation("contract-1", {
        status: "error",
        message: "请检查并修正标记的字段。",
      }),
    ).toBeNull();
  });

  it("resyncs a newly created itemId while preserving stable local row keys", () => {
    const allocateKey = vi.fn(() => 99);
    const rows = synchronizePurchaseContractFormRows(
      [
        {
          key: 10,
          itemId: "item-1",
          productId: "product-1",
          quantity: "6400",
          unitPrice: "0.900",
        },
        {
          key: 11,
          productId: "product-1",
          quantity: "2",
          unitPrice: "3",
        },
      ],
      [
        {
          itemId: "item-1",
          productId: "product-1",
          quantity: "6400.000",
          unitPrice: "0.9000",
        },
        {
          itemId: "item-2",
          productId: "product-1",
          quantity: "2.000",
          unitPrice: "3.0000",
        },
      ],
      allocateKey,
    );

    expect(rows).toEqual([
      {
        key: 10,
        itemId: "item-1",
        productId: "product-1",
        quantity: "6400.000",
        unitPrice: "0.9000",
      },
      {
        key: 11,
        itemId: "item-2",
        productId: "product-1",
        quantity: "2.000",
        unitPrice: "3.0000",
      },
    ]);
    expect(allocateKey).not.toHaveBeenCalled();
  });

  it("renders an item identity validation error inside the item card", () => {
    const html = renderToStaticMarkup(
      <PurchaseContractItemIdentityError
        index={0}
        fieldErrors={{ "items.0.itemId": "合同明细身份无效。" }}
      />,
    );

    expect(html).toContain("合同明细身份无效。");
  });

  it("confirms selected-product deletion and allows deleting the last row", () => {
    const rows = [
      {
        key: 10,
        itemId: "item-1",
        productId: "product-1",
        quantity: "6400",
        unitPrice: "0.900",
      },
    ];
    const cancel = vi.fn(() => false);

    expect(removePurchaseContractFormRow(rows, 0, options.products, cancel)).toBe(
      rows,
    );
    expect(cancel).toHaveBeenCalledWith(
      "确定从本合同中删除“WS-H42 — PVC热收缩套管”吗？保存合同后生效。",
    );
    expect(purchaseContractItemDeleteConfirmation(options.products[0])).toBe(
      "确定从本合同中删除“WS-H42 — PVC热收缩套管”吗？保存合同后生效。",
    );

    const confirm = vi.fn(() => true);
    expect(removePurchaseContractFormRow(rows, 0, options.products, confirm)).toEqual(
      [],
    );
  });

  it("deletes one of multiple rows without changing the remaining row data", () => {
    const rows = [
      {
        key: 10,
        itemId: "item-1",
        productId: "product-1",
        quantity: "6400",
        unitPrice: "0.900",
      },
      {
        key: 11,
        itemId: "item-2",
        productId: "product-1",
        quantity: "12",
        unitPrice: "8.5",
      },
    ];

    expect(
      removePurchaseContractFormRow(rows, 0, options.products, () => true),
    ).toEqual([rows[1]]);
  });

  it("deletes an unselected row without confirmation", () => {
    const confirm = vi.fn(() => false);
    const rows = [
      { key: 10, productId: "", quantity: "", unitPrice: "" },
    ];

    expect(removePurchaseContractFormRow(rows, 0, options.products, confirm)).toEqual(
      [],
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it("renders the zero-item empty state and disables save and Supplier refresh", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);
    mocks.getPurchaseContractById.mockResolvedValue({
      ...contract("DRAFT"),
      items: [],
    });

    const html = renderToStaticMarkup(
      await PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    );
    const refreshButton = html.match(
      /<button[^>]*value="refreshSupplierSnapshot"[^>]*>更新供应商资料<\/button>/,
    )?.[0];
    const saveButton = html.match(
      /<button[^>]*value="save"[^>]*>保存采购合同<\/button>/,
    )?.[0];

    expect(html).toContain("暂无合同明细");
    expect(html).toContain("请点击“添加产品”添加至少一条合同明细。");
    expect(html).toContain("请至少添加一条合同明细后再保存。");
    expect(html).toContain("合同总金额（元）：0.00");
    expect(refreshButton).toContain("disabled");
    expect(saveButton).toContain("disabled");
  });

  it("renders Draft editable for admin and read-only for user", async () => {
    mocks.getPurchaseContractById.mockResolvedValue(contract("DRAFT"));

    mocks.getCurrentSession.mockResolvedValue(adminSession);
    const adminHtml = renderToStaticMarkup(
      await PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    );
    expect(adminHtml).toContain("保存采购合同");
    expect(adminHtml).toContain("更新供应商资料");
    expect(adminHtml).toContain('value="refreshSupplierSnapshot"');
    expect(adminHtml).toContain("定稿采购合同");
    expect(adminHtml).toContain("取消采购合同");
    expect(adminHtml).not.toContain("重新打开为草稿");
    expect(adminHtml).not.toContain("导出 PDF");
    expect(adminHtml).toContain('name="itemsJson"');
    expect(adminHtml).toContain("item-1");

    mocks.getCurrentSession.mockResolvedValue(userSession);
    const userHtml = renderToStaticMarkup(
      await PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    );
    expect(userHtml).toContain("5760.00");
    expect(userHtml).not.toContain("保存采购合同");
    expect(userHtml).not.toContain("定稿采购合同");
    expect(userHtml).not.toContain("更新供应商资料");
  });

  it("renders Final and Cancelled contracts read-only", async () => {
    mocks.getCurrentSession.mockResolvedValue(adminSession);

    mocks.getPurchaseContractById.mockResolvedValue(contract("FINAL"));
    const finalHtml = renderToStaticMarkup(
      await PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    );
    expect(finalHtml).toContain("已定稿");
    expect(finalHtml).not.toContain("保存采购合同");
    expect(finalHtml).not.toContain("更新供应商资料");
    expect(finalHtml).toContain("重新打开为草稿");
    expect(finalHtml).toContain("取消采购合同");
    expect(finalHtml).toContain(
      'href="/purchase-contracts/contract-1/pdf"',
    );
    expect(finalHtml).toContain("导出 PDF");
    expect(finalHtml).toContain("border border-neutral-200 bg-white");

    mocks.getPurchaseContractById.mockResolvedValue(contract("CANCELLED"));
    const cancelledHtml = renderToStaticMarkup(
      await PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    );
    expect(cancelledHtml).toContain("已取消");
    expect(cancelledHtml).not.toContain("保存采购合同");
    expect(cancelledHtml).not.toContain("更新供应商资料");
    expect(cancelledHtml).not.toContain("重新打开为草稿");
    expect(cancelledHtml).not.toContain("取消采购合同");
    expect(cancelledHtml).not.toContain("导出 PDF");
  });

  it("shows Final PDF export to a regular user without admin status actions", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getPurchaseContractById.mockResolvedValue(contract("FINAL"));

    const html = renderToStaticMarkup(
      await PurchaseContractPage({ params: Promise.resolve({ id: "contract-1" }) }),
    );

    expect(html).toContain("导出 PDF");
    expect(html).toContain('href="/purchase-contracts/contract-1/pdf"');
    expect(html).not.toContain("重新打开为草稿");
    expect(html).not.toContain("取消采购合同");
  });

  it("uses Chinese reopen confirmation and sends no mutation when cancelled", async () => {
    const confirm = vi.fn().mockReturnValue(false);
    const finalize = vi.fn();
    const reopen = vi.fn();
    const cancel = vi.fn();

    await expect(
      requestPurchaseContractStatusChange("contract-1", "reopen", {
        confirm,
        finalize,
        reopen,
        cancel,
      }),
    ).resolves.toBeNull();
    expect(confirm).toHaveBeenCalledWith(
      "确认重新打开该采购合同？重新打开后合同将恢复为草稿状态并可继续修改。",
    );
    expect(PURCHASE_CONTRACT_STATUS_CONFIRMATIONS.reopen).toBe(
      "确认重新打开该采购合同？重新打开后合同将恢复为草稿状态并可继续修改。",
    );
    expect(finalize).not.toHaveBeenCalled();
    expect(reopen).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("uses explicit Chinese Supplier refresh confirmation", () => {
    const confirm = vi.fn().mockReturnValue(false);

    expect(confirmPurchaseContractSupplierRefresh(confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      "将使用当前供应商主档覆盖本草稿中的卖方名称、地址、电话、联系人及银行资料。合同其它内容不会改变。是否继续？",
    );
    expect(PURCHASE_CONTRACT_SUPPLIER_REFRESH_CONFIRMATION).toBe(
      "将使用当前供应商主档覆盖本草稿中的卖方名称、地址、电话、联系人及银行资料。合同其它内容不会改变。是否继续？",
    );
  });

  it("uses normal not-found behavior for a missing contract", async () => {
    mocks.getCurrentSession.mockResolvedValue(userSession);
    mocks.getPurchaseContractById.mockResolvedValue(null);

    await expect(
      PurchaseContractPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
