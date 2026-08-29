export const PURCHASE_CONTRACT_GENERIC_ERROR_MESSAGE =
  "采购合同保存失败，请稍后重试。";
export const PURCHASE_CONTRACT_DUPLICATE_NO_MESSAGE = "合同编号已存在。";
export const PURCHASE_CONTRACT_FORBIDDEN_MESSAGE =
  "你没有权限修改采购合同。";
export const PURCHASE_CONTRACT_SIGN_IN_MESSAGE =
  "请先登录后再修改采购合同。";
export const PURCHASE_CONTRACT_IMMUTABLE_MESSAGE =
  "当前状态的采购合同不可编辑。";
export const PURCHASE_CONTRACT_VALIDATION_MESSAGE =
  "请检查并修正标记的字段。";

export const PURCHASE_CONTRACT_FIELD_LIMITS = {
  contractNo: 64,
  signingPlace: 255,
  deliveryAddress: 10000,
  deliveryContactName: 128,
  deliveryContactPhone: 64,
  packagingTerms: 10000,
  inspectionTerms: 10000,
  paymentTerms: 10000,
  shippingMethod: 10000,
  breachTerms: 10000,
  qualityTerms: 10000,
  changeTerms: 10000,
  specialNotice: 10000,
  disputeTerms: 10000,
  additionalTerms: 10000,
} as const;

export type PurchaseContractStatus = "DRAFT" | "FINAL" | "CANCELLED";

export const PURCHASE_CONTRACT_STATUS_LABELS: Record<
  PurchaseContractStatus,
  string
> = {
  DRAFT: "草稿",
  FINAL: "已定稿",
  CANCELLED: "已取消",
};

export type PurchaseContractItemInput = {
  itemId?: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export type PurchaseContractInput = {
  contractNo: string;
  signingDate: string;
  signingPlace: string | null;
  companyId: string;
  supplierId: string;
  deliveryDate: string | null;
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
  specialNotice: string | null;
  disputeTerms: string | null;
  additionalTerms: string | null;
  items: PurchaseContractItemInput[];
};

export type PurchaseContractFormState = {
  status: "idle" | "success" | "error";
  message: string;
  contractId?: string;
  fieldErrors?: Record<string, string>;
};

export const INITIAL_PURCHASE_CONTRACT_FORM_STATE: PurchaseContractFormState = {
  status: "idle",
  message: "",
};

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string): string | null {
  return value === "" ? null : value;
}

function isValidDateText(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type ParsedDecimal = {
  digits: bigint;
  scale: number;
};

function parseUnsignedDecimal(
  value: string,
  maximumIntegerDigits: number,
  maximumScale: number,
): ParsedDecimal | null {
  const match = value.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }

  const integerPart = match[1].replace(/^0+(?=\d)/, "");
  const fractionalPart = match[2] ?? "";
  if (
    integerPart.length > maximumIntegerDigits ||
    fractionalPart.length > maximumScale
  ) {
    return null;
  }

  return {
    digits: BigInt(`${integerPart}${fractionalPart}`),
    scale: fractionalPart.length,
  };
}

function powerOfTen(exponent: number): bigint {
  return BigInt(10) ** BigInt(exponent);
}

function formatScaledInteger(value: bigint, scale: number): string {
  const raw = value.toString().padStart(scale + 1, "0");
  if (scale === 0) {
    return raw;
  }

  return `${raw.slice(0, -scale)}.${raw.slice(-scale)}`;
}

function rescaleHalfUp(value: bigint, sourceScale: number, targetScale: number) {
  if (sourceScale <= targetScale) {
    return value * powerOfTen(targetScale - sourceScale);
  }

  const divisor = powerOfTen(sourceScale - targetScale);
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder * BigInt(2) >= divisor ? quotient + BigInt(1) : quotient;
}

export type ExactContractItemAmount = {
  quantity: string;
  unitPrice: string;
  amount: string;
  amountMinorUnits: bigint;
};

export function calculateExactContractItemAmount(
  quantityText: string,
  unitPriceText: string,
): ExactContractItemAmount | null {
  const quantity = parseUnsignedDecimal(quantityText.trim(), 15, 3);
  const unitPrice = parseUnsignedDecimal(unitPriceText.trim(), 14, 4);
  if (!quantity || !unitPrice || quantity.digits <= BigInt(0)) {
    return null;
  }

  const product = quantity.digits * unitPrice.digits;
  const amountMinorUnits = rescaleHalfUp(
    product,
    quantity.scale + unitPrice.scale,
    2,
  );
  if (amountMinorUnits.toString().length > 18) {
    return null;
  }

  return {
    quantity: formatScaledInteger(
      quantity.digits * powerOfTen(3 - quantity.scale),
      3,
    ),
    unitPrice: formatScaledInteger(
      unitPrice.digits * powerOfTen(4 - unitPrice.scale),
      4,
    ),
    amount: formatScaledInteger(amountMinorUnits, 2),
    amountMinorUnits,
  };
}

export function calculateExactContractTotal(
  items: PurchaseContractItemInput[],
): { items: ExactContractItemAmount[]; totalAmount: string } | null {
  const calculated = items.map((item) =>
    calculateExactContractItemAmount(item.quantity, item.unitPrice),
  );
  if (calculated.some((item) => item === null)) {
    return null;
  }

  const exactItems = calculated as ExactContractItemAmount[];
  const totalMinorUnits = exactItems.reduce(
    (total, item) => total + item.amountMinorUnits,
    BigInt(0),
  );
  if (totalMinorUnits.toString().length > 18) {
    return null;
  }

  return {
    items: exactItems,
    totalAmount: formatScaledInteger(totalMinorUnits, 2),
  };
}

export function purchaseContractNumberPrefix(year: number): string {
  return `PUR${String(year).slice(-2)}WS`;
}

export function suggestNextPurchaseContractNumber(
  existingNumbers: string[],
  year: number,
): string {
  const prefix = purchaseContractNumberPrefix(year);
  const pattern = new RegExp(`^${prefix}(\\d{4})$`);
  const maximum = existingNumbers.reduce((current, contractNo) => {
    const match = contractNo.match(pattern);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);

  if (maximum >= 9999) {
    throw new Error("Purchase contract number range exhausted");
  }

  return `${prefix}${String(maximum + 1).padStart(4, "0")}`;
}

export function validatePurchaseContractForm(formData: FormData):
  | { ok: true; input: PurchaseContractInput }
  | { ok: false; fieldErrors: Record<string, string> } {
  const contractNo = formString(formData, "contractNo");
  const signingDate = formString(formData, "signingDate");
  const companyId = formString(formData, "companyId");
  const supplierId = formString(formData, "supplierId");
  const deliveryDate = formString(formData, "deliveryDate");
  const fieldErrors: Record<string, string> = {};

  if (!contractNo) {
    fieldErrors.contractNo = "请输入合同编号。";
  } else if (contractNo.length > PURCHASE_CONTRACT_FIELD_LIMITS.contractNo) {
    fieldErrors.contractNo = "合同编号不能超过 64 个字符。";
  }

  if (!isValidDateText(signingDate)) {
    fieldErrors.signingDate = "请输入有效的签订日期。";
  }

  if (!companyId) {
    fieldErrors.companyId = "请选择买方。";
  }

  if (!supplierId) {
    fieldErrors.supplierId = "请选择卖方。";
  }

  if (deliveryDate && !isValidDateText(deliveryDate)) {
    fieldErrors.deliveryDate = "请输入有效的交货日期。";
  }

  const optionalFields = Object.keys(
    PURCHASE_CONTRACT_FIELD_LIMITS,
  ).filter((field) => field !== "contractNo") as Array<
    Exclude<keyof typeof PURCHASE_CONTRACT_FIELD_LIMITS, "contractNo">
  >;
  const optionalValues = Object.fromEntries(
    optionalFields.map((field) => [field, formString(formData, field)]),
  ) as Record<(typeof optionalFields)[number], string>;

  for (const field of optionalFields) {
    const limit = PURCHASE_CONTRACT_FIELD_LIMITS[field];
    if (optionalValues[field].length > limit) {
      fieldErrors[field] = `不能超过 ${limit} 个字符。`;
    }
  }

  let rawItems: unknown = [];
  try {
    rawItems = JSON.parse(formString(formData, "itemsJson") || "[]");
  } catch {
    fieldErrors.items = "合同明细格式无效。";
  }

  const items: PurchaseContractItemInput[] = [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    fieldErrors.items = "请至少添加一条合同明细。";
  } else {
    rawItems.forEach((rawItem, index) => {
      const item =
        typeof rawItem === "object" && rawItem !== null
          ? (rawItem as Record<string, unknown>)
          : {};
      const productId =
        typeof item.productId === "string" ? item.productId.trim() : "";
      const itemId =
        typeof item.itemId === "string" && item.itemId.trim()
          ? item.itemId.trim()
          : undefined;
      const quantity =
        typeof item.quantity === "string" ? item.quantity.trim() : "";
      const unitPrice =
        typeof item.unitPrice === "string" ? item.unitPrice.trim() : "";

      if (
        item.itemId !== undefined &&
        item.itemId !== null &&
        typeof item.itemId !== "string"
      ) {
        fieldErrors[`items.${index}.itemId`] = "合同明细身份无效。";
      }

      if (!productId) {
        fieldErrors[`items.${index}.productId`] = "请选择产品。";
      }

      const calculated = calculateExactContractItemAmount(quantity, unitPrice);
      if (!parseUnsignedDecimal(quantity, 15, 3) || quantity === "0") {
        fieldErrors[`items.${index}.quantity`] =
          "请输入大于 0、最多 3 位小数的有效数量。";
      } else if (!calculated) {
        fieldErrors[`items.${index}.quantity`] = "数量或金额超出允许范围。";
      }

      if (!parseUnsignedDecimal(unitPrice, 14, 4)) {
        fieldErrors[`items.${index}.unitPrice`] =
          "请输入大于等于 0、最多 4 位小数的有效单价。";
      }

      items.push({ ...(itemId ? { itemId } : {}), productId, quantity, unitPrice });
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    input: {
      contractNo,
      signingDate,
      signingPlace: optionalValue(optionalValues.signingPlace),
      companyId,
      supplierId,
      deliveryDate: optionalValue(deliveryDate),
      deliveryAddress: optionalValue(optionalValues.deliveryAddress),
      deliveryContactName: optionalValue(optionalValues.deliveryContactName),
      deliveryContactPhone: optionalValue(optionalValues.deliveryContactPhone),
      packagingTerms: optionalValue(optionalValues.packagingTerms),
      inspectionTerms: optionalValue(optionalValues.inspectionTerms),
      paymentTerms: optionalValue(optionalValues.paymentTerms),
      shippingMethod: optionalValue(optionalValues.shippingMethod),
      breachTerms: optionalValue(optionalValues.breachTerms),
      qualityTerms: optionalValue(optionalValues.qualityTerms),
      changeTerms: optionalValue(optionalValues.changeTerms),
      specialNotice: optionalValue(optionalValues.specialNotice),
      disputeTerms: optionalValue(optionalValues.disputeTerms),
      additionalTerms: optionalValue(optionalValues.additionalTerms),
      items,
    },
  };
}

export function isPurchaseContractUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
