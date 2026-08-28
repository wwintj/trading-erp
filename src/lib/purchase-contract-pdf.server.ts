import "server-only";

import { constants } from "node:fs";
import { access } from "node:fs/promises";

import PDFDocument from "pdfkit";

import {
  purchaseContractPdfPageFooter,
  type PurchaseContractPdfViewModel,
} from "@/lib/purchase-contract-pdf";

export const PURCHASE_CONTRACT_PDF_DEFAULT_FONT_PATH =
  "/usr/share/fonts/truetype/cwtex/cwfs.ttf";

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
type AssertReadable = (path: string) => Promise<void>;

export async function resolvePurchaseContractPdfFontPath(
  source: EnvironmentSource = process.env,
  assertReadable: AssertReadable = async (path) => {
    await access(path, constants.R_OK);
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

const PAGE_MARGIN = 45;
const PAGE_BOTTOM_MARGIN = 62;
const FOOTER_Y_OFFSET = 37;

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

function pageWidth(document: PDFKit.PDFDocument): number {
  return document.page.width - PAGE_MARGIN * 2;
}

function ensureSpace(
  document: PDFKit.PDFDocument,
  requiredHeight: number,
  afterPageBreak?: () => void,
) {
  if (document.y + requiredHeight <= bodyBottom(document)) {
    return;
  }

  document.addPage();
  afterPageBreak?.();
}

function sectionHeading(document: PDFKit.PDFDocument, title: string) {
  ensureSpace(document, 30);
  const y = document.y;
  document
    .fontSize(12)
    .fillColor("#111111")
    .text(title, PAGE_MARGIN, y, { width: pageWidth(document) });
  document
    .moveTo(PAGE_MARGIN, document.y + 3)
    .lineTo(document.page.width - PAGE_MARGIN, document.y + 3)
    .lineWidth(0.7)
    .strokeColor("#555555")
    .stroke();
  document.y += 12;
}

function renderParty(
  document: PDFKit.PDFDocument,
  party: PurchaseContractPdfViewModel["buyer"],
) {
  ensureSpace(document, 26);
  document.fontSize(11).fillColor("#111111").text(party.heading);
  document.moveDown(0.2);

  for (const field of party.fields) {
    ensureSpace(document, 24);
    document
      .fontSize(9.5)
      .fillColor("#222222")
      .text(`${field.label}：${field.value}`, {
        width: pageWidth(document),
        lineGap: 2,
      });
    document.moveDown(0.2);
  }
  document.moveDown(0.5);
}

type TableColumn = {
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

function tableColumns(document: PDFKit.PDFDocument): TableColumn[] {
  const fixedWidth = 28 + 60 + 155 + 62 + 34 + 72;
  return [
    { label: "序号", width: 28, align: "center" },
    { label: "产品代码", width: 60 },
    { label: "产品名称 / 规格型号", width: 155 },
    { label: "数量", width: 62, align: "right" },
    { label: "单位", width: 34, align: "center" },
    { label: "单价（元）", width: 72, align: "right" },
    {
      label: "金额（元）",
      width: pageWidth(document) - fixedWidth,
      align: "right",
    },
  ];
}

function drawTableCells(
  document: PDFKit.PDFDocument,
  values: string[],
  columns: TableColumn[],
  y: number,
  height: number,
  fill?: string,
) {
  let x = PAGE_MARGIN;
  columns.forEach((column, index) => {
    if (fill) {
      document.rect(x, y, column.width, height).fill(fill);
    }
    document
      .rect(x, y, column.width, height)
      .lineWidth(0.5)
      .strokeColor("#777777")
      .stroke();
    document
      .fontSize(8.5)
      .fillColor("#111111")
      .text(values[index], x + 4, y + 6, {
        width: column.width - 8,
        height: height - 10,
        align: column.align ?? "left",
        lineGap: 1,
      });
    x += column.width;
  });
  document.y = y + height;
}

function drawTableHeader(
  document: PDFKit.PDFDocument,
  columns: TableColumn[],
) {
  drawTableCells(
    document,
    columns.map((column) => column.label),
    columns,
    document.y,
    27,
    "#eeeeee",
  );
}

function renderItemsTable(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
) {
  const columns = tableColumns(document);
  ensureSpace(document, 57);
  drawTableHeader(document, columns);

  for (const item of model.items) {
    const values = [
      item.sequence,
      item.productCode,
      item.productDescription,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.amount,
    ];
    const rowHeight = Math.max(
      27,
      ...values.map((value, index) =>
        document.heightOfString(value, {
          width: columns[index].width - 8,
          lineGap: 1,
        }),
      ),
    ) + 11;

    ensureSpace(document, rowHeight, () => drawTableHeader(document, columns));
    drawTableCells(document, values, columns, document.y, rowHeight);
  }

  ensureSpace(document, 30);
  document
    .fontSize(10.5)
    .fillColor("#111111")
    .text(`合同总金额（人民币）：${model.totalAmount} 元`, {
      width: pageWidth(document),
      align: "right",
    });
  document.moveDown(1);
}

function renderTerms(
  document: PDFKit.PDFDocument,
  terms: PurchaseContractPdfViewModel["terms"],
) {
  if (terms.length === 0) {
    return;
  }

  sectionHeading(document, "交货与合同条款");
  for (const term of terms) {
    ensureSpace(document, 28);
    document
      .fontSize(9.5)
      .fillColor("#222222")
      .text(`${term.label}：${term.value}`, {
        width: pageWidth(document),
        lineGap: 3,
      });
    document.moveDown(0.45);
  }
}

function renderSignatures(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
) {
  ensureSpace(document, 82);
  sectionHeading(document, "签章");
  const width = (pageWidth(document) - 24) / 2;
  const y = document.y + 4;
  document
    .fontSize(10)
    .text(`买方（盖章）：${model.buyerSignature}`, PAGE_MARGIN, y, {
      width,
      lineGap: 2,
    })
    .text(`卖方（盖章）：${model.sellerSignature}`, PAGE_MARGIN + width + 24, y, {
      width,
      lineGap: 2,
    });
  document.y = Math.max(document.y, y + 54);
}

function renderFooters(
  document: PDFKit.PDFDocument,
  fontSource: PurchaseContractPdfFontSource,
) {
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.page.margins.bottom = 0;
    applyFont(document, fontSource)
      .fontSize(8.5)
      .fillColor("#555555")
      .text(
        purchaseContractPdfPageFooter(
          index - range.start + 1,
          range.count,
        ),
        PAGE_MARGIN,
        document.page.height - FOOTER_Y_OFFSET,
        {
          width: pageWidth(document),
          align: "center",
          lineBreak: false,
        },
      );
  }
}

function renderDocument(
  document: PDFKit.PDFDocument,
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
) {
  applyFont(document, fontSource).fillColor("#111111");
  document
    .fontSize(22)
    .text(model.title, PAGE_MARGIN, document.y, {
      width: pageWidth(document),
      align: "center",
    });
  document.moveDown(0.8);
  document
    .fontSize(10)
    .text(`合同编号：${model.contractNo}`, { align: "right" })
    .text(`签订日期：${model.signingDate}`, { align: "right" });
  if (model.signingPlace) {
    document.text(`签订地点：${model.signingPlace}`, { align: "right" });
  }
  document.moveDown(1);

  sectionHeading(document, "买卖双方");
  renderParty(document, model.buyer);
  renderParty(document, model.seller);

  sectionHeading(document, "合同明细");
  renderItemsTable(document, model);
  renderTerms(document, model.terms);
  renderSignatures(document, model);
  renderFooters(document, fontSource);
}

export function renderPurchaseContractPdf(
  model: PurchaseContractPdfViewModel,
  fontSource: PurchaseContractPdfFontSource,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margins: {
        top: PAGE_MARGIN,
        right: PAGE_MARGIN,
        bottom: PAGE_BOTTOM_MARGIN,
        left: PAGE_MARGIN,
      },
      bufferPages: true,
      info: {
        Title: `${model.title}-${model.contractNo}`,
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
