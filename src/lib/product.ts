export const PRODUCT_GENERIC_ERROR_MESSAGE = "产品保存失败，请稍后重试。";
export const PRODUCT_DUPLICATE_CODE_MESSAGE = "产品代码已存在。";
export const PRODUCT_FORBIDDEN_MESSAGE = "你没有权限修改产品。";
export const PRODUCT_SIGN_IN_MESSAGE = "请先登录后再修改产品。";

export const PRODUCT_FIELD_LIMITS = {
  code: 64,
  name: 255,
  specification: 255,
  unit: 32,
  notes: 4000,
} as const;

export type ProductField = keyof typeof PRODUCT_FIELD_LIMITS;

export type ProductInput = {
  code: string;
  name: string;
  specification: string | null;
  unit: string;
  notes: string | null;
};

export type ProductRecord = ProductInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductListItem = Pick<
  ProductRecord,
  "id" | "code" | "name" | "specification" | "unit"
>;

export type ProductFormState = {
  status: "idle" | "success" | "error";
  message: string;
  productId?: string;
  fieldErrors?: Partial<Record<ProductField, string>>;
};

export const INITIAL_PRODUCT_FORM_STATE: ProductFormState = {
  status: "idle",
  message: "",
};

function trimmedFormValue(formData: FormData, field: ProductField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string): string | null {
  return value === "" ? null : value;
}

export function validateProductForm(formData: FormData):
  | { ok: true; input: ProductInput }
  | {
      ok: false;
      fieldErrors: Partial<Record<ProductField, string>>;
    } {
  const values = Object.fromEntries(
    (Object.keys(PRODUCT_FIELD_LIMITS) as ProductField[]).map((field) => [
      field,
      trimmedFormValue(formData, field),
    ]),
  ) as Record<ProductField, string>;
  const fieldErrors: Partial<Record<ProductField, string>> = {};

  if (!values.code) {
    fieldErrors.code = "请输入产品代码。";
  }

  if (!values.name) {
    fieldErrors.name = "请输入产品名称。";
  }

  if (!values.unit) {
    fieldErrors.unit = "请输入单位。";
  }

  for (const field of Object.keys(PRODUCT_FIELD_LIMITS) as ProductField[]) {
    const limit = PRODUCT_FIELD_LIMITS[field];
    if (values[field].length > limit) {
      fieldErrors[field] = `不能超过 ${limit} 个字符。`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    input: {
      code: values.code,
      name: values.name,
      specification: optionalValue(values.specification),
      unit: values.unit,
      notes: optionalValue(values.notes),
    },
  };
}

export function isProductUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
