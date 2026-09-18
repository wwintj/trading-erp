export const CUSTOMER_GENERIC_ERROR_MESSAGE = "客户保存失败，请稍后重试。";
export const CUSTOMER_DUPLICATE_CODE_MESSAGE = "客户代码已存在。";
export const CUSTOMER_FORBIDDEN_MESSAGE = "你没有权限修改客户。";
export const CUSTOMER_SIGN_IN_MESSAGE = "请先登录后再修改客户。";

export const CUSTOMER_FIELD_LIMITS = {
  code: 64,
  legalName: 255,
  shortName: 255,
  unifiedCreditCode: 64,
  contactName: 128,
  phone: 64,
  email: 255,
  address: 2000,
  defaultDeliveryContactName: 128,
  defaultDeliveryPhone: 64,
  defaultDeliveryAddress: 2000,
  notes: 4000,
} as const;

export type CustomerField = keyof typeof CUSTOMER_FIELD_LIMITS;

export type CustomerInput = {
  code: string;
  legalName: string;
  shortName: string | null;
  unifiedCreditCode: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  defaultDeliveryContactName: string | null;
  defaultDeliveryPhone: string | null;
  defaultDeliveryAddress: string | null;
  notes: string | null;
};

export type CustomerRecord = CustomerInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerListItem = Pick<
  CustomerRecord,
  | "id"
  | "code"
  | "legalName"
  | "shortName"
  | "contactName"
  | "phone"
  | "defaultDeliveryContactName"
>;

export type CustomerFormState = {
  status: "idle" | "success" | "error";
  message: string;
  customerId?: string;
  fieldErrors?: Partial<Record<CustomerField, string>>;
};

export const INITIAL_CUSTOMER_FORM_STATE: CustomerFormState = {
  status: "idle",
  message: "",
};

function trimmedFormValue(formData: FormData, field: CustomerField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string): string | null {
  return value === "" ? null : value;
}

export function validateCustomerForm(formData: FormData):
  | { ok: true; input: CustomerInput }
  | {
      ok: false;
      fieldErrors: Partial<Record<CustomerField, string>>;
    } {
  const fields = Object.keys(CUSTOMER_FIELD_LIMITS) as CustomerField[];
  const values = Object.fromEntries(
    fields.map((field) => [field, trimmedFormValue(formData, field)]),
  ) as Record<CustomerField, string>;
  const fieldErrors: Partial<Record<CustomerField, string>> = {};

  if (!values.code) {
    fieldErrors.code = "请输入客户代码。";
  }

  if (!values.legalName) {
    fieldErrors.legalName = "请输入公司全称。";
  }

  for (const field of fields) {
    const limit = CUSTOMER_FIELD_LIMITS[field];
    if (values[field].length > limit) {
      fieldErrors[field] = `不能超过 ${limit} 个字符。`;
    }
  }

  if (
    values.email &&
    !fieldErrors.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  ) {
    fieldErrors.email = "请输入有效的邮箱地址。";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    input: {
      code: values.code,
      legalName: values.legalName,
      shortName: optionalValue(values.shortName),
      unifiedCreditCode: optionalValue(values.unifiedCreditCode),
      contactName: optionalValue(values.contactName),
      phone: optionalValue(values.phone),
      email: optionalValue(values.email),
      address: optionalValue(values.address),
      defaultDeliveryContactName: optionalValue(
        values.defaultDeliveryContactName,
      ),
      defaultDeliveryPhone: optionalValue(values.defaultDeliveryPhone),
      defaultDeliveryAddress: optionalValue(values.defaultDeliveryAddress),
      notes: optionalValue(values.notes),
    },
  };
}

export function isCustomerUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
