export const COMPANY_GENERIC_ERROR_MESSAGE =
  "Unable to save Company. Please try again.";
export const COMPANY_FORBIDDEN_MESSAGE =
  "You do not have permission to change Company.";
export const COMPANY_SIGN_IN_MESSAGE = "You must sign in to change Company.";
export const COMPANY_ALREADY_EXISTS_MESSAGE =
  "Company has already been configured. Refresh and edit the existing record.";

export const COMPANY_FIELD_LIMITS = {
  legalName: 255,
  shortName: 255,
  unifiedCreditCode: 64,
  contactName: 128,
  phone: 64,
  email: 255,
  address: 2000,
  bankName: 255,
  bankAccount: 128,
} as const;

export type CompanyField = keyof typeof COMPANY_FIELD_LIMITS;

export type CompanyInput = {
  legalName: string;
  shortName: string | null;
  unifiedCreditCode: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
};

export type CompanyRecord = CompanyInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<CompanyField, string>>;
};

export const INITIAL_COMPANY_FORM_STATE: CompanyFormState = {
  status: "idle",
  message: "",
};

export class CompanyAlreadyExistsError extends Error {
  constructor() {
    super("A Company record already exists");
    this.name = "CompanyAlreadyExistsError";
  }
}

export class CompanyNotFoundError extends Error {
  constructor() {
    super("The Company record does not exist");
    this.name = "CompanyNotFoundError";
  }
}

export class CompanySingletonViolationError extends Error {
  constructor() {
    super("Multiple Company records exist");
    this.name = "CompanySingletonViolationError";
  }
}

function trimmedFormValue(formData: FormData, field: CompanyField): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string): string | null {
  return value === "" ? null : value;
}

export function validateCompanyForm(formData: FormData):
  | { ok: true; input: CompanyInput }
  | {
      ok: false;
      fieldErrors: Partial<Record<CompanyField, string>>;
    } {
  const values = Object.fromEntries(
    (Object.keys(COMPANY_FIELD_LIMITS) as CompanyField[]).map((field) => [
      field,
      trimmedFormValue(formData, field),
    ]),
  ) as Record<CompanyField, string>;
  const fieldErrors: Partial<Record<CompanyField, string>> = {};

  if (!values.legalName) {
    fieldErrors.legalName = "Legal name is required.";
  }

  for (const field of Object.keys(COMPANY_FIELD_LIMITS) as CompanyField[]) {
    const limit = COMPANY_FIELD_LIMITS[field];
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
      legalName: values.legalName,
      shortName: optionalValue(values.shortName),
      unifiedCreditCode: optionalValue(values.unifiedCreditCode),
      contactName: optionalValue(values.contactName),
      phone: optionalValue(values.phone),
      email: optionalValue(values.email),
      address: optionalValue(values.address),
      bankName: optionalValue(values.bankName),
      bankAccount: optionalValue(values.bankAccount),
    },
  };
}

export type CompanyTransaction = {
  findFirstTwo: () => Promise<CompanyRecord[]>;
  create: (input: CompanyInput) => Promise<CompanyRecord>;
  update: (id: string, input: CompanyInput) => Promise<CompanyRecord>;
};

export type CompanyTransactionRunner = (
  operation: (transaction: CompanyTransaction) => Promise<CompanyRecord>,
) => Promise<CompanyRecord>;

export async function saveCompanySingleton(
  companyId: string | null,
  input: CompanyInput,
  runTransaction: CompanyTransactionRunner,
): Promise<CompanyRecord> {
  return runTransaction(async (transaction) => {
    const companies = await transaction.findFirstTwo();

    if (companies.length > 1) {
      throw new CompanySingletonViolationError();
    }

    const company = companies[0];

    if (!companyId) {
      if (company) {
        throw new CompanyAlreadyExistsError();
      }

      return transaction.create(input);
    }

    if (!company || company.id !== companyId) {
      throw new CompanyNotFoundError();
    }

    return transaction.update(company.id, input);
  });
}
