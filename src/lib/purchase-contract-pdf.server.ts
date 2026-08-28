import "server-only";

import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";

import {
  purchaseContractPdfPageFooters,
  type PurchaseContractPdfParty,
  type PurchaseContractPdfRemarkLine,
  type PurchaseContractPdfViewModel,
} from "@/lib/purchase-contract-pdf";

export const PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "FandolFang-Regular.otf",
);

export class PurchaseContractPdfFontError extends Error {
  constructor() {
    super("Purchase contract PDF font is unavailable");
  }
}

type EnvironmentSource = Record<string, string | undefined>;
type FontSource = string | Buffer | Uint8Array | ArrayBuffer;
export type PurchaseContractPdfFontSource =
  | FontSource
  | { source: FontSource; family?: string };
type AssertReadable = (fontPath: string) => Promise<void>;

export async function resolvePurchaseContractPdfFontPath(
  source: EnvironmentSource = process.env,
  assertReadable: AssertReadable = async (fontPath) => {
    const details = await stat(fontPath);
    if (!details.isFile()) {
      throw new Error("Not a regular file");
    }
    await access(fontPath, constants.R_OK);
  },
): Promise<string> {
  const configured = source.PURCHASE_CONTRACT_PDF_FONT_PATH?.trim();
  const fontPath = configured || PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH;

  try {
    await assertReadable(fontPath);
    return fontPath;
  } catch {
    throw new PurchaseContractPdfFontError();
  }
}

export const PURCHASE_CONTRACT_PDF_LAYOUT = {
  pageWidth: 595.22,
  pageHeight: 842,
  contentMargin: 36,
  pageTopMargin: 28,
  pageBottomMargin: 32,
} as const;

const {
  pageWidth: PAGE_WIDTH,
  pageHeight: PAGE_HEIGHT,
  contentMargin: CONTENT_MARGIN,
  pageTopMargin: PAGE_TOP_MARGIN,
  pageBottomMargin: PAGE_BOTTOM_MARGIN,
} = PURCHASE_CONTRACT_PDF_LAYOUT;
const BODY_FONT_SIZE = 10.5;
const BODY_LINE_GAP = 1.4;

function bodyBottom(document: PDFKit.PDFDocument): number {
  return document.page.height - PAGE_BOTTOM_MARGIN;
}

function applyFont(
  document: PDFKit.PDFDocument,
  fontSource: PurchaseContractPdfFontSource,
) {
  if (
    typeof fontSource === "object" &&
    fontSource !== null &&
    "source" in fontSource
  ) {
    document.registerFont(
      "PurchaseContractFont",
      fontSource.source,
      fontSource.family,
    );
    return document.font("PurchaseContractFont");
  }

  return document.font(fontSource);
}

function contentWidth(document: PDFKit.PDFDocument): number {
  return document.page.width - CONTENT_MARGIN * 2;
}

function ensureSpace(
  document: PDFKit.PDFDocument,
  requiredHeight: number,
  fontSource: PurchaseContractPdfFontSource,
  afterPageBreak?: () => void,
): boolean {
  if (document.y + requiredHeight <= bodyBottom(document)) {
    return false;
  }

  document.addPage();
  applyFont(document, fontSource).fillColor("#111111");
  afterPageBreak?.();
  return true;
}

function horizontalRule(
  document: PDFKit.PDFDocument,
  y: number,
  width = 0.55,
) {
  document
    .moveTo(CONTENT_MARGIN, y)
    .lineTo(document.page.width - CONTENT_MARGIN, y)
    .lineWidth(width)
    .strokeColor("#333333")
    .stroke();
}

function renderHeader(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
) {
  document
    .fontSize(28)
    .fillColor("#111111")
    .text(model.primaryTitle, CONTENT_MARGIN, document.y, {
      width: contentWidth(document),
      align: "center",
      lineGap: 0,
    });
  document.moveDown(0.12);
  document.fontSize(12).text(model.subtitle, {
    width: contentWidth(document),
    align: "center",
  });
  document.moveDown(0.42);

  const y = document.y;
  const gap = 18;
  const rightWidth = 178;
  const leftWidth = contentWidth(document) - rightWidth - gap;
  const leftText = `买方：${model.buyer.legalName}\n卖方：${model.seller.legalName}`;
  const rightLines = [
    `合同编号：${model.contractNo}`,
    `签约时间：${model.signingDate}`,
    model.signingPlace ? `签约地点：${model.signingPlace}` : null,
  ].filter((line): line is string => line !== null);
  const rightText = rightLines.join("\n");

  document.fontSize(BODY_FONT_SIZE);
  const blockHeight = Math.max(
    document.heightOfString(leftText, { width: leftWidth, lineGap: 2 }),
    document.heightOfString(rightText, { width: rightWidth, lineGap: 2 }),
  );
  document.text(leftText, CONTENT_MARGIN, y, {
    width: leftWidth,
    lineGap: 2,
  });
  document.text(rightText, CONTENT_MARGIN + leftWidth + gap, y, {
    width: rightWidth,
    align: "left",
    lineGap: 2,
  });
  document.y = y + blockHeight + 5;
}

type TableColumn = {
  width: number;
  align?: "left" | "center" | "right";
};

function tableColumns(document: PDFKit.PDFDocument): TableColumn[] {
  const fixedWidth = 70 + 211 + 64 + 38 + 62;
  return [
    { width: 70 },
    { width: 211 },
    { width: 64, align: "right" },
    { width: 38, align: "center" },
    { width: 62, align: "right" },
    { width: contentWidth(document) - fixedWidth, align: "right" },
  ];
}

function drawTableText(
  document: PDFKit.PDFDocument,
  values: readonly string[],
  columns: TableColumn[],
  y: number,
  height: number,
  fontSize: number,
) {
  let x = CONTENT_MARGIN;
  columns.forEach((column, index) => {
    document
      .fontSize(fontSize)
      .fillColor("#111111")
      .text(values[index], x + 3, y + 4, {
        width: column.width - 6,
        height: height - 7,
        align: column.align ?? "left",
        lineGap: 0.7,
      });
    x += column.width;
  });
  document.y = y + height;
}

function drawTableHeader(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  columns: TableColumn[],
) {
  const y = document.y;
  horizontalRule(document, y, 0.85);
  drawTableText(document, model.itemTableLabels, columns, y + 1, 23, 9.5);
  horizontalRule(document, y + 24, 0.5);
  document.y = y + 25;
}

function renderItemsTable(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  const columns = tableColumns(document);
  ensureSpace(document, 52, fontSource);
  document
    .fontSize(BODY_FONT_SIZE)
    .text(model.itemSectionTitle, CONTENT_MARGIN, document.y, {
      width: contentWidth(document),
      lineGap: BODY_LINE_GAP,
    });
  document.y += 3;
  drawTableHeader(document, model, columns);

  for (const item of model.items) {
    const values = [
      item.productCode,
      item.productDescription,
      item.quantity,
      item.unit,
      item.unitPriceDisplay,
      item.amountDisplay,
    ];
    document.fontSize(9.3);
    const rowHeight =
      Math.max(
        24,
        ...values.map((value, index) =>
          document.heightOfString(value, {
            width: columns[index].width - 6,
            lineGap: 0.7,
          }),
        ),
      ) + 8;

    ensureSpace(document, rowHeight, fontSource, () =>
      drawTableHeader(document, model, columns),
    );
    const y = document.y;
    drawTableText(document, values, columns, y, rowHeight, 9.3);
    horizontalRule(document, y + rowHeight, 0.35);
  }
  document.y += 3;
}

function remarkLineHeight(
  document: PDFKit.PDFDocument,
  line: PurchaseContractPdfRemarkLine,
  markerWidth: number,
): number {
  const contentX = line.marker ? markerWidth : 0;
  return document.heightOfString(line.content || line.marker || "", {
    width: contentWidth(document) - contentX,
    lineGap: BODY_LINE_GAP,
  });
}

function renderRemarkLine(
  document: PDFKit.PDFDocument,
  line: PurchaseContractPdfRemarkLine,
) {
  const y = document.y;
  const markerWidth = line.marker ? 22 : 0;
  if (line.marker) {
    document.text(line.marker, CONTENT_MARGIN, y, {
      width: markerWidth,
      lineGap: BODY_LINE_GAP,
    });
  }
  document.text(line.content, CONTENT_MARGIN + markerWidth, y, {
    width: contentWidth(document) - markerWidth,
    lineGap: BODY_LINE_GAP,
  });
}

function renderRemarks(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  if (model.remarks.length > 0) {
    ensureSpace(document, 22, fontSource);
    document
      .fontSize(BODY_FONT_SIZE)
      .text("备注：", CONTENT_MARGIN, document.y, {
        width: contentWidth(document),
        lineGap: BODY_LINE_GAP,
      });
    document.y += 1;
    for (const line of model.remarks) {
      document.fontSize(BODY_FONT_SIZE);
      const markerWidth = line.marker ? 22 : 0;
      ensureSpace(
        document,
        remarkLineHeight(document, line, markerWidth),
        fontSource,
      );
      renderRemarkLine(document, line);
    }
    document.y += 2;
  }

  if (model.specialDelivery) {
    ensureSpace(document, 30, fontSource);
    const lines = ["特别注意："];
    if (model.specialDelivery.address) {
      lines.push(`此次订单发货地址如下：${model.specialDelivery.address}`);
    }
    if (model.specialDelivery.recipient || model.specialDelivery.phone) {
      const recipient = model.specialDelivery.recipient ?? "";
      const phone = model.specialDelivery.phone
        ? `${recipient ? "    " : ""}${model.specialDelivery.phone}`
        : "";
      lines.push(`收件人：${recipient}${phone}`);
    }
    document
      .fontSize(BODY_FONT_SIZE)
      .text(lines.join("\n"), CONTENT_MARGIN, document.y, {
        width: contentWidth(document),
        lineGap: BODY_LINE_GAP,
      });
    document.y += 2;
  }
}

function renderTotal(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  ensureSpace(document, 34, fontSource);
  const y = document.y;
  horizontalRule(document, y, 1.15);
  const upperText = `总计人民币（大写）：${model.totalAmountUppercase}`;
  const numericWidth = 102;
  const upperWidth = contentWidth(document) - numericWidth - 8;
  document.fontSize(BODY_FONT_SIZE);
  const height = Math.max(
    25,
    document.heightOfString(upperText, { width: upperWidth, lineGap: 1 }),
  );
  document.text(upperText, CONTENT_MARGIN, y + 6, {
    width: upperWidth,
    lineGap: 1,
  });
  document.text(
    model.totalAmountDisplay,
    CONTENT_MARGIN + upperWidth + 8,
    y + 6,
    {
      width: numericWidth,
      align: "right",
    },
  );
  document.y = y + height + 9;
  horizontalRule(document, document.y, 0.65);
  document.y += 4;
}

function renderTerms(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  for (const term of model.terms) {
    ensureSpace(document, 22, fontSource);
    document
      .fontSize(BODY_FONT_SIZE)
      .text(`${term.heading}${term.value}`, CONTENT_MARGIN, document.y, {
        width: contentWidth(document),
        lineGap: BODY_LINE_GAP,
      });
    document.y += 1;
  }
}

export function purchaseContractPdfPartyRows(
  label: "买方" | "卖方",
  party: PurchaseContractPdfParty,
) {
  return [
    { label, value: party.legalName },
    { label: "地址", value: party.address },
    { label: "电话", value: party.phone },
    { label: "联系人", value: party.contactName },
    { label: "盖章", value: "" },
  ];
}

function renderBottomPartyBlock(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  const gap = 20;
  const columnWidth = (contentWidth(document) - gap) / 2;
  const buyerRows = purchaseContractPdfPartyRows("买方", model.buyer);
  const sellerRows = purchaseContractPdfPartyRows("卖方", model.seller);
  document.fontSize(BODY_FONT_SIZE);
  const rowHeights = buyerRows.map((buyerRow, index) => {
    const sellerRow = sellerRows[index];
    if (buyerRow.label === "盖章") {
      return 42;
    }
    return (
      Math.max(
        document.heightOfString(`${buyerRow.label}：${buyerRow.value}`, {
          width: columnWidth - 5,
          lineGap: 2,
        }),
        document.heightOfString(`${sellerRow.label}：${sellerRow.value}`, {
          width: columnWidth - 5,
          lineGap: 2,
        }),
      ) + 3
    );
  });
  const blockHeight = rowHeights.reduce((sum, height) => sum + height, 0) + 14;

  const pageBreak = ensureSpace(document, blockHeight + 6, fontSource);
  const y = pageBreak
    ? document.y
    : Math.max(document.y, bodyBottom(document) - blockHeight - 3);
  horizontalRule(document, y, 1.1);
  const separatorX = CONTENT_MARGIN + columnWidth + gap / 2;
  document
    .moveTo(separatorX, y + 7)
    .lineTo(separatorX, y + blockHeight)
    .lineWidth(0.45)
    .strokeColor("#555555")
    .stroke();
  let rowY = y + 7;
  buyerRows.forEach((buyerRow, index) => {
    const sellerRow = sellerRows[index];
    document.fontSize(BODY_FONT_SIZE).text(
      `${buyerRow.label}：${buyerRow.value}`,
      CONTENT_MARGIN,
      rowY,
      { width: columnWidth - 5, lineGap: 2 },
    );
    document.text(
      `${sellerRow.label}：${sellerRow.value}`,
      separatorX + gap / 2,
      rowY,
      { width: columnWidth - 5, lineGap: 2 },
    );
    rowY += rowHeights[index];
  });
  document.y = y + blockHeight + 3;
}

function renderFooters(
  document: PDFKit.PDFDocument,
  fontSource: PurchaseContractPdfFontSource,
) {
  const range = document.bufferedPageRange();
  const footers = purchaseContractPdfPageFooters(range.count);
  footers.forEach((footer, index) => {
    document.switchToPage(range.start + index);
    document.page.margins.bottom = 0;
    applyFont(document, fontSource)
      .fontSize(8)
      .fillColor("#666666")
      .text(footer, CONTENT_MARGIN, document.page.height - 22, {
        width: contentWidth(document),
        align: "center",
        lineBreak: false,
      });
  });
}

function renderDocument(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  applyFont(document, fontSource).fillColor("#111111");
  renderHeader(document, model);
  renderItemsTable(document, model, fontSource);
  renderRemarks(document, model, fontSource);
  renderTotal(document, model, fontSource);
  renderTerms(document, model, fontSource);
  renderBottomPartyBlock(document, model, fontSource);
  renderFooters(document, fontSource);
}

export function renderPurchaseContractPdf(
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      layout: "portrait",
      margins: {
        top: PAGE_TOP_MARGIN,
        right: CONTENT_MARGIN,
        bottom: PAGE_BOTTOM_MARGIN,
        left: CONTENT_MARGIN,
      },
      bufferPages: true,
      info: {
        Title: `${model.primaryTitle}-${model.subtitle}-${model.contractNo}`,
        Creator: "Trading ERP",
      },
    });
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    try {
      renderDocument(document, model, fontSource);
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}
