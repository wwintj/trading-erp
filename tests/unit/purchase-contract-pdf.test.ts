import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { accessSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import * as fontkit from "fontkit";
import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  PURCHASE_CONTRACT_PDF_ITEM_SECTION_TITLE,
  PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS,
  PurchaseContractPdfIntegrityError,
  buildPurchaseContractPdfViewModel,
  formatExactAmountWithThousands,
  formatRmbUppercase,
  normalizePurchaseContractPdfText,
  purchaseContractPdfContentDisposition,
  purchaseContractPdfPageFooter,
  purchaseContractPdfPageFooters,
  purchaseContractPdfRemarkLines,
  type PurchaseContractPdfSource,
} from "@/lib/purchase-contract-pdf";
import {
  PURCHASE_CONTRACT_PDF_BOLD_FONT_NAME,
  PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH,
  PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
  PURCHASE_CONTRACT_PDF_HEADER_LABEL_ALIGN,
  PURCHASE_CONTRACT_PDF_HEADER_METADATA_COLUMN_GAP,
  PURCHASE_CONTRACT_PDF_HEADER_METADATA_PADDING,
  PURCHASE_CONTRACT_PDF_HEADER_VALUE_ALIGN,
  PURCHASE_CONTRACT_PDF_LAYOUT,
  PURCHASE_CONTRACT_PDF_PARTY_LABEL_ALIGN,
  PURCHASE_CONTRACT_PDF_PARTY_LABEL_WIDTH,
  PURCHASE_CONTRACT_PDF_PARTY_VALUE_ALIGN,
  PURCHASE_CONTRACT_PDF_REQUIRED_TEXT,
  PURCHASE_CONTRACT_PDF_TERM_MARKER_WIDTH,
  PURCHASE_CONTRACT_PDF_TERM_SUBLINE_INDENT,
  PurchaseContractPdfFontError,
  PurchaseContractPdfUnsupportedGlyphError,
  purchaseContractPdfHeaderMetadataLayout,
  purchaseContractPdfHeaderMetadataRows,
  purchaseContractPdfPartyColumnLayout,
  purchaseContractPdfPartyLabelCharacterSpacing,
  purchaseContractPdfPartyRows,
  purchaseContractPdfSharedPartyRowHeights,
  purchaseContractPdfTermLayout,
  renderPurchaseContractPdf,
  resolvePurchaseContractPdfFontPath,
} from "@/lib/purchase-contract-pdf.server";

const REQUIRED_GLYPH_SAMPLE =
  "采购合同合同编号签约时间签约地点买方卖方型号品名商标规格产地数量单价金额备注交货时间发货地址收货人电话验收方法质量条款货款结算运输方式合同变更争议解决违约责任附加条款浙江省乐清市翁垟街道高桥村龙栖路";

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
    specialNotice: "请严格按照指定地址发货。",
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
          quantityDisplay: "6400.00",
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
    expect(model).not.toHaveProperty("specialDelivery");
    expect(model.terms.find((term) => term.label === "交货时间")).toEqual({
      sectionNumber: 4,
      marker: "四、",
      heading: "四、交货时间：",
      label: "交货时间",
      value: "2026年09月01日",
      subLines: [
        "发货地址：浙江省乐清市历史收货地址",
        "收货人：张建英    电话：13800000000",
      ],
      emphasized: false,
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
    expect(model.terms.find((term) => term.label === "合同变更")).toMatchObject({
      value: "合同变更须书面确认",
      emphasized: false,
      subLines: [],
    });
  });

  it.each([
    {
      label: "date only",
      date: new Date("2026-09-01T00:00:00.000Z"),
      address: null,
      recipient: null,
      phone: null,
      expected: {
        label: "交货时间",
        value: "2026年09月01日",
        subLines: [],
      },
    },
    {
      label: "address only",
      date: null,
      address: "浙江省乐清市翁垟街道高桥村龙栖路142号",
      recipient: null,
      phone: null,
      expected: {
        label: "交货信息",
        value: "",
        subLines: ["发货地址：浙江省乐清市翁垟街道高桥村龙栖路142号"],
      },
    },
    {
      label: "recipient only",
      date: null,
      address: null,
      recipient: "张建英",
      phone: null,
      expected: {
        label: "交货信息",
        value: "",
        subLines: ["收货人：张建英"],
      },
    },
    {
      label: "phone only",
      date: null,
      address: null,
      recipient: null,
      phone: "13587623210",
      expected: {
        label: "交货信息",
        value: "",
        subLines: ["电话：13587623210"],
      },
    },
  ])("builds a delivery term for $label", ({ date, address, recipient, phone, expected }) => {
    const source = contractFixture();
    source.deliveryDate = date;
    source.deliveryAddress = address;
    source.deliveryContactName = recipient;
    source.deliveryContactPhone = phone;

    const deliveryTerm = buildPurchaseContractPdfViewModel(source).terms.find(
      (term) => term.label === "交货时间" || term.label === "交货信息",
    );

    expect(deliveryTerm).toMatchObject(expected);
  });

  it("omits delivery and contract-change terms when their stored fields are empty", () => {
    const source = contractFixture();
    source.deliveryDate = null;
    source.deliveryAddress = "  ";
    source.deliveryContactName = null;
    source.deliveryContactPhone = "";
    source.changeTerms = "  \n  ";

    const model = buildPurchaseContractPdfViewModel(source);

    expect(
      model.terms.some(
        (term) => term.label === "交货时间" || term.label === "交货信息",
      ),
    ).toBe(false);
    expect(model.terms.some((term) => term.label === "合同变更")).toBe(false);
    expect(model.terms.map((term) => term.sectionNumber)).toEqual([
      2, 3, 4, 5, 6, 7,
    ]);
  });

  it("preserves populated multi-line contract change text as regular terms", () => {
    const source = contractFixture();
    source.changeTerms =
      "本合同数量允许根据实际生产情况上下浮动5%。\n所有变更须双方书面确认。";

    const term = buildPurchaseContractPdfViewModel(source).terms.find(
      (candidate) => candidate.label === "合同变更",
    );

    expect(term).toMatchObject({
      value:
        "本合同数量允许根据实际生产情况上下浮动5%。\n所有变更须双方书面确认。",
      emphasized: false,
      subLines: [],
    });
  });

  it.each([null, "", "  \n  "])(
    "omits a blank special notice (%j)",
    (specialNotice) => {
      const source = contractFixture();
      source.specialNotice = specialNotice;

      expect(buildPurchaseContractPdfViewModel(source).specialNotice).toBeNull();
    },
  );

  it("preserves a populated multi-line special notice", () => {
    const source = contractFixture();
    source.specialNotice = "第一行重点说明。\r\n第二行重点说明。";

    expect(buildPurchaseContractPdfViewModel(source).specialNotice).toBe(
      "第一行重点说明。\n第二行重点说明。",
    );
  });

  it("normalizes PDF-facing controls and spacing without changing the database value", () => {
    const stored = "第一\t项\u00a0说明\r\n第二项\u200b\u200c\u200d\ufeff\u0000。";

    expect(normalizePurchaseContractPdfText(stored)).toBe(
      "第一    项 说明\n第二项。",
    );
    expect(stored).toContain("\u200b");
    expect(normalizePurchaseContractPdfText("中文，标点。\n换行！")).toBe(
      "中文，标点。\n换行！",
    );
  });

  it("uses separate marker, body, and nested delivery columns", () => {
    const layout = purchaseContractPdfTermLayout();

    expect(PURCHASE_CONTRACT_PDF_TERM_MARKER_WIDTH).toBe(22);
    expect(PURCHASE_CONTRACT_PDF_TERM_SUBLINE_INDENT).toBe(22);
    expect(layout).toEqual({
      markerX: 36,
      markerWidth: 22,
      bodyX: 58,
      bodyWidth: 501.22,
      subLineX: 80,
      subLineWidth: 479.22,
    });
    expect(layout.subLineX).toBeGreaterThan(layout.bodyX);
  });

  it("builds structured markers through ten without parsing headings", () => {
    const source = contractFixture();
    source.additionalTerms = "补充约定";
    const terms = buildPurchaseContractPdfViewModel(source).terms;

    expect(terms.map((term) => term.marker)).toEqual([
      "二、",
      "三、",
      "四、",
      "五、",
      "六、",
      "七、",
      "八、",
      "九、",
      "十、",
    ]);
    expect(terms[0]).toMatchObject({ sectionNumber: 2, marker: "二、" });
    expect(terms[7]).toMatchObject({ sectionNumber: 9, marker: "九、" });
    expect(terms[8]).toMatchObject({ sectionNumber: 10, marker: "十、" });
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
    expect(modelText).toContain("请严格按照指定地址发货。");
    expect(rendererText).toContain("特别注意");
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
      quantityDisplay: "6400.00",
      unitPrice: "0.9000",
      unitPriceDisplay: "¥0.90",
      amount: "5760.00",
      amountDisplay: "¥5,760.00",
    });
    expect(model.totalAmount).toBe("5760.00");
  });

  it("uses measured compact columns for header metadata", () => {
    const rows = purchaseContractPdfHeaderMetadataRows(
      buildPurchaseContractPdfViewModel(contractFixture()),
    );
    const measureText = vi.fn((text: string) => text.length * 10);
    const layout = purchaseContractPdfHeaderMetadataLayout(rows, measureText);

    expect(layout).toMatchObject({
      labelWidth: 50 + PURCHASE_CONTRACT_PDF_HEADER_METADATA_PADDING,
      valueWidth: 110 + PURCHASE_CONTRACT_PDF_HEADER_METADATA_PADDING,
      labelAlign: "right",
      valueAlign: "left",
      columnGap: 8,
    });
    expect(PURCHASE_CONTRACT_PDF_HEADER_LABEL_ALIGN).toBe("right");
    expect(PURCHASE_CONTRACT_PDF_HEADER_VALUE_ALIGN).toBe("left");
    expect(PURCHASE_CONTRACT_PDF_HEADER_METADATA_COLUMN_GAP).toBe(8);
    expect(layout.valueX).toBe(
      layout.labelX + layout.labelWidth + layout.columnGap,
    );
    expect(layout.valueX + layout.valueWidth).toBeCloseTo(layout.rightEdge);
    expect(layout.rightEdge).toBeCloseTo(595.22 - 36);
    expect(layout.blockWidth).toBeLessThan(178);
    expect(measureText).toHaveBeenCalledWith("合同编号：");
    expect(measureText).toHaveBeenCalledWith("PUR26WS0826");
    expect(rows).toEqual([
      { label: "合同编号：", value: "PUR26WS0826" },
      { label: "签约时间：", value: "2026年08月28日" },
      { label: "签约地点：", value: "天津" },
    ]);
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
    source.buyerAddress =
      "天津市和平区荣业大街与慎益大街交口新世界花园5-6-502";
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

    const measureText = (text: string) => Array.from(text).length * 10;
    const buyerLayout = purchaseContractPdfPartyColumnLayout(
      36,
      251.61,
      measureText,
    );
    const sellerLayout = purchaseContractPdfPartyColumnLayout(
      307.61,
      251.61,
      measureText,
    );
    expect(buyerLayout).toEqual({
      labelTextX: 36,
      labelTextWidth: 30,
      labelTextAlign: "left",
      colonX: 66,
      colonWidth: 16,
      labelWidth: PURCHASE_CONTRACT_PDF_PARTY_LABEL_WIDTH,
      valueX: 82,
      valueWidth: 200.61,
      valueAlign: "left",
    });
    expect(sellerLayout).toEqual({
      labelTextX: 307.61,
      labelTextWidth: 30,
      labelTextAlign: "left",
      colonX: 337.61,
      colonWidth: 16,
      labelWidth: PURCHASE_CONTRACT_PDF_PARTY_LABEL_WIDTH,
      valueX: 353.61,
      valueWidth: 200.61,
      valueAlign: "left",
    });
    expect(PURCHASE_CONTRACT_PDF_PARTY_LABEL_ALIGN).toBe("left");
    expect(PURCHASE_CONTRACT_PDF_PARTY_VALUE_ALIGN).toBe("left");
    expect(buyerLayout.labelTextX).toBe(36);
    expect(buyerLayout.labelTextWidth).toBe(sellerLayout.labelTextWidth);
    expect(buyerLayout.colonX - buyerLayout.labelTextX).toBe(
      sellerLayout.colonX - sellerLayout.labelTextX,
    );
    expect(buyerLayout.valueX).toBe(82);
    expect(sellerLayout.valueX).toBe(353.61);
    expect(
      purchaseContractPdfPartyLabelCharacterSpacing(
        "买方",
        buyerLayout.labelTextWidth,
        measureText,
      ),
    ).toBe(10);
    expect(
      purchaseContractPdfPartyLabelCharacterSpacing(
        "卖方",
        sellerLayout.labelTextWidth,
        measureText,
      ),
    ).toBe(10);
    expect(
      purchaseContractPdfPartyLabelCharacterSpacing(
        "联系人",
        buyerLayout.labelTextWidth,
        measureText,
      ),
    ).toBe(0);
    const rowHeights = purchaseContractPdfSharedPartyRowHeights(
      buyerRows,
      sellerRows,
      (value) => (value === source.buyerAddress ? 32 : value ? 12 : 0),
    );
    expect(rowHeights).toEqual([16, 35, 16, 16, 42]);
    expect(buyerLayout.valueX).toBe(
      buyerLayout.labelTextX + buyerLayout.labelWidth,
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

describe("Purchase Contract PDF bundled fonts", () => {
  it("includes readable regular and bold OpenType font files", () => {
    expect(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH).toBe(
      resolve("assets/fonts/NotoSerifCJKsc-Regular.otf"),
    );
    expect(PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH).toBe(
      resolve("assets/fonts/NotoSerifCJKsc-Bold.otf"),
    );
    expect(statSync(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH).isFile()).toBe(true);
    expect(statSync(PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH).isFile()).toBe(true);
    expect(() =>
      accessSync(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH, constants.R_OK),
    ).not.toThrow();
    expect(() =>
      accessSync(PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH, constants.R_OK),
    ).not.toThrow();
    expect(
      createHash("sha256")
        .update(readFileSync(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH))
        .digest("hex"),
    ).toBe("2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca");
    expect(
      createHash("sha256")
        .update(readFileSync(PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH))
        .digest("hex"),
    ).toBe("8af07d4b6c2e82bcc72a30e066eaf295f11b9424f4aad2eaa9fe0e9c3b38fc73");
  });

  it.each([
    [PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH, "NotoSerifCJKsc-Regular"],
    [PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH, "NotoSerifCJKsc-Bold"],
  ])("covers every required glyph in %s", (fontPath, postscriptName) => {
    const opened = fontkit.openSync(fontPath);
    if (!("hasGlyphForCodePoint" in opened)) {
      throw new Error("Expected a single OpenType font");
    }
    const missing = [...new Set(REQUIRED_GLYPH_SAMPLE)].filter(
      (character) =>
        !opened.hasGlyphForCodePoint(character.codePointAt(0) as number),
    );

    expect(PURCHASE_CONTRACT_PDF_REQUIRED_TEXT).toBe(REQUIRED_GLYPH_SAMPLE);
    expect(opened.postscriptName).toBe(postscriptName);
    expect(opened.hasGlyphForCodePoint("翁".codePointAt(0) as number)).toBe(true);
    expect(opened.hasGlyphForCodePoint("垟".codePointAt(0) as number)).toBe(true);
    expect(missing).toEqual([]);
  });

  it("tracks the official Noto CJK source and bundled SIL OFL license", () => {
    const readme = readFileSync(resolve("README.md"), "utf8");
    const license = readFileSync(
      resolve("assets/fonts/LICENSE-Noto-CJK"),
      "utf8",
    );

    expect(readme).toContain(
      "https://github.com/notofonts/noto-cjk/tree/main/Serif/OTF/SimplifiedChinese",
    );
    expect(readme).toContain("SIL Open Font License 1.1");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
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

  it("renders contract change entirely in Regular when no notice is present", async () => {
    const source = contractFixture();
    source.specialNotice = null;
    const fontSpy = vi.spyOn(PDFDocument.prototype, "font");
    const textSpy = vi.spyOn(PDFDocument.prototype, "text");
    try {
      await renderPurchaseContractPdf(
        buildPurchaseContractPdfViewModel(source),
        PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
      );
      const fontCalls = fontSpy.mock.calls.map(([font]) => font);
      expect(fontCalls).not.toContain(PURCHASE_CONTRACT_PDF_BOLD_FONT_NAME);
      expect(fontCalls).toContain(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH);
      expect(
        textSpy.mock.calls.some(
          ([text]) => typeof text === "string" && text.includes("特别注意"),
        ),
      ).toBe(false);
    } finally {
      textSpy.mockRestore();
      fontSpy.mockRestore();
    }
  });

  it("renders the complete multi-line notice in Bold then restores Regular", async () => {
    const source = contractFixture();
    source.specialNotice = "第一行。\n第二行。";
    const fontSpy = vi.spyOn(PDFDocument.prototype, "font");
    const textSpy = vi.spyOn(PDFDocument.prototype, "text");
    try {
      await renderPurchaseContractPdf(
        buildPurchaseContractPdfViewModel(source),
        PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
      );
      const noticeIndex = textSpy.mock.calls.findIndex(
        ([text]) => text === "特别注意：\n第一行。\n第二行。",
      );
      const totalIndex = textSpy.mock.calls.findIndex(
        ([text]) =>
          typeof text === "string" && text.startsWith("总计人民币（大写）："),
      );
      const boldIndex = fontSpy.mock.calls.findIndex(
        ([font]) => font === PURCHASE_CONTRACT_PDF_BOLD_FONT_NAME,
      );
      const regularAfterNoticeIndex = fontSpy.mock.calls.findIndex(
        ([font], index) =>
          index > boldIndex && font === PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
      );

      expect(noticeIndex).toBeGreaterThan(-1);
      expect(totalIndex).toBeGreaterThan(noticeIndex);
      expect(boldIndex).toBeGreaterThan(-1);
      expect(regularAfterNoticeIndex).toBeGreaterThan(boldIndex);
      expect(fontSpy.mock.invocationCallOrder[boldIndex]).toBeLessThan(
        textSpy.mock.invocationCallOrder[noticeIndex],
      );
      expect(textSpy.mock.invocationCallOrder[noticeIndex]).toBeLessThan(
        fontSpy.mock.invocationCallOrder[regularAfterNoticeIndex],
      );
      expect(fontSpy.mock.invocationCallOrder[regularAfterNoticeIndex]).toBeLessThan(
        textSpy.mock.invocationCallOrder[totalIndex],
      );
    } finally {
      textSpy.mockRestore();
      fontSpy.mockRestore();
    }
  });

  it("draws numbered terms and delivery sublines in separate hanging-indent boxes", async () => {
    const textSpy = vi.spyOn(PDFDocument.prototype, "text");
    try {
      await renderPurchaseContractPdf(
        buildPurchaseContractPdfViewModel(contractFixture()),
        PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
      );
      const layout = purchaseContractPdfTermLayout();
      const markerCall = textSpy.mock.calls.find(([text]) => text === "二、");
      const bodyCall = textSpy.mock.calls.find(
        ([text]) =>
          typeof text === "string" && text.startsWith("验收方法：按样验收"),
      );
      const deliveryCall = textSpy.mock.calls.find(
        ([text]) =>
          typeof text === "string" && text.startsWith("交货时间：2026年"),
      );
      const deliverySubLineCall = textSpy.mock.calls.find(
        ([text]) =>
          typeof text === "string" && text.startsWith("发货地址："),
      );

      expect(markerCall?.[1]).toBe(layout.markerX);
      expect(markerCall?.[3]).toMatchObject({ width: layout.markerWidth });
      expect(bodyCall?.[1]).toBe(layout.bodyX);
      expect(bodyCall?.[3]).toMatchObject({ width: layout.bodyWidth });
      expect(deliveryCall?.[1]).toBe(layout.bodyX);
      expect(deliverySubLineCall?.[1]).toBe(layout.subLineX);
      expect(deliverySubLineCall?.[3]).toMatchObject({
        width: layout.subLineWidth,
      });
    } finally {
      textSpy.mockRestore();
    }
  });

  it("fails safely for unsupported regular and bold dynamic glyphs", async () => {
    const regularSource = contractFixture();
    regularSource.buyerLegalName = "买方😀";
    await expect(
      renderPurchaseContractPdf(
        buildPurchaseContractPdfViewModel(regularSource),
        PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
      ),
    ).rejects.toBeInstanceOf(PurchaseContractPdfUnsupportedGlyphError);

    const boldSource = contractFixture();
    boldSource.specialNotice = "重点😀";
    await expect(
      renderPurchaseContractPdf(
        buildPurchaseContractPdfViewModel(boldSource),
        PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
      ),
    ).rejects.toBeInstanceOf(PurchaseContractPdfUnsupportedGlyphError);
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
  it("uses and validates the bundled matched Noto Serif pair by default", async () => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);
    const assertGlyphCoverage = vi.fn();

    await expect(
      resolvePurchaseContractPdfFontPath(
        {},
        assertReadable,
        assertGlyphCoverage,
      ),
    ).resolves.toBe(PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH);
    expect(assertReadable).toHaveBeenCalledWith(
      resolve("assets/fonts/NotoSerifCJKsc-Regular.otf"),
    );
    expect(assertReadable).toHaveBeenCalledWith(
      resolve("assets/fonts/NotoSerifCJKsc-Bold.otf"),
    );
    expect(assertGlyphCoverage).toHaveBeenNthCalledWith(
      1,
      PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
    );
    expect(assertGlyphCoverage).toHaveBeenNthCalledWith(
      2,
      PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH,
    );
  });

  it("honors the optional font path override without a fallback", async () => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);
    const assertGlyphCoverage = vi.fn();

    await expect(
      resolvePurchaseContractPdfFontPath(
        { PURCHASE_CONTRACT_PDF_FONT_PATH: " /opt/fonts/custom.otf " },
        assertReadable,
        assertGlyphCoverage,
      ),
    ).resolves.toBe("/opt/fonts/custom.otf");
    expect(assertReadable).toHaveBeenCalledTimes(2);
    expect(assertReadable).toHaveBeenNthCalledWith(
      2,
      PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH,
    );
    expect(assertGlyphCoverage).toHaveBeenNthCalledWith(
      1,
      "/opt/fonts/custom.otf",
    );
    expect(assertGlyphCoverage).toHaveBeenNthCalledWith(
      2,
      PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH,
    );
  });

  it("fails with a path-free application error when the font is missing", async () => {
    await expect(
      resolvePurchaseContractPdfFontPath(
        { PURCHASE_CONTRACT_PDF_FONT_PATH: "/private/missing.otf" },
        vi.fn().mockRejectedValue(new Error("ENOENT /private/missing.otf")),
      ),
    ).rejects.toEqual(new PurchaseContractPdfFontError());
  });

  it("fails with the same safe error when the bundled bold font is missing", async () => {
    const assertReadable = vi.fn(async (fontPath: string) => {
      if (fontPath === PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH) {
        throw new Error("ENOENT /private/internal/NotoSerifCJKsc-Bold.otf");
      }
    });

    await expect(
      resolvePurchaseContractPdfFontPath({}, assertReadable),
    ).rejects.toEqual(new PurchaseContractPdfFontError());
    expect(assertReadable).toHaveBeenCalledTimes(2);
  });

  it.each([
    PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH,
    PURCHASE_CONTRACT_PDF_BOLD_FONT_PATH,
  ])("fails safely when required glyphs are missing from %s", async (targetPath) => {
    const assertReadable = vi.fn().mockResolvedValue(undefined);
    const assertGlyphCoverage = vi.fn((fontPath: string) => {
      if (fontPath === targetPath) {
        throw new Error("missing glyph at /private/internal/font.otf");
      }
    });

    await expect(
      resolvePurchaseContractPdfFontPath(
        {},
        assertReadable,
        assertGlyphCoverage,
      ),
    ).rejects.toEqual(new PurchaseContractPdfFontError());
    expect(assertReadable).toHaveBeenCalledTimes(2);
    expect(assertGlyphCoverage).toHaveBeenCalledWith(targetPath);
  });
});

describe("Purchase Contract PDF response filename", () => {
  it("provides an ASCII fallback and UTF-8 Chinese filename", () => {
    const header = purchaseContractPdfContentDisposition(
      "天津纬信科技有限公司",
      "PUR26WS0001",
    );
    const encodedFilename = header.match(/filename\*=UTF-8''([^;]+)$/)?.[1];

    expect(header).toContain(
      'filename="purchase-contract-PUR26WS0001.pdf"',
    );
    expect(decodeURIComponent(encodedFilename ?? "")).toBe(
      "采购合同-PUR26WS0001-天津纬信科技有限公司.pdf",
    );
  });

  it("prevents hostile snapshot values from injecting response headers", () => {
    const header = purchaseContractPdfContentDisposition(
      '天津"\r\nX-Buyer: yes/../../\\公司:*?<>|',
      'PUR26"\r\nX-Injected: yes/../../\\evil',
    );
    const encodedFilename = header.match(/filename\*=UTF-8''([^;]+)$/)?.[1];
    const displayFilename = decodeURIComponent(encodedFilename ?? "");

    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    expect(header).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.pdf"; filename\*=UTF-8''[^\s]+$/,
    );
    expect(displayFilename).not.toMatch(/["\\/:*?<>|\u0000-\u001f\u007f]/);
  });

  it("falls back to the generic Chinese prefix when the buyer name is empty", () => {
    const header = purchaseContractPdfContentDisposition(
      '"\r\n/\\:*?<>|',
      "PUR26WS0001",
    );
    const encodedFilename = header.match(/filename\*=UTF-8''([^;]+)$/)?.[1];

    expect(decodeURIComponent(encodedFilename ?? "")).toBe(
      "采购合同-PUR26WS0001.pdf",
    );
  });
});
