import {
  calculateExactContractTotal,
  type PurchaseContractStatus,
} from "@/lib/purchase-contract";

type DecimalValue = {
  toFixed(decimalPlaces: number): string;
  toString(): string;
};

export type PurchaseContractPdfSource = {
  id: string;
  contractNo: string;
  status: PurchaseContractStatus;
  signingDate: Date;
  signingPlace: string | null;
  buyerLegalName: string;
  buyerUnifiedCreditCode: string | null;
  buyerContactName: string | null;
  buyerPhone: string | null;
  buyerAddress: string | null;
  buyerBankName: string | null;
  buyerBankAccount: string | null;
  sellerLegalName: string;
  sellerUnifiedCreditCode: string | null;
  sellerContactName: string | null;
  sellerPhone: string | null;
  sellerAddress: string | null;
  sellerBankName: string | null;
  sellerBankAccount: string | null;
  deliveryDate: Date | null;
  deliveryAddress: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  packagingTerms: string | null;
  inspectionTerms: string | null;
  paymentTerms: string | null;
  shippingMethod: string | null;
  breachTerms: string | null;
  qualityTerms: string | null;
  changeTerms: string | null;
  disputeTerms: string | null;
  additionalTerms: string | null;
  totalAmount: DecimalValue;
  items: Array<{
    id: string;
    productId: string;
    sortOrder: number;
    productCode: string;
    productName: string;
    specification: string | null;
    unit: string;
    quantity: DecimalValue;
    unitPrice: DecimalValue;
    amount: DecimalValue;
  }>;
};

export const PURCHASE_CONTRACT_PDF_ITEM_SECTION_TITLE =
  "一、品名、商标、规格、产地、数量、单价、金额：";

export const PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS = [
  "型号",
  "品名、商标、规格、产地",
  "数量",
  "单位",
  "单价",
  "金额",
] as const;

export type PurchaseContractPdfParty = {
  legalName: string;
  address: string;
  phone: string;
  contactName: string;
};

export type PurchaseContractPdfRemarkLine = {
  marker: string | null;
  content: string;
};

export type PurchaseContractPdfViewModel = {
  primaryTitle: string;
  subtitle: "采购合同";
  contractNo: string;
  signingDate: string;
  signingPlace: string | null;
  buyer: PurchaseContractPdfParty;
  seller: PurchaseContractPdfParty;
  itemSectionTitle: typeof PURCHASE_CONTRACT_PDF_ITEM_SECTION_TITLE;
  itemTableLabels: typeof PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS;
  items: Array<{
    productCode: string;
    productDescription: string;
    quantity: string;
    quantityDisplay: string;
    unit: string;
    unitPrice: string;
    unitPriceDisplay: string;
    amount: string;
    amountDisplay: string;
  }>;
  remarks: PurchaseContractPdfRemarkLine[];
  specialDelivery: {
    address: string | null;
    recipient: string | null;
    phone: string | null;
  } | null;
  totalAmount: string;
  totalAmountDisplay: string;
  totalAmountUppercase: string;
  terms: Array<{
    sectionNumber: number;
    heading: string;
    label: string;
    value: string;
  }>;
};

export class PurchaseContractPdfIntegrityError extends Error {
  constructor() {
    super("Purchase contract PDF data integrity check failed");
  }
}

function requiredText(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new PurchaseContractPdfIntegrityError();
  }
  return normalized;
}

function optionalText(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function dateOnlyParts(value: Date): [string, string, string] {
  if (Number.isNaN(value.getTime())) {
    throw new PurchaseContractPdfIntegrityError();
  }
  const isoDate = value.toISOString().slice(0, 10);
  return isoDate.split("-") as [string, string, string];
}

function chineseDate(value: Date): string {
  const [year, month, day] = dateOnlyParts(value);
  return `${year}年${month}月${day}日`;
}

function canonicalDecimal(value: string): string | null {
  const match = value.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }

  const integer = match[1].replace(/^0+(?=\d)/, "");
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

function decimalEquals(left: string, right: string): boolean {
  const normalizedLeft = canonicalDecimal(left);
  const normalizedRight = canonicalDecimal(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

export function formatExactAmountWithThousands(value: string): string {
  const match = value.match(/^(\d+)(\.\d+)?$/);
  if (!match) {
    throw new PurchaseContractPdfIntegrityError();
  }
  const integer = match[1].replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}${match[2] ?? ""}`;
}

const RMB_DIGITS = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const RMB_SMALL_UNITS = ["仟", "佰", "拾", ""];
const RMB_GROUP_UNITS = ["", "万", "亿", "万亿"];

function fourDigitRmb(group: string): string {
  const digits = group.padStart(4, "0");
  let result = "";
  let pendingZero = false;

  for (let index = 0; index < digits.length; index += 1) {
    const digit = digits.charCodeAt(index) - 48;
    const hasLaterValue = /[1-9]/.test(digits.slice(index + 1));
    if (digit === 0) {
      if (result && hasLaterValue) {
        pendingZero = true;
      }
      continue;
    }
    if (pendingZero) {
      result += RMB_DIGITS[0];
      pendingZero = false;
    }
    result += `${RMB_DIGITS[digit]}${RMB_SMALL_UNITS[index]}`;
  }

  return result;
}

function integerRmb(integer: string): string {
  const normalized = integer.replace(/^0+(?=\d)/, "");
  if (normalized === "0") {
    return RMB_DIGITS[0];
  }
  if (normalized.length > 16) {
    throw new PurchaseContractPdfIntegrityError();
  }

  const groups: string[] = [];
  for (let end = normalized.length; end > 0; end -= 4) {
    groups.unshift(normalized.slice(Math.max(0, end - 4), end));
  }

  let result = "";
  let pendingZero = false;
  groups.forEach((group, index) => {
    const paddedGroup = group.padStart(4, "0");
    const groupUnitIndex = groups.length - index - 1;
    if (/^0{4}$/.test(paddedGroup)) {
      if (result && groups.slice(index + 1).some((next) => !/^0+$/.test(next))) {
        pendingZero = true;
      }
      return;
    }

    const needsLeadingZero =
      result !== "" && (pendingZero || paddedGroup.startsWith("0"));
    if (needsLeadingZero && !result.endsWith(RMB_DIGITS[0])) {
      result += RMB_DIGITS[0];
    }
    result += `${fourDigitRmb(paddedGroup)}${RMB_GROUP_UNITS[groupUnitIndex]}`;
    pendingZero = false;
  });

  return result;
}

export function formatRmbUppercase(value: string): string {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new PurchaseContractPdfIntegrityError();
  }
  const integer = match[1].replace(/^0+(?=\d)/, "");
  if (integer.length > 16) {
    throw new PurchaseContractPdfIntegrityError();
  }
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const jiao = fraction.charCodeAt(0) - 48;
  const fen = fraction.charCodeAt(1) - 48;

  let result = `${integerRmb(integer)}元`;
  if (jiao === 0 && fen === 0) {
    return `${result}整`;
  }
  if (jiao > 0) {
    result += `${RMB_DIGITS[jiao]}角`;
  } else if (fen > 0) {
    result += RMB_DIGITS[0];
  }
  if (fen > 0) {
    result += `${RMB_DIGITS[fen]}分`;
  }
  return result;
}

function party(values: {
  legalName: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
}): PurchaseContractPdfParty {
  return {
    legalName: requiredText(values.legalName),
    address: optionalText(values.address) ?? "",
    phone: optionalText(values.phone) ?? "",
    contactName: optionalText(values.contactName) ?? "",
  };
}

export function purchaseContractPdfRemarkLines(
  value: string | null,
): PurchaseContractPdfRemarkLine[] {
  const normalized = optionalText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const numbered = line.match(/^(\d+\))\s*(.*)$/);
      if (!numbered) {
        return { marker: null, content: line };
      }
      return { marker: numbered[1], content: numbered[2] };
    });
}

const CHINESE_SECTION_NUMBERS = [
  "零",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
];

export function buildPurchaseContractPdfViewModel(
  source: PurchaseContractPdfSource,
): PurchaseContractPdfViewModel {
  if (source.items.length === 0) {
    throw new PurchaseContractPdfIntegrityError();
  }

  const persistedItems = [...source.items].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const itemInputs = persistedItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
  }));
  const calculated = calculateExactContractTotal(itemInputs);
  if (!calculated) {
    throw new PurchaseContractPdfIntegrityError();
  }

  const items = persistedItems.map((item, index) => {
    const exact = calculated.items[index];
    if (!decimalEquals(item.amount.toString(), exact.amount)) {
      throw new PurchaseContractPdfIntegrityError();
    }

    const productName = requiredText(item.productName);
    const specification = optionalText(item.specification);
    const unitPrice = item.unitPrice.toFixed(4);
    const amount = item.amount.toFixed(2);
    return {
      productCode: requiredText(item.productCode),
      productDescription: specification
        ? `${productName}\n规格：${specification}`
        : productName,
      quantity: item.quantity.toFixed(3),
      quantityDisplay: item.quantity.toFixed(2),
      unit: requiredText(item.unit),
      unitPrice,
      unitPriceDisplay: `¥${formatExactAmountWithThousands(
        item.unitPrice.toFixed(2),
      )}`,
      amount,
      amountDisplay: `¥${formatExactAmountWithThousands(amount)}`,
    };
  });

  if (!decimalEquals(source.totalAmount.toString(), calculated.totalAmount)) {
    throw new PurchaseContractPdfIntegrityError();
  }

  const storedTerms: Array<[string, string | null]> = [
    ["验收方法", optionalText(source.inspectionTerms)],
    ["质量/异议条款", optionalText(source.qualityTerms)],
    ["交货时间", source.deliveryDate ? chineseDate(source.deliveryDate) : null],
    ["货款结算", optionalText(source.paymentTerms)],
    ["运输方式及费用承担", optionalText(source.shippingMethod)],
    ["合同变更", optionalText(source.changeTerms)],
    ["争议解决", optionalText(source.disputeTerms)],
    ["违约责任", optionalText(source.breachTerms)],
    ["附加条款", optionalText(source.additionalTerms)],
  ];
  const terms = storedTerms
    .filter((term): term is [string, string] => term[1] !== null)
    .map(([label, value], index) => {
      const sectionNumber = index + 2;
      return {
        sectionNumber,
        heading: `${CHINESE_SECTION_NUMBERS[sectionNumber]}、${label}：`,
        label,
        value,
      };
    });

  const buyer = party({
    legalName: source.buyerLegalName,
    contactName: source.buyerContactName,
    phone: source.buyerPhone,
    address: source.buyerAddress,
  });
  const seller = party({
    legalName: source.sellerLegalName,
    contactName: source.sellerContactName,
    phone: source.sellerPhone,
    address: source.sellerAddress,
  });
  const deliveryAddress = optionalText(source.deliveryAddress);
  const deliveryContactName = optionalText(source.deliveryContactName);
  const deliveryContactPhone = optionalText(source.deliveryContactPhone);
  const totalAmount = source.totalAmount.toFixed(2);

  return {
    primaryTitle: buyer.legalName,
    subtitle: "采购合同",
    contractNo: requiredText(source.contractNo),
    signingDate: chineseDate(source.signingDate),
    signingPlace: optionalText(source.signingPlace),
    buyer,
    seller,
    itemSectionTitle: PURCHASE_CONTRACT_PDF_ITEM_SECTION_TITLE,
    itemTableLabels: PURCHASE_CONTRACT_PDF_ITEM_TABLE_LABELS,
    items,
    remarks: purchaseContractPdfRemarkLines(source.packagingTerms),
    specialDelivery:
      deliveryAddress || deliveryContactName || deliveryContactPhone
        ? {
            address: deliveryAddress,
            recipient: deliveryContactName,
            phone: deliveryContactPhone,
          }
        : null,
    totalAmount,
    totalAmountDisplay: `¥${formatExactAmountWithThousands(totalAmount)}`,
    totalAmountUppercase: formatRmbUppercase(totalAmount),
    terms,
  };
}

function sanitizeAsciiContractNo(contractNo: string): string {
  const sanitized = contractNo
    .replace(/[\r\n]/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 64);
  return sanitized || "contract";
}

function sanitizeDisplayContractNo(contractNo: string): string {
  const sanitized = contractNo
    .replace(/[\u0000-\u001f\u007f]/g, "-")
    .replace(/["\\/:*?<>|]/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 64);
  return sanitized || "采购合同";
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function purchaseContractPdfContentDisposition(contractNo: string): string {
  const asciiFilename = `purchase-contract-${sanitizeAsciiContractNo(contractNo)}.pdf`;
  const displayFilename = `采购合同-${sanitizeDisplayContractNo(contractNo)}.pdf`;
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeRfc5987(displayFilename)}`;
}

export function purchaseContractPdfPageFooter(
  pageNumber: number,
  pageCount: number,
): string {
  return `第 ${pageNumber} 页 / 共 ${pageCount} 页`;
}

export function purchaseContractPdfPageFooters(pageCount: number): string[] {
  if (pageCount <= 1) {
    return [];
  }
  return Array.from({ length: pageCount }, (_, index) =>
    purchaseContractPdfPageFooter(index + 1, pageCount),
  );
}
