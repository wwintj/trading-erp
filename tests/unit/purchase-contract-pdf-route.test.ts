import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { PurchaseContractPdfFontError } from "@/lib/purchase-contract-pdf.server";
import { getPurchaseContractPdfResponse } from "@/lib/purchase-contract-pdf-route.server";

function contractFixture(status: "DRAFT" | "FINAL" | "CANCELLED" = "FINAL") {
  return {
    id: "contract-1",
    contractNo: "PUR26WS0826",
    status,
    signingDate: new Date("2026-08-28T00:00:00.000Z"),
    signingPlace: "天津",
    companyId: "company-1",
    supplierId: "supplier-1",
    buyerLegalName: "买方快照名称",
    buyerUnifiedCreditCode: null,
    buyerContactName: null,
    buyerPhone: null,
    buyerAddress: null,
    buyerBankName: null,
    buyerBankAccount: null,
    sellerLegalName: "卖方快照名称",
    sellerUnifiedCreditCode: null,
    sellerContactName: null,
    sellerPhone: null,
    sellerAddress: null,
    sellerBankName: null,
    sellerBankAccount: null,
    deliveryDate: null,
    deliveryAddress: null,
    deliveryContactName: null,
    deliveryContactPhone: null,
    packagingTerms: null,
    inspectionTerms: null,
    paymentTerms: null,
    shippingMethod: null,
    breachTerms: null,
    qualityTerms: null,
    changeTerms: null,
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
        specification: null,
        unit: "米",
        quantity: new Prisma.Decimal("6400.000"),
        unitPrice: new Prisma.Decimal("0.9000"),
        amount: new Prisma.Decimal("5760.00"),
      },
    ],
  };
}

function dependencies(
  overrides: Record<string, unknown> = {},
) {
  return {
    getSession: vi.fn().mockResolvedValue({ user: { role: "admin" } }),
    getContract: vi.fn().mockResolvedValue(contractFixture()),
    resolveFont: vi.fn().mockResolvedValue("Helvetica"),
    renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-test-bytes")),
    ...overrides,
  };
}

const request = new Request(
  "http://localhost/purchase-contracts/contract-1/pdf",
);

describe("Purchase Contract PDF route response", () => {
  it("redirects an unauthenticated request safely before loading data", async () => {
    const getContract = vi.fn();
    const response = await getPurchaseContractPdfResponse(
      request,
      "contract-1",
      dependencies({
        getSession: vi.fn().mockResolvedValue(null),
        getContract,
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("http://localhost/login");
    expect(getContract).not.toHaveBeenCalled();
  });

  it.each(["admin", "user"])(
    "allows an authenticated %s to export a Final contract",
    async (role) => {
      const deps = dependencies({
        getSession: vi.fn().mockResolvedValue({ user: { role } }),
      });
      const response = await getPurchaseContractPdfResponse(
        request,
        "contract-1",
        deps,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toContain(
        'filename="purchase-contract-PUR26WS0826.pdf"',
      );
      expect(
        Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(),
      ).toBe("%PDF-");
      expect(deps.getContract).toHaveBeenCalledWith("contract-1");
    },
  );

  it.each(["DRAFT", "CANCELLED"] as const)(
    "rejects a direct %s export before resolving the font or renderer",
    async (status) => {
      const resolveFont = vi.fn();
      const renderPdf = vi.fn();
      const response = await getPurchaseContractPdfResponse(
        request,
        "contract-1",
        dependencies({
          getContract: vi.fn().mockResolvedValue(contractFixture(status)),
          resolveFont,
          renderPdf,
        }),
      );

      expect(response.status).toBe(409);
      expect(await response.text()).toBe("仅已定稿的采购合同可以导出 PDF。");
      expect(resolveFont).not.toHaveBeenCalled();
      expect(renderPdf).not.toHaveBeenCalled();
    },
  );

  it("returns a safe not-found response", async () => {
    const response = await getPurchaseContractPdfResponse(
      request,
      "missing",
      dependencies({ getContract: vi.fn().mockResolvedValue(null) }),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("采购合同不存在。");
  });

  it("returns a safe Chinese error when PDF generation fails", async () => {
    const response = await getPurchaseContractPdfResponse(
      request,
      "contract-1",
      dependencies({
        renderPdf: vi
          .fn()
          .mockRejectedValue(new Error("Prisma SQL /private/internal/font.ttf")),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toBe("采购合同 PDF 生成失败，请稍后重试。");
    expect(body).not.toContain("Prisma");
    expect(body).not.toContain("/private");
  });

  it("returns a path-free safe error when the production font is missing", async () => {
    const response = await getPurchaseContractPdfResponse(
      request,
      "contract-1",
      dependencies({
        resolveFont: vi.fn().mockRejectedValue(new PurchaseContractPdfFontError()),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe("采购合同 PDF 字体不可用，请联系管理员。");
    expect(body).not.toContain("cwfs.ttf");
  });

  it("fails safely when persisted financial values are inconsistent", async () => {
    const contract = contractFixture();
    contract.items[0].amount = new Prisma.Decimal("5759.99");
    const renderPdf = vi.fn();
    const response = await getPurchaseContractPdfResponse(
      request,
      "contract-1",
      dependencies({
        getContract: vi.fn().mockResolvedValue(contract),
        renderPdf,
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.text()).toBe(
      "采购合同金额数据不一致，无法导出 PDF。",
    );
    expect(renderPdf).not.toHaveBeenCalled();
  });
});
