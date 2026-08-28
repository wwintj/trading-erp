import "server-only";

import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";

import {
  purchaseContractPdfPageFooters,
  type PurchaseContractPdfParty,
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

const PAGE_WIDTH = 595.22;
const PAGE_HEIGHT = 842;
const CONTENT_MARGIN = 53;
const PAGE_TOP_MARGIN = 34;
const PAGE_BOTTOM_MARGIN = 45;
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
  document.moveDown(0.62);

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
  document.y = y + blockHeight + 8;
}

type TableColumn = {
  width: number;
  align?: "left" | "center" | "right";
};

function tableColumns(document: PDFKit.PDFDocument): TableColumn[] {
  const fixedWidth = 64 + 178 + 56 + 34 + 68;
  return [
    { width: 64 },
    { width: 178 },
    { width: 56, align: "right" },
    { width: 34, align: "center" },
    { width: 68, align: "right" },
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
  document.y += 5;
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
  document.y += 5;
}

function renderRemarks(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  if (model.remarks) {
    ensureSpace(document, 23, fontSource);
    document
      .fontSize(BODY_FONT_SIZE)
      .text(`备注：${model.remarks}`, CONTENT_MARGIN, document.y, {
        width: contentWidth(document),
        lineGap: BODY_LINE_GAP,
      });
    document.y += 3;
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
    document.y += 3;
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
  document.y += 6;
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
    document.y += 2;
  }
}

function partyText(label: "买方" | "卖方", party: PurchaseContractPdfParty) {
  return [
    `${label}：${party.legalName}`,
    ...party.fields.map((field) => `${field.label}：${field.value}`),
  ].join("\n");
}

function renderStackedPartyBlock(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  for (const [label, party] of [
    ["买方", model.buyer],
    ["卖方", model.seller],
  ] as const) {
    ensureSpace(document, 70, fontSource);
    horizontalRule(document, document.y, 1);
    document.y += 7;
    document
      .fontSize(BODY_FONT_SIZE)
      .text(partyText(label, party), CONTENT_MARGIN, document.y, {
        width: contentWidth(document),
        lineGap: 2,
      });
    document.text("盖章：", CONTENT_MARGIN, document.y, {
      width: contentWidth(document),
      lineGap: 2,
    });
    document.y += 36;
  }
}

function renderBottomPartyBlock(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  const gap = 20;
  const columnWidth = (contentWidth(document) - gap) / 2;
  const buyerText = partyText("买方", model.buyer);
  const sellerText = partyText("卖方", model.seller);
  document.fontSize(BODY_FONT_SIZE);
  const textHeight = Math.max(
    document.heightOfString(buyerText, { width: columnWidth - 5, lineGap: 2 }),
    document.heightOfString(sellerText, { width: columnWidth - 5, lineGap: 2 }),
  );
  const blockHeight = textHeight + 58;
  const fullPageBodyHeight = PAGE_HEIGHT - PAGE_TOP_MARGIN - PAGE_BOTTOM_MARGIN;
  if (blockHeight > fullPageBodyHeight) {
    renderStackedPartyBlock(document, model, fontSource);
    return;
  }

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
  document.fontSize(BODY_FONT_SIZE).text(buyerText, CONTENT_MARGIN, y + 7, {
    width: columnWidth - 5,
    lineGap: 2,
  });
  document.text(sellerText, separatorX + gap / 2, y + 7, {
    width: columnWidth - 5,
    lineGap: 2,
  });
  const stampY = y + blockHeight - 28;
  document.text("盖章：", CONTENT_MARGIN, stampY, {
    width: columnWidth - 5,
  });
  document.text("盖章：", separatorX + gap / 2, stampY, {
    width: columnWidth - 5,
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
      .text(footer, CONTENT_MARGIN, document.page.height - 27, {
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
