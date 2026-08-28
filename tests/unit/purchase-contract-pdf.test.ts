import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  PurchaseContractPdfIntegrityError,
  buildPurchaseContractPdfViewModel,
  purchaseContractPdfContentDisposition,
  purchaseContractPdfPageFooter,
  type PurchaseContractPdfSource,
} from "@/lib/purchase-contract-pdf";
import {
  PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
  PurchaseContractPdfFontError,
  renderPurchaseContractPdf,
  resolvePurchaseContractPdfFontPath,
} from "@/lib/purchase-contract-pdf.server";

function contractFixture(): PurchaseContractPdfSource {
  return {
    id: "contract-1",
    contractNo: "PUR26WS0826",
    status: "FINAL",
    signingDate: new Date("2026-08-28T00:00:00.000Z"),
    signingPlace: "天津",
    buyerLegalName: "旧买方名称",
    buyerUnifiedCreditCode: "buyer-credit",
    buyerContactName: "买方联系人",
    buyerPhone: "022-12345678",
    buyerAddress: "买方历史地址",
    buyerBankName: "买方开户行",
    buyerBankAccount: "buyer-account",
    sellerLegalName: "旧卖方名称",
    sellerUnifiedCreditCode: "seller-credit",
    sellerContactName: "卖方联系人",
    sellerPhone: "0752-1234567",
    sellerAddress: "卖方历史地址",
    sellerBankName: "卖方开户行",
    sellerBankAccount: "seller-account",
    deliveryDate: new Date("2026-09-01T00:00:00.000Z"),
    deliveryAddress: "浙江乐清历史收货地址",
    deliveryContactName: "张建英",
    deliveryContactPhone: "13800000000",
    packagingTerms: "第一行包装要求\n第二行包装要求",
    inspectionTerms: "按样验收",
    paymentTerms: "款到发货",
    shippingMethod: "德邦",
    breachTerms: "迟延交货按合同处理",
    qualityTerms: "符合确认样品",
    changeTerms: "变更须书面确认",
    disputeTerms: "友好协商",
    additionalTerms: null,
    totalAmount: new Prisma.Decimal("5760.00"),
    items: [
      {
        id: "item-1",
        productId: "product-1",
        sortOrder: 0,
        productCode: "WS-H42",
        productName: "PVC热收缩套管",
        specification: "42mm",
        unit: "米",
        quantity: new Prisma.Decimal("6400.000"),
        unitPrice: new Prisma.Decimal("0.9000"),
        amount: new Prisma.Decimal("5760.00"),
      },
    ],
  };
}

describe("Purchase Contract PDF view model", () => {
  it("uses persisted snapshots and includes the formal Chinese content model", () => {
    const sourceWithLiveRelations = {
      ...contractFixture(),
      company: { legalName: "当前 Company 名称" },
      supplier: { legalName: "当前 Supplier 名称" },
      items: contractFixture().items.map((item) => ({
        ...item,
        product: { name: "当前 Product 名称" },
      })),
    };

    const model = buildPurchaseContractPdfViewModel(sourceWithLiveRelations);

    expect(model).toMatchObject({
      title: "采购合同",
      contractNo: "PUR26WS0826",
      signingDate: "2026-08-28",
      signingPlace: "天津",
      totalAmount: "5760.00",
      buyer: { legalName: "旧买方名称" },
      seller: { legalName: "旧卖方名称" },
      buyerSignature: "旧买方名称",
      sellerSignature: "旧卖方名称",
      items: [
        {
          productCode: "WS-H42",
          productDescription: "PVC热收缩套管\n规格/型号：42mm",
          quantity: "6400.000",
          unit: "米",
          unitPrice: "0.9000",
          amount: "5760.00",
        },
      ],
    });
    expect(model.buyer.fields).toContainEqual({
      label: "地址",
      value: "买方历史地址",
    });
    expect(model.seller.fields).toContainEqual({
      label: "银行账号",
      value: "seller-account",
    });
    expect(model.terms).toContainEqual({
      label: "包装要求",
      value: "第一行包装要求\n第二行包装要求",
    });
    expect(model.terms.some((term) => term.label === "补充条款")).toBe(false);
    expect(JSON.stringify(model)).not.toContain("当前 Company 名称");
    expect(JSON.stringify(model)).not.toContain("当前 Supplier 名称");
    expect(JSON.stringify(model)).not.toContain("当前 Product 名称");
  });

  it("validates 6400.000 × 0.9000 as exactly 5760.00", () => {
    const model = buildPurchaseContractPdfViewModel(contractFixture());

    expect(model.items[0]).toMatchObject({
      quantity: "6400.000",
      unitPrice: "0.9000",
      amount: "5760.00",
    });
    expect(model.totalAmount).toBe("5760.00");
  });

  it("validates exact multi-line totals without binary floating point", () => {
    const source = contractFixture();
    source.items.push({
      id: "item-2",
      productId: "product-2",
      sortOrder: 1,
      productCode: "SECOND",
      productName: "第二项产品",
      specification: null,
      unit: "件",
      quantity: new Prisma.Decimal("2.000"),
      unitPrice: new Prisma.Decimal("1.0050"),
      amount: new Prisma.Decimal("2.01"),
    });
    source.totalAmount = new Prisma.Decimal("5762.01");

    const model = buildPurchaseContractPdfViewModel(source);

    expect(model.items[1].amount).toBe("2.01");
    expect(model.totalAmount).toBe("5762.01");
  });

  it("fails safely when a persisted line amount is inconsistent", () => {
    const source = contractFixture();
    source.items[0].amount = new Prisma.Decimal("5759.99");

    expect(() => buildPurchaseContractPdfViewModel(source)).toThrow(
      PurchaseContractPdfIntegrityError,
    );
  });

  it("fails safely when the persisted total is inconsistent", () => {
    const source = contractFixture();
    source.totalAmount = new Prisma.Decimal("5759.99");

    expect(() => buildPurchaseContractPdfViewModel(source)).toThrow(
      PurchaseContractPdfIntegrityError,
    );
  });
});

describe("Purchase Contract PDF rendering", () => {
  it("creates real PDF bytes with an injected test-safe standard font", async () => {
    const model = buildPurchaseContractPdfViewModel(contractFixture());

    const pdf = await renderPurchaseContractPdf(model, "Helvetica");

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
  });

  it("builds the Chinese page-number footer text", () => {
    expect(purchaseContractPdfPageFooter(2, 5)).toBe("第 2 页 / 共 5 页");
  });
});

describe("Purchase Contract PDF font resolution", () => {
  it("uses the production cwTeXFangSong path by default", async () => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolvePurchaseContractPdfFontPath({}, assertReadable),
    ).resolves.toBe(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH);
    expect(assertReadable).toHaveBeenCalledWith(
      "/usr/share/fonts/truetype/cwtex/cwfs.ttf",
    );
  });

  it("honors the optional font path override", async () => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolvePurchaseContractPdfFontPath(
        { PURCHASE_CONTRACT_PDF_FONT_PATH: " /opt/fonts/cwfs.ttf " },
        assertReadable,
      ),
    ).resolves.toBe("/opt/fonts/cwfs.ttf");
  });

  it("fails with a path-free application error when the font is missing", async () => {
    await expect(
      resolvePurchaseContractPdfFontPath(
        { PURCHASE_CONTRACT_PDF_FONT_PATH: "/private/missing.ttf" },
        vi.fn().mockRejectedValue(new Error("ENOENT /private/missing.ttf")),
      ),
    ).rejects.toEqual(new PurchaseContractPdfFontError());
  });
});

describe("Purchase Contract PDF response filename", () => {
  it("provides an ASCII fallback and UTF-8 Chinese filename", () => {
    const header = purchaseContractPdfContentDisposition("PUR26WS0826");

    expect(header).toContain(
      'filename="purchase-contract-PUR26WS0826.pdf"',
    );
    expect(header).toContain("filename*=UTF-8''%E9%87%87%E8%B4%AD%E5%90%88%E5%90%8C-PUR26WS0826.pdf");
  });

  it("prevents hostile contract numbers from injecting response headers", () => {
    const header = purchaseContractPdfContentDisposition(
      'PUR26"\r\nX-Injected: yes/../../\\evil',
    );

    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    expect(header).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.pdf"; filename\*=UTF-8''[^\s]+$/,
    );
  });
});
