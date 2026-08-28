export const SUPPLIER_GENERIC_ERROR_MESSAGE =
  "Unable to save Supplier. Please try again.";
export const SUPPLIER_DUPLICATE_CODE_MESSAGE =
  "Supplier code already exists.";
export const SUPPLIER_FORBIDDEN_MESSAGE =
  "You do not have permission to change Supplier.";
export const SUPPLIER_SIGN_IN_MESSAGE = "You must sign in to change Supplier.";

export const SUPPLIER_FIELD_LIMITS = {
  code: 64,
  legalName: 255,
  shortName: 255,
  unifiedCreditCode: 64,
  contactName: 128,
  phone: 64,
  email: 255,
  address: 2000,
  bankName: 255,
  bankAccount: 128,
  notes: 4000,
} as const;

export type SupplierField = keyof typeof SUPPLIER_FIELD_LIMITS;

export type SupplierInput = {
  code: string;
  legalName: string;
  shortName: string | null;
  unifiedCreditCode: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
  notes: string | null;
};

export type SupplierRecord = SupplierInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SupplierListItem = Pick<
  SupplierRecord,
  "id" | "code" | "legalName" | "shortName" | "contactName" | "phone"
>;

export type SupplierFormState = {
  status: "idle" | "success" | "error";
  message: string;
  supplierId?: string;
  fieldErrors?: Partial<Record<SupplierField, string>>;
};

export const INITIAL_SUPPLIER_FORM_STATE: SupplierFormState = {
  status: "idle",
  message: "",
};

function trimmedFormValue(formData: FormData, field: SupplierField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string): string | null {
  return value === "" ? null : value;
}

export function validateSupplierForm(formData: FormData):
  | { ok: true; input: SupplierInput }
  | {
      ok: false;
      fieldErrors: Partial<Record<SupplierField, string>>;
    } {
  const values = Object.fromEntries(
    (Object.keys(SUPPLIER_FIELD_LIMITS) as SupplierField[]).map((field) => [
      field,
      trimmedFormValue(formData, field),
    ]),
  ) as Record<SupplierField, string>;
  const fieldErrors: Partial<Record<SupplierField, string>> = {};

  if (!values.code) {
    fieldErrors.code = "Supplier code is required.";
  }

  if (!values.legalName) {
    fieldErrors.legalName = "Legal name is required.";
  }

  for (const field of Object.keys(SUPPLIER_FIELD_LIMITS) as SupplierField[]) {
    const limit = SUPPLIER_FIELD_LIMITS[field];
    if (values[field].length > limit) {
      fieldErrors[field] = `Must be ${limit} characters or fewer.`;
    }
  }

  if (
    values.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  ) {
    fieldErrors.email = "Enter a valid email address.";
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
      bankName: optionalValue(values.bankName),
      bankAccount: optionalValue(values.bankAccount),
      notes: optionalValue(values.notes),
    },
  };
}

export function isSupplierUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
