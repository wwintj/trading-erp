import { constants } from "node:fs";
import { accessSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import * as fontkit from "fontkit";
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  PURCHASE_CONTRACT_PDF_ITEM_SECTION_TITLE,
  PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS,
  PurchaseContractPdfIntegrityError,
  buildPurchaseContractPdfViewModel,
  formatExactAmountWithThousands,
  formatRmbUppercase,
  purchaseContractPdfContentDisposition,
  purchaseContractPdfPageFooter,
  purchaseContractPdfPageFooters,
  purchaseContractPdfRemarkLines,
  type PurchaseContractPdfSource,
} from "@/lib/purchase-contract-pdf";
import {
  PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
  PURCHASE_CONTRACT_PDF_LAYOUT,
  PurchaseContractPdfFontError,
  purchaseContractPdfPartyRows,
  renderPurchaseContractPdf,
  resolvePurchaseContractPdfFontPath,
} from "@/lib/purchase-contract-pdf.server";

const SIMPLIFIED_CHINESE_CORE_SAMPLE =
  "采购合同合同编号签约时间签约地点买方卖方型号品名商标规格产地数量单价金额备注特别注意交货地址收件人验收方法包装要求货款结算运输方式合同变更解除争议违约责任附加条款";

function contractFixture(): PurchaseContractPdfSource {
  return {
    id: "contract-1",
    contractNo: "PUR26WS0826",
    status: "FINAL",
    signingDate: new Date("2026-08-28T00:00:00.000Z"),
    signingPlace: "天津",
    buyerLegalName: "天津纬信科技有限公司",
    buyerUnifiedCreditCode: "buyer-credit",
    buyerContactName: "买方联系人",
    buyerPhone: "022-12345678",
    buyerAddress: "天津市历史买方地址",
    buyerBankName: "买方开户行",
    buyerBankAccount: "buyer-account",
    sellerLegalName: "惠州市华业升塑胶制品有限公司",
    sellerUnifiedCreditCode: "seller-credit",
    sellerContactName: "卖方联系人",
    sellerPhone: "0752-1234567",
    sellerAddress: "惠州市历史卖方地址",
    sellerBankName: "卖方开户行",
    sellerBankAccount: "seller-account",
    deliveryDate: new Date("2026-09-01T00:00:00.000Z"),
    deliveryAddress: "浙江省乐清市历史收货地址",
    deliveryContactName: "张建英",
    deliveryContactPhone: "13800000000",
    packagingTerms:
      " 1)第一项很长的包装要求，内容超过单行宽度后，续行正文仍应与编号之后的正文起点保持一致，不回到页面左侧。 \n 2)第二项 \n 3)第三项 ",
    inspectionTerms: "按样验收",
    paymentTerms: "款到发货",
    shippingMethod: "德邦物流，运费由卖方承担",
    breachTerms: "迟延交货按合同约定处理",
    qualityTerms: "符合确认样品，如有异议应及时提出",
    changeTerms: "合同变更须书面确认",
    disputeTerms: "争议由双方友好协商解决",
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

function pdfPageCount(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

describe("Purchase Contract PDF historical view model", () => {
  it("uses persisted snapshots in the historical contract structure", () => {
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
      primaryTitle: "天津纬信科技有限公司",
      subtitle: "采购合同",
      contractNo: "PUR26WS0826",
      signingDate: "2026年08月28日",
      signingPlace: "天津",
      itemSectionTitle: PURCHASE_CONTRACT_PDF_ITEM_SECTION_TITLE,
      itemTableLabels: PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS,
      remarks: [
        {
          marker: "1)",
          content:
            "第一项很长的包装要求，内容超过单行宽度后，续行正文仍应与编号之后的正文起点保持一致，不回到页面左侧。",
        },
        { marker: "2)", content: "第二项" },
        { marker: "3)", content: "第三项" },
      ],
      specialDelivery: {
        address: "浙江省乐清市历史收货地址",
        recipient: "张建英",
        phone: "13800000000",
      },
      totalAmount: "5760.00",
      totalAmountDisplay: "¥5,760.00",
      totalAmountUppercase: "伍仟柒佰陆拾元整",
      buyer: { legalName: "天津纬信科技有限公司" },
      seller: { legalName: "惠州市华业升塑胶制品有限公司" },
      items: [
        {
          productCode: "WS-H42",
          productDescription: "PVC热收缩套管\n规格：42mm",
          quantity: "6400.000",
          unit: "米",
          unitPrice: "0.9000",
          unitPriceDisplay: "¥0.90",
          amount: "5760.00",
          amountDisplay: "¥5,760.00",
        },
      ],
    });
    expect(model.buyer).toEqual({
      legalName: "天津纬信科技有限公司",
      address: "天津市历史买方地址",
      phone: "022-12345678",
      contactName: "买方联系人",
    });
    expect(model.seller).toEqual({
      legalName: "惠州市华业升塑胶制品有限公司",
      address: "惠州市历史卖方地址",
      phone: "0752-1234567",
      contactName: "卖方联系人",
    });
    expect(JSON.stringify(model)).not.toContain("当前 Company 名称");
    expect(JSON.stringify(model)).not.toContain("当前 Supplier 名称");
    expect(JSON.stringify(model)).not.toContain("当前 Product 名称");
  });

  it("uses compact continuous numbered clauses and omits empty stored terms", () => {
    const model = buildPurchaseContractPdfViewModel(contractFixture());

    expect(model.terms.map((term) => term.sectionNumber)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(model.terms.map((term) => term.heading)).toEqual([
      "二、验收方法：",
      "三、质量/异议条款：",
      "四、交货时间：",
      "五、货款结算：",
      "六、运输方式及费用承担：",
      "七、合同变更：",
      "八、争议解决：",
      "九、违约责任：",
    ]);
    expect(model.terms.some((term) => term.label === "附加条款")).toBe(false);
  });

  it("contains the historical labels and no generic report sections", () => {
    const modelText = JSON.stringify(
      buildPurchaseContractPdfViewModel(contractFixture()),
    );
    const rendererText = readFileSync(
      resolve("src/lib/purchase-contract-pdf.server.ts"),
      "utf8",
    );

    for (const label of PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS) {
      expect(modelText).toContain(label);
    }
    expect(PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS[0]).toBe("型号");
    expect(modelText).not.toContain("货号");
    for (const forbidden of [
      "买卖双方",
      "合同明细",
      "交货与合同条款",
      "sectionHeading",
    ]) {
      expect(modelText).not.toContain(forbidden);
      expect(rendererText).not.toContain(forbidden);
    }
  });

  it("validates 6400.000 × 0.9000 as exactly 5760.00", () => {
    const model = buildPurchaseContractPdfViewModel(contractFixture());

    expect(model.items[0]).toMatchObject({
      quantity: "6400.000",
      unitPrice: "0.9000",
      unitPriceDisplay: "¥0.90",
      amount: "5760.00",
      amountDisplay: "¥5,760.00",
    });
    expect(model.totalAmount).toBe("5760.00");
  });

  it("keeps logical remark lines and their original number markers", () => {
    expect(
      purchaseContractPdfRemarkLines(
        " 1)第一项很长的包装要求…… \n 2) 第二项 \n 3)第三项 \n 10)第十项 \n 普通说明 ",
      ),
    ).toEqual([
      { marker: "1)", content: "第一项很长的包装要求……" },
      { marker: "2)", content: "第二项" },
      { marker: "3)", content: "第三项" },
      { marker: "10)", content: "第十项" },
      { marker: null, content: "普通说明" },
    ]);
  });

  it("keeps fixed buyer and seller rows when snapshot fields are empty", () => {
    const source = contractFixture();
    source.sellerAddress = null;
    source.sellerPhone = null;
    source.sellerContactName = null;
    const model = buildPurchaseContractPdfViewModel(source);

    const buyerRows = purchaseContractPdfPartyRows("买方", model.buyer);
    const sellerRows = purchaseContractPdfPartyRows("卖方", model.seller);

    expect(buyerRows.map((row) => row.label)).toEqual([
      "买方",
      "地址",
      "电话",
      "联系人",
      "盖章",
    ]);
    expect(sellerRows).toEqual([
      { label: "卖方", value: "惠州市华业升塑胶制品有限公司" },
      { label: "地址", value: "" },
      { label: "电话", value: "" },
      { label: "联系人", value: "" },
      { label: "盖章", value: "" },
    ]);
    expect(buyerRows.slice(1).map((row) => row.label)).toEqual(
      sellerRows.slice(1).map((row) => row.label),
    );
  });

  it("uses the narrow A4 printable-area constants", () => {
    expect(PURCHASE_CONTRACT_PDF_LAYOUT).toEqual({
      pageWidth: 595.22,
      pageHeight: 842,
      contentMargin: 36,
      pageTopMargin: 28,
      pageBottomMargin: 32,
    });
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

describe("Purchase Contract PDF RMB uppercase formatting", () => {
  it.each([
    ["0.00", "零元整"],
    ["1.00", "壹元整"],
    ["10.00", "壹拾元整"],
    ["100.00", "壹佰元整"],
    ["1000.00", "壹仟元整"],
    ["5400.00", "伍仟肆佰元整"],
    ["5760.00", "伍仟柒佰陆拾元整"],
    ["10.10", "壹拾元壹角"],
    ["10.01", "壹拾元零壹分"],
    ["10001.05", "壹万零壹元零伍分"],
    [
      "9999999999999999.99",
      "玖仟玖佰玖拾玖万亿玖仟玖佰玖拾玖亿玖仟玖佰玖拾玖万玖仟玖佰玖拾玖元玖角玖分",
    ],
  ])("formats %s exactly", (input, expected) => {
    expect(formatRmbUppercase(input)).toBe(expected);
  });

  it("formats numeric amounts with separators using exact strings", () => {
    expect(formatExactAmountWithThousands("5760.00")).toBe("5,760.00");
    expect(formatExactAmountWithThousands("9999999999999999.99")).toBe(
      "9,999,999,999,999,999.99",
    );
  });
});

describe("Purchase Contract PDF bundled Fandol font", () => {
  it("exists as a readable regular OpenType font", () => {
    expect(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH).toBe(
      resolve("assets/fonts/FandolFang-Regular.otf"),
    );
    expect(statSync(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH).isFile()).toBe(true);
    expect(() =>
      accessSync(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH, constants.R_OK),
    ).not.toThrow();
  });

  it("covers every required Simplified Chinese core glyph", () => {
    const opened = fontkit.openSync(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH);
    if (!("hasGlyphForCodePoint" in opened)) {
      throw new Error("Expected a single OpenType font");
    }
    const missing = [...new Set(SIMPLIFIED_CHINESE_CORE_SAMPLE)].filter(
      (character) =>
        !opened.hasGlyphForCodePoint(character.codePointAt(0) as number),
    );

    expect(opened.postscriptName).toBe("FandolFang-Regular");
    expect(missing).toEqual([]);
  });

  it("creates a one-page real PDF with the bundled font", async () => {
    const model = buildPurchaseContractPdfViewModel(contractFixture());

    const pdf = await renderPurchaseContractPdf(
      model,
      PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
    );

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(pdfPageCount(pdf)).toBe(1);
  });

  it("allows long stored terms to flow onto multiple pages", async () => {
    const source = contractFixture();
    source.additionalTerms = "附加条款内容。".repeat(1_200);
    const model = buildPurchaseContractPdfViewModel(source);

    const pdf = await renderPurchaseContractPdf(
      model,
      PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
    );

    expect(pdfPageCount(pdf)).toBeGreaterThan(1);
  });

  it("omits a one-page footer and creates footers only for multiple pages", () => {
    expect(purchaseContractPdfPageFooters(1)).toEqual([]);
    expect(purchaseContractPdfPageFooters(3)).toEqual([
      "第 1 页 / 共 3 页",
      "第 2 页 / 共 3 页",
      "第 3 页 / 共 3 页",
    ]);
    expect(purchaseContractPdfPageFooter(2, 5)).toBe("第 2 页 / 共 5 页");
  });
});

describe("Purchase Contract PDF font resolution", () => {
  it("uses the bundled FandolFang path by default", async () => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolvePurchaseContractPdfFontPath({}, assertReadable),
    ).resolves.toBe(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH);
    expect(assertReadable).toHaveBeenCalledWith(
      resolve("assets/fonts/FandolFang-Regular.otf"),
    );
  });

  it("honors the optional font path override without a fallback", async () => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolvePurchaseContractPdfFontPath(
        { PURCHASE_CONTRACT_PDF_FONT_PATH: " /opt/fonts/custom.otf " },
        assertReadable,
      ),
    ).resolves.toBe("/opt/fonts/custom.otf");
    expect(assertReadable).toHaveBeenCalledTimes(1);
  });

  it("fails with a path-free application error when the font is missing", async () => {
    await expect(
      resolvePurchaseContractPdfFontPath(
        { PURCHASE_CONTRACT_PDF_FONT_PATH: "/private/missing.otf" },
        vi.fn().mockRejectedValue(new Error("ENOENT /private/missing.otf")),
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
    expect(header).toContain(
      "filename*=UTF-8''%E9%87%87%E8%B4%AD%E5%90%88%E5%90%8C-PUR26WS0826.pdf",
    );
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
