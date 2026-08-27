import { describe, expect, it, vi } from "vitest";

import {
  CompanyAlreadyExistsError,
  type CompanyInput,
  type CompanyRecord,
  saveCompanySingleton,
  validateCompanyForm,
} from "@/lib/company";

const validInput: CompanyInput = {
  legalName: "天津纬信科技有限公司",
  shortName: null,
  unifiedCreditCode: null,
  contactName: null,
  phone: null,
  email: null,
  address: null,
  bankName: null,
  bankAccount: null,
};

function companyForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("legalName", "  天津纬信科技有限公司  ");
  formData.set("shortName", "   ");
  formData.set("email", "   ");

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }

  return formData;
}

describe("Company validation", () => {
  it("requires a trimmed legal name", () => {
    const result = validateCompanyForm(companyForm({ legalName: "   " }));

    expect(result).toEqual({
      ok: false,
      fieldErrors: { legalName: "Legal name is required." },
    });
  });

  it("trims values and normalizes empty optional strings to null", () => {
    const result = validateCompanyForm(companyForm());

    expect(result).toEqual({
      ok: true,
      input: validInput,
    });
  });

  it("rejects an invalid optional email", () => {
    const result = validateCompanyForm(companyForm({ email: "not-an-email" }));

    expect(result).toEqual({
      ok: false,
      fieldErrors: { email: "Enter a valid email address." },
    });
  });
});

describe("Company singleton persistence", () => {
  it("creates once and rejects a second create", async () => {
    const companies: CompanyRecord[] = [];
    const transaction = {
      findFirstTwo: vi.fn(async () => companies.slice(0, 2)),
      create: vi.fn(async (input: CompanyInput) => {
        const company = {
          ...input,
          id: "company-1",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
        };
        companies.push(company);
        return company;
      }),
      update: vi.fn(),
    };
    const runTransaction = vi.fn(async (operation) => operation(transaction));

    await expect(
      saveCompanySingleton(null, validInput, runTransaction),
    ).resolves.toMatchObject({ id: "company-1" });
    await expect(
      saveCompanySingleton(null, validInput, runTransaction),
    ).rejects.toBeInstanceOf(CompanyAlreadyExistsError);
    expect(transaction.create).toHaveBeenCalledTimes(1);
  });
});
