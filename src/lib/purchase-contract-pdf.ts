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

export type PurchaseContractPdfParty = {
  heading: "买方" | "卖方";
  legalName: string;
  fields: Array<{ label: string; value: string }>;
};

export type PurchaseContractPdfViewModel = {
  title: "采购合同";
  contractNo: string;
  signingDate: string;
  signingPlace: string | null;
  buyer: PurchaseContractPdfParty;
  seller: PurchaseContractPdfParty;
  items: Array<{
    sequence: string;
    productCode: string;
    productDescription: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    amount: string;
  }>;
  totalAmount: string;
  terms: Array<{ label: string; value: string }>;
  buyerSignature: string;
  sellerSignature: string;
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

function dateOnly(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new PurchaseContractPdfIntegrityError();
  }
  return value.toISOString().slice(0, 10);
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

function party(
  heading: "买方" | "卖方",
  values: {
    legalName: string;
    unifiedCreditCode: string | null;
    contactName: string | null;
    phone: string | null;
    address: string | null;
    bankName: string | null;
    bankAccount: string | null;
  },
): PurchaseContractPdfParty {
  const legalName = requiredText(values.legalName);
  const fields = [
    ["名称", legalName],
    ["统一社会信用代码", optionalText(values.unifiedCreditCode)],
    ["联系人", optionalText(values.contactName)],
    ["电话", optionalText(values.phone)],
    ["地址", optionalText(values.address)],
    ["开户行", optionalText(values.bankName)],
    ["银行账号", optionalText(values.bankAccount)],
  ]
    .filter((field): field is [string, string] => field[1] !== null)
    .map(([label, value]) => ({ label, value }));

  return { heading, legalName, fields };
}

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
    return {
      sequence: String(index + 1),
      productCode: requiredText(item.productCode),
      productDescription: specification
        ? `${productName}\n规格/型号：${specification}`
        : productName,
      quantity: item.quantity.toFixed(3),
      unit: requiredText(item.unit),
      unitPrice: item.unitPrice.toFixed(4),
      amount: item.amount.toFixed(2),
    };
  });

  if (!decimalEquals(source.totalAmount.toString(), calculated.totalAmount)) {
    throw new PurchaseContractPdfIntegrityError();
  }

  const terms = [
    ["包装要求", optionalText(source.packagingTerms)],
    ["交货日期", source.deliveryDate ? dateOnly(source.deliveryDate) : null],
    ["收货地址", optionalText(source.deliveryAddress)],
    ["收货人", optionalText(source.deliveryContactName)],
    ["收货电话", optionalText(source.deliveryContactPhone)],
    ["验收条款", optionalText(source.inspectionTerms)],
    ["付款条款", optionalText(source.paymentTerms)],
    ["运输方式", optionalText(source.shippingMethod)],
    ["违约/迟延条款", optionalText(source.breachTerms)],
    ["质量条款", optionalText(source.qualityTerms)],
    ["变更条款", optionalText(source.changeTerms)],
    ["争议解决", optionalText(source.disputeTerms)],
    ["补充条款", optionalText(source.additionalTerms)],
  ]
    .filter((term): term is [string, string] => term[1] !== null)
    .map(([label, value]) => ({ label, value }));

  const buyer = party("买方", {
    legalName: source.buyerLegalName,
    unifiedCreditCode: source.buyerUnifiedCreditCode,
    contactName: source.buyerContactName,
    phone: source.buyerPhone,
    address: source.buyerAddress,
    bankName: source.buyerBankName,
    bankAccount: source.buyerBankAccount,
  });
  const seller = party("卖方", {
    legalName: source.sellerLegalName,
    unifiedCreditCode: source.sellerUnifiedCreditCode,
    contactName: source.sellerContactName,
    phone: source.sellerPhone,
    address: source.sellerAddress,
    bankName: source.sellerBankName,
    bankAccount: source.sellerBankAccount,
  });

  return {
    title: "采购合同",
    contractNo: requiredText(source.contractNo),
    signingDate: dateOnly(source.signingDate),
    signingPlace: optionalText(source.signingPlace),
    buyer,
    seller,
    items,
    totalAmount: source.totalAmount.toFixed(2),
    terms,
    buyerSignature: buyer.legalName,
    sellerSignature: seller.legalName,
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
